import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router";
import { EmptyState } from "@sijil/ui-kit";
import { DocumentDrawer } from "@/features/dossier/DocumentDrawer";
import { DossierCompleteness } from "@/features/dossier/DossierCompleteness";
import {
  groupByFamily,
  typeLabel,
  validity,
  type TypeInfo,
  type Validity,
} from "@/features/dossier/dossier";
import { partyTypeOf } from "@/features/dossier/paths";
import { accessHeaders, type Access } from "@/shared/access";
import { api, call } from "@/shared/api";
import { formatDate, PARTY_TYPE_LABELS, SENSITIVITY_LABELS, statusLabel } from "@/shared/labels";
import { QueryState } from "@/shared/QueryState";
import { canBreakGlass, canContribute, useSession } from "@/shared/session";
import { Thumbnail } from "@/shared/Thumbnail";
import type { DocumentPage, DocumentView, PartyType } from "@/shared/types";
import {
  Button,
  ButtonLink,
  Heading,
  Muted,
  Notice,
  Panel,
  Tabs,
  Tag,
  TextAreaField,
  type TagVariant,
} from "@/shared/ui";
import { DocumentIcon } from "@/shared/ui/icons";

/** Pages lues au plus pour un dossier (20 documents par page côté `sijil-api`). */
const MAX_PAGES = 10;

/**
 * Écran « Dossier » (direction A) : les documents d'un client, d'une personne ou d'un compte,
 * groupés par famille avec leur validité, la complétude face à un jeu d'exigences, et la fiche de
 * chaque pièce en volet. Les droits restent ceux de `sijil-api` : un document d'un autre parcours
 * demande une finalité à l'ouverture de sa fiche.
 */
export function DossierPage() {
  const params = useParams();
  const partyType = partyTypeOf(params["partyType"]);
  const partyId = params["partyId"] ?? "";
  if (!partyType || !partyId) {
    return (
      <Notice tone="warning" title="Dossier introuvable">
        L&apos;adresse ne désigne ni un client, ni une personne, ni un compte.
      </Notice>
    );
  }
  return <Dossier key={`${partyType}-${partyId}`} partyType={partyType} partyId={partyId} />;
}

function Dossier({ partyType, partyId }: { partyType: PartyType; partyId: string }) {
  const session = useSession();
  const [access, setAccess] = useState<Access>({});
  const [selection, setSelection] = useSearchParams();
  const opened = selection.get("document");
  const types = useTypeIndex();
  const documents = useQuery({
    queryKey: ["dossier", partyType, partyId, access],
    queryFn: () => allDocuments(partyType, partyId, access),
  });
  const party = `${PARTY_TYPE_LABELS[partyType] ?? partyType} ${partyId}`;
  const openedDocument = documents.data?.find((d) => d.id === opened);

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Fil d'Ariane" className="text-sm text-gray-600">
        Dossiers <span aria-hidden="true">›</span>{" "}
        <span className="font-semibold text-gray-900">{party}</span>
      </nav>
      <Panel className="flex flex-wrap items-center gap-6">
        <div
          aria-hidden="true"
          className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-lg font-bold text-orange-700"
        >
          {partyId.slice(-2).toUpperCase()}
        </div>
        <div className="flex min-w-60 flex-1 flex-col gap-2">
          <Heading>{party}</Heading>
          {documents.data && <Summary documents={documents.data} />}
        </div>
        {canContribute(session.data) && (
          <ButtonLink
            to={`/depot?partieType=${partyType}&partie=${encodeURIComponent(partyId)}`}
            data-tour="deposer-pour"
          >
            Déposer pour ce{" "}
            {partyType === "COMPTE" ? "compte" : partyType === "PERSONNE" ? "titulaire" : "client"}
          </ButtonLink>
        )}
      </Panel>
      <div className="flex flex-wrap items-start gap-6">
        <section
          aria-label="Pièces du dossier"
          className="flex min-w-0 flex-[999_1_36rem] flex-col gap-4"
        >
          <QueryState query={documents}>
            {(items) =>
              items.length === 0 ? (
                <EmptyState
                  title="Aucun document"
                  description="Aucun document consultable avec vos droits pour cette partie."
                />
              ) : (
                <Families
                  documents={items}
                  types={types}
                  onOpen={(id) => {
                    setSelection({ document: id });
                  }}
                />
              )
            }
          </QueryState>
        </section>
        <aside className="flex min-w-72 flex-[1_1_20rem] flex-col gap-6 lg:max-w-md">
          <DossierCompleteness partyType={partyType} partyId={partyId} />
          {canBreakGlass(session.data) && <BreakGlass onApply={setAccess} />}
        </aside>
      </div>
      {opened && (
        <DocumentDrawer
          id={opened}
          title={openedDocument ? typeLabel(openedDocument.documentType, types) : "Document"}
          onClose={() => {
            setSelection({});
          }}
        />
      )}
    </div>
  );
}

function Summary({ documents }: { documents: DocumentView[] }) {
  const parcours = [...new Set(documents.map((d) => d.parcours))].sort();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Tag>
        {documents.length} document{documents.length > 1 ? "s" : ""}
      </Tag>
      {parcours.length > 0 && <Tag variant="info">Parcours {parcours.join(" · ")}</Tag>}
    </div>
  );
}

