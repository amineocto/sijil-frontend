import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { EmptyState, LoadingState } from "@sijil/ui-kit";
import { api, call, isApiError } from "@/shared/api";
import { sendFile } from "@/shared/deposit";
import { PARTY_OPTIONS, statusLabel } from "@/shared/labels";
import { fieldsOf, toMetadata } from "@/shared/metadata";
import { MetadataFields } from "@/shared/MetadataFields";
import { QueryState } from "@/shared/QueryState";
import { canContribute, useSession } from "@/shared/session";
import type { Items, PartyType, Reception, TypeSummary, TypeVersion } from "@/shared/types";
import {
  Button,
  FileField,
  Heading,
  Notice,
  Panel,
  ProgressBar,
  SelectField,
  TextField,
  TextLink,
  type Tone,
} from "@/shared/ui";

/** Intervalle de suivi de la quarantaine. */
export const RECEPTION_POLL_MS = 2000;
/** Quatre minutes de suivi à l'intervalle courant ; au-delà, l'état se relit sur la fiche. */
const RECEPTION_MAX_POLLS = 120;

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
      <EmptyState
        title="Dépôt réservé aux contributeurs"
        description="Votre profil ne permet pas de déposer de document."
      />
    );
  }
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Heading>Déposer un document</Heading>
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
      {code && <DepositForm key={code} code={code} />}
    </div>
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
  const [partyType, setPartyType] = useState<PartyType>("CLIENT");
  const [partyId, setPartyId] = useState("");
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

  if (deposit.data) return <Follow id={deposit.data.id} />;
  const errors = isApiError(deposit.error) ? deposit.error.errorsByField() : {};
  return (
    <Panel>
      <form
        aria-label="Dépôt"
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!tooLarge) deposit.mutate();
        }}
      >
        <Heading level={3}>Métadonnées</Heading>
        <MetadataFields fields={fields} values={values} errors={errors} onChange={setValues} />
        <Heading level={3}>Titulaire</Heading>
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
            pattern="[A-Za-z0-9_-]{1,64}"
            value={partyId}
            onChange={(e) => {
              setPartyId(e.currentTarget.value);
            }}
          />
        </div>
        <FileField
          label="Fichier"
          description={`Formats : ${(type.definition.formats ?? []).join(", ")} ; ${String(type.definition.maxSizeMb ?? 50)} Mo au plus.`}
          required
          accept={(type.definition.formats ?? []).join(",")}
          onFile={setFile}
          error={tooLarge ? "Fichier trop volumineux pour ce type." : undefined}
        />
        {deposit.isPending && <ProgressBar value={progress} label="Envoi du fichier" />}
        {deposit.error && (
          <Notice tone="danger" role="alert" title="Dépôt refusé">
            {deposit.error.message}
          </Notice>
        )}
        <div>
          <Button type="submit" loading={deposit.isPending}>
            Déposer
          </Button>
        </div>
      </form>
    </Panel>
  );
}

const RECEPTION_TONES: Record<string, Tone> = {
  ACTIF: "success",
  EN_QUARANTAINE: "info",
};

/** Suivi de la quarantaine : interroge le BFF jusqu'à l'admission ou au rejet. */
function Follow({ id }: { id: string }) {
  const reception = useQuery({
    queryKey: ["reception", id],
    queryFn: () =>
      call(
        api.GET("/api/documents/{id}/reception", { params: { path: { id } } }),
      ) as unknown as Promise<Reception>,
    // Suivi borné : arrêt sur erreur et après RECEPTION_MAX_POLLS relances (AUD-20261120-335).
    refetchInterval: (query) =>
      query.state.status !== "error" &&
      query.state.dataUpdateCount < RECEPTION_MAX_POLLS &&
      (query.state.data?.status === "EN_QUARANTAINE" || !query.state.data)
        ? RECEPTION_POLL_MS
        : false,
    retry: false,
  });
  return (
    <QueryState query={reception}>
      {(r) => (
        <Notice
          tone={RECEPTION_TONES[r.status] ?? "danger"}
          title={statusLabel(r.status)}
          role="status"
        >
          {r.status === "EN_QUARANTAINE" && "Document reçu : contrôle en cours…"}
          {r.status === "ACTIF" && <TextLink to={`/documents/${id}`}>Ouvrir le document</TextLink>}
          {r.status === "REJETE_TECHNIQUE" &&
            "Le fichier n'a pas passé le contrôle (format, antivirus ou empreinte)."}
        </Notice>
      )}
    </QueryState>
  );
}
