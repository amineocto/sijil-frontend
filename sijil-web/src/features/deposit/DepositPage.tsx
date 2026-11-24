import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { EmptyState, LoadingState } from "@sijil/ui-kit";
import { api, call, isApiError } from "@/shared/api";
import { sendFile } from "@/shared/deposit";
import { PARTY_OPTIONS, statusLabel } from "@/shared/labels";
import { fieldsOf, toMetadata } from "@/shared/metadata";
import { MetadataFields } from "@/shared/MetadataFields";
import { Page, Section } from "@/shared/ui/page";
import { QueryState } from "@/shared/QueryState";
import { canContribute, useSession } from "@/shared/session";
import type { Items, PartyType, Reception, TypeSummary, TypeVersion } from "@/shared/types";
import {
  Button,
  FileField,
  Notice,
  ProgressBar,
  SelectField,
  TextField,
  TextLink,
  type Tone,
} from "@/shared/ui";

/** Intervalle de suivi de la quarantaine. */
export const RECEPTION_POLL_MS = 2000;
/** Suivi automatique : quatre minutes à l'intervalle courant ; au-delà, vérification à la demande. */
export const receptionFollow = { maxPolls: 120 };

/**
 * Écran « Dépôt » : type publié, métadonnées générées depuis son schéma, titulaire, fichier envoyé
 * directement vers la quarantaine avec progression, puis suivi du contrôle jusqu'à l'admission.
 */
export function DepositPage() {
  const session = useSession();
  const [code, setCode] = useState<string | null>(null);
  const types = useQuery({
    queryKey: ["types"],
    enabled: canContribute(session.data),
    queryFn: () => call(api.GET("/api/document-types")) as unknown as Promise<Items<TypeSummary>>,
  });

  if (session.isPending) return <LoadingState />;
  if (!canContribute(session.data)) {
    return (
      <Page title="Déposer un document">
        <EmptyState
          title="Dépôt réservé aux contributeurs"
          description="Votre profil ne permet pas de déposer de document."
        />
      </Page>
    );
  }
  return (
    <Page
      title="Déposer un document"
      subtitle="Le document passe en quarantaine (antivirus, format, empreinte), puis devient consultable."
      width="wide"
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-5">
          <Section title="1 · Type de document">
            <QueryState query={types}>
              {({ items }) =>
                items.length === 0 ? (
                  <EmptyState
                    title="Aucun type publié"
                    description="Le catalogue ne propose aucun type."
                  />
                ) : (
                  <SelectField
                    label="Type de document"
                    required
                    placeholder="Choisir un type publié"
                    options={items.map((t) => ({ value: t.code, label: t.label ?? t.code }))}
                    value={code ?? ""}
                    onChange={(e) => {
                      setCode(e.currentTarget.value || null);
                    }}
                  />
                )
              }
            </QueryState>
          </Section>
          {code && <DepositForm key={code} code={code} />}
        </div>
        <aside className="flex flex-col gap-5 lg:sticky lg:top-0 lg:self-start">
          <Section title="Comment se passe un dépôt">
            <ol className="flex flex-col gap-3 text-sm text-gray-700">
              {[
                "Choisissez un type publié : il fixe les informations demandées.",
                "Renseignez ses informations et son titulaire.",
                "Envoyez le fichier : il part directement en quarantaine.",
                "Antivirus, format et empreinte sont contrôlés ; le document devient consultable dès son admission.",
              ].map((step, i) => (
                <li key={step} className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-orange-50 text-xs font-bold text-orange-700">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </Section>
        </aside>
      </div>
    </Page>
  );
}

function DepositForm({ code }: { code: string }) {
  const type = useQuery({
    queryKey: ["type", code],
    queryFn: () =>
      call(
        api.GET("/api/document-types/{code}", { params: { path: { code } } }),
      ) as unknown as Promise<TypeVersion>,
  });
  return <QueryState query={type}>{(t) => <Form type={t} />}</QueryState>;
}

function Form({ type }: { type: TypeVersion }) {
  const fields = fieldsOf(type.definition.metadataSchema);
  const [values, setValues] = useState<Record<string, string>>({});
  // Titulaire prérempli depuis le dossier client (« Déposer pour ce client »).
  const [params] = useSearchParams();
  const [partyType, setPartyType] = useState<PartyType>(
    PARTY_OPTIONS.some((o) => o.value === params.get("partieType"))
      ? (params.get("partieType") as PartyType)
      : "CLIENT",
  );
  const [partyId, setPartyId] = useState(params.get("partie") ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  // Une clé par intention (ce fichier) : un nouvel essai après une coupure ne crée pas de doublon ;
  // un autre fichier est une autre intention (AUD-20261120-339).
  const key = useMemo(() => (file ? crypto.randomUUID() : ""), [file]);
  const maxBytes = (type.definition.maxSizeMb ?? 50) * 1024 * 1024;
  const tooLarge = file !== null && file.size > maxBytes;
  const deposit = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Choisissez un fichier.");
      const session = await sendFile(type, file, key, setProgress);
      return call(
        api.POST("/api/documents", {
          params: { header: { "Idempotency-Key": key } },
          body: {
            uploadSession: session,
            parties: [{ type: partyType, id: partyId.trim(), role: "TITULAIRE" }],
            metadata: toMetadata(fields, values),
          },
        }),
      ) as unknown as Promise<{ id: string }>;
    },
  });

  if (deposit.data) {
    return (
      <Section title="Suivi du dépôt">
        <Follow id={deposit.data.id} />
      </Section>
    );
  }
  const errors = isApiError(deposit.error) ? deposit.error.errorsByField() : {};
  return (
    <form
      aria-label="Dépôt"
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!tooLarge) deposit.mutate();
      }}
    >
      <Section title="2 · Informations">
        <MetadataFields fields={fields} values={values} errors={errors} onChange={setValues} />
      </Section>
      <Section title="3 · Titulaire">
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField
            label="Partie"
            options={PARTY_OPTIONS}
            value={partyType}
            onChange={(e) => {
              setPartyType(e.currentTarget.value as PartyType);
            }}
          />
          <TextField
            label="Identifiant du titulaire"
            required
            pattern="[A-Za-z0-9_\-]{1,64}"
            value={partyId}
            onChange={(e) => {
              setPartyId(e.currentTarget.value);
            }}
          />
        </div>
      </Section>
      <Section title="4 · Fichier">
        <FileField
          label="Fichier"
          description={`Formats : ${(type.definition.formats ?? []).join(", ")} ; ${String(type.definition.maxSizeMb ?? 50)} Mo au plus.`}
          required
          accept={(type.definition.formats ?? []).join(",")}
          onFile={setFile}
          error={tooLarge ? "Fichier trop volumineux pour ce type." : undefined}
        />
        {deposit.isPending && (
          <div className="mt-4">
            <ProgressBar value={progress} label="Envoi du fichier" />
          </div>
        )}
      </Section>
      {deposit.error && (
        <Notice tone="danger" role="alert" title="Dépôt refusé">
          {deposit.error.message}
        </Notice>
      )}
      <div className="flex justify-end">
        <Button type="submit" loading={deposit.isPending}>
          Déposer
        </Button>
      </div>
    </form>
  );
}