function Families({
  documents,
  types,
  onOpen,
}: {
  documents: DocumentView[];
  types: Record<string, TypeInfo>;
  onOpen: (id: string) => void;
}) {
  const groups = groupByFamily(documents, types);
  const today = new Date();
  const list = (items: { label: string; documents: DocumentView[] }[]) => (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      {items.map((group) => (
        <div key={group.label}>
          <h3 className="border-b border-gray-200 bg-gray-50 px-4 py-2.5 text-xs font-bold tracking-wide text-gray-600 uppercase">
            {group.label}
          </h3>
          <ul>
            {group.documents.map((d) => (
              <li key={d.id} className="border-b border-gray-100 last:border-b-0">
                <Row document={d} types={types} today={today} onOpen={onOpen} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
  return (
    <Tabs
      label="Familles de documents"
      tabs={[
        { id: "toutes", label: `Toutes · ${String(documents.length)}`, content: list(groups) },
        ...groups.map((g) => ({
          id: g.family,
          label: `${g.label} · ${String(g.documents.length)}`,
          content: list([g]),
        })),
      ]}
    />
  );
}

const VALIDITY: Record<Validity["state"], { variant: TagVariant; text: (v: Validity) => string }> =
  {
    VALIDE: { variant: "success", text: (v) => `Valide jusqu'au ${until(v)}` },
    BIENTOT: {
      variant: "warning",
      text: (v) => (v.state === "BIENTOT" ? `Expire dans ${String(v.days)} j` : ""),
    },
    EXPIREE: { variant: "danger", text: (v) => `Expirée le ${until(v)}` },
    SANS_ECHEANCE: { variant: "default", text: () => "" },
  };

function until(v: Validity): string {
  return "until" in v ? formatDate(v.until) : "";
}

function Row({
  document,
  types,
  today,
  onOpen,
}: {
  document: DocumentView;
  types: Record<string, TypeInfo>;
  today: Date;
  onOpen: (id: string) => void;
}) {
  const session = useSession();
  const label = typeLabel(document.documentType, types);
  const v = validity(document, today);
  const otherParcours =
    session.data !== undefined && !session.data.parcours.includes(document.parcours);
  return (
    <button
      type="button"
      onClick={() => {
        onOpen(document.id);
      }}
      className="flex w-full items-center gap-4 px-4 py-3 text-start transition-colors hover:bg-orange-25 focus-visible:bg-orange-25 focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:outline-none focus-visible:ring-inset"
    >
      <span className="relative flex h-14 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-gray-200 bg-gray-50 text-gray-500 [&>img]:absolute [&>img]:inset-0 [&>img]:size-full [&>img]:bg-white [&>img]:object-cover">
        <DocumentIcon />
        <Thumbnail id={document.id} label={label} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold text-gray-900">{label}</span>
        <span className="truncate text-sm text-gray-600">
          Déposé le {formatDate(document.createdAt)} · version {document.currentVersion}
          {document.parcours ? ` · parcours ${document.parcours}` : ""}
        </span>
      </span>
      <span className="flex flex-wrap justify-end gap-2">
        {document.status !== "ACTIF" && <Tag variant="info">{statusLabel(document.status)}</Tag>}
        {document.verification && <Tag variant="warning">Type à vérifier</Tag>}
        {otherParcours && <Tag>Autre parcours</Tag>}
        {document.sensitivity !== "STANDARD" && (
          <Tag>{SENSITIVITY_LABELS[document.sensitivity]}</Tag>
        )}
        {v.state !== "SANS_ECHEANCE" && (
          <Tag variant={VALIDITY[v.state].variant}>{VALIDITY[v.state].text(v)}</Tag>
        )}
      </span>
    </button>
  );
}

/** Bris de glace (rôle dédié) : motif tracé, pour inclure les documents restreints du dossier. */
function BreakGlass({ onApply }: { onApply: (access: Access) => void }) {
  const [reason, setReason] = useState("");
  return (
    <Panel className="flex flex-col gap-3">
      <Heading level={3}>Documents restreints</Heading>
      <Muted>Accès exceptionnel, tracé et contrôlé.</Muted>
      <form
        aria-label="Bris de glace"
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (reason.trim()) onApply({ breakGlassReason: reason.trim() });
        }}
      >
        <TextAreaField
          label="Motif de bris de glace"
          rows={2}
          maxLength={255}
          value={reason}
          onChange={(e) => {
            setReason(e.currentTarget.value);
          }}
        />
        <div>
          <Button type="submit" variant="secondary" disabled={!reason.trim()}>
            Inclure les documents restreints
          </Button>
        </div>
      </form>
    </Panel>
  );
}

/** Libellé et famille de chaque type du catalogue ; vide si le catalogue n'est pas lisible. */
function useTypeIndex(): Record<string, TypeInfo> {
  const types = useQuery({
    queryKey: ["type-index"],
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async () => {
      const index: Record<string, TypeInfo> = {};
      let cursor: string | undefined;
      for (let i = 0; i < MAX_PAGES; i++) {
        const page = await call(
          api.GET("/api/types", { params: { query: cursor ? { cursor } : {} } }),
        );
        for (const t of page.items) index[t.code] = { label: t.label, family: t.family };
        if (!page.hasMore || !page.nextCursor) break;
        cursor = page.nextCursor;
      }
      return index;
    },
  });
  return types.data ?? {};
}

async function allDocuments(
  partyType: PartyType,
  partyId: string,
  access: Access,
): Promise<DocumentView[]> {
  const items: DocumentView[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < MAX_PAGES; i++) {
    const page = (await call(
      api.GET("/api/documents", {
        params: {
          query: { partyType, partyId, ...(cursor ? { cursor } : {}) },
          header: accessHeaders(access),
        },
      }),
    )) as unknown as DocumentPage;
    items.push(...page.items);
    if (!page.page.hasMore || !page.page.nextCursor) break;
    cursor = page.page.nextCursor;
  }
  return items;
}