const RECEPTION_TONES: Record<string, Tone> = {
  ACTIF: "success",
  EN_QUARANTAINE: "info",
};

/** Suivi de la quarantaine : interroge le BFF jusqu'à l'admission ou au rejet. */
function Follow({ id }: { id: string }) {
  const client = useQueryClient();
  const reception = useQuery({
    queryKey: ["reception", id],
    queryFn: () =>
      call(
        api.GET("/api/documents/{id}/reception", { params: { path: { id } } }),
      ) as unknown as Promise<Reception>,
    // Suivi borné : arrêt sur erreur et après receptionFollow.maxPolls relances (AUD-20261120-335).
    refetchInterval: (query) =>
      query.state.status !== "error" &&
      query.state.dataUpdateCount < receptionFollow.maxPolls &&
      (query.state.data?.status === "EN_QUARANTAINE" || !query.state.data)
        ? RECEPTION_POLL_MS
        : false,
    retry: false,
  });
  const polls = client.getQueryState(["reception", id])?.dataUpdateCount ?? 0;
  return (
    <QueryState query={reception}>
      {(r) =>
        r.status === "EN_QUARANTAINE" && polls >= receptionFollow.maxPolls ? (
          <Notice tone="warning" title="Contrôle plus long que prévu" role="status">
            <div className="flex flex-col gap-3">
              <span>
                Le document est bien reçu ; son contrôle n'est pas encore terminé. Il sera
                consultable dès son admission.
              </span>
              <div className="flex flex-wrap items-center gap-4">
                <Button
                  variant="secondary"
                  size="sm"
                  loading={reception.isFetching}
                  onClick={() => {
                    void reception.refetch();
                  }}
                >
                  Vérifier à nouveau
                </Button>
                <TextLink to={`/documents/${id}`}>Ouvrir la fiche</TextLink>
              </div>
            </div>
          </Notice>
        ) : (
          <Notice
            tone={RECEPTION_TONES[r.status] ?? "danger"}
            title={statusLabel(r.status)}
            role="status"
          >
            {r.status === "EN_QUARANTAINE" && "Document reçu : contrôle en cours…"}
            {r.status === "ACTIF" && (
              <TextLink to={`/documents/${id}`}>Ouvrir le document</TextLink>
            )}
            {r.status === "REJETE_TECHNIQUE" &&
              "Le fichier n'a pas passé le contrôle (format, antivirus ou empreinte)."}
          </Notice>
        )
      }
    </QueryState>
  );
}
