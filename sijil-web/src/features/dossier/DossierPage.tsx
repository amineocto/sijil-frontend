import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@awb/ui";
import { useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router";
import { EmptyState } from "@sijil/ui-kit";
import { DocumentDrawer } from "@/features/dossier/DocumentDrawer";
import { DossierCompleteness } from "@/features/dossier/DossierCompleteness";
import {
  FAMILY_LABELS,
  familyLabel,
  typeLabel,
  validity,
  type TypeInfo,
  type Validity,
} from "@/features/dossier/dossier";
import { dossierPath, partyTypeOf } from "@/features/dossier/paths";
import { rememberDossier } from "@/features/dossier/recents";
import { useTypeIndex } from "@/features/dossier/typeIndex";
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
  Notice,
  SelectField,
  Tag,
  TextAreaField,
  TextField,
  type TagVariant,
} from "@/shared/ui";
import { DocumentIcon } from "@/shared/ui/icons";
import { DataTable, Page, Section } from "@/shared/ui/page";

/** Pages lues au plus pour un dossier (20 documents par page côté `sijil-api`). */
const MAX_PAGES = 10;

/**
 * Écran « Dossier » (poste CRC) : en-tête de la partie, onglets Documents et Complétude ; pièces
 * filtrables par texte, famille et validité, fiche de chaque pièce en volet. Les droits restent ceux
 * de `sijil-api` : un document d'un autre parcours demande une finalité à l'ouverture de sa fiche.
 */
export function DossierPage({ tab = "documents" }: { tab?: "documents" | "completude" }) {
  const params = useParams();
  const partyType = partyTypeOf(params["partyType"]);
  const partyId = params["partyId"] ?? "";
  if (!partyType || !partyId) {
    return (
      <Page title="Dossier">
        <Notice tone="warning" title="Dossier introuvable">
          L&apos;adresse ne désigne ni un client, ni une personne, ni un compte.
        </Notice>
      </Page>
    );
  }
  return (
    <Dossier key={`${partyType}-${partyId}`} partyType={partyType} partyId={partyId} tab={tab} />
  );
}

export const DossierCompletenessPage = () => <DossierPage tab="completude" />;

function Dossier({
  partyType,
  partyId,
  tab,
}: {
  partyType: PartyType;
  partyId: string;
  tab: "documents" | "completude";
}) {
  const session = useSession();
  const [access, setAccess] = useState<Access>({});
  const [selection, setSelection] = useSearchParams();
  const opened = selection.get("document");
  const types = useTypeIndex();
  const documents = useQuery({
    queryKey: ["dossier", partyType, partyId, access],
    queryFn: () => allDocuments(partyType, partyId, access),
  });
  useEffect(() => {
    rememberDossier(partyType, partyId);
  }, [partyType, partyId]);
  const party = `${PARTY_TYPE_LABELS[partyType] ?? partyType} ${partyId}`;
  const holder =
    partyType === "COMPTE" ? "compte" : partyType === "PERSONNE" ? "titulaire" : "client";
  const openedDocument = documents.data?.find((d) => d.id === opened);
  const base = dossierPath(partyType, partyId);

  return (
    <Page
      leading={
        <Avatar size="lg" name={party} style={{ backgroundColor: "var(--color-orange-700)" }} />
      }
      title={party}
      subtitle={documents.data && <Summary documents={documents.data} />}
      actions={
        <>
          {tab === "documents" && (
            <ButtonLink to={`${base}/completude`} variant="secondary">
              Vérifier la complétude
            </ButtonLink>
          )}
          {canContribute(session.data) && (
            <ButtonLink
              to={`/depot?partieType=${partyType}&partie=${encodeURIComponent(partyId)}`}
              data-tour="deposer-pour"
            >
              Déposer pour ce {holder}
            </ButtonLink>
          )}
        </>
      }
      tabs={[
        {
          label: documents.data ? `Documents · ${String(documents.data.length)}` : "Documents",
          to: base,
          end: true,
        },
        { label: "Complétude", to: `${base}/completude` },
      ]}
      tabsLabel="Rubriques du dossier"
    >
      {tab === "completude" ? (
        <DossierCompleteness partyType={partyType} partyId={partyId} />
      ) : (
        <>
          {canBreakGlass(session.data) && <BreakGlass onApply={setAccess} />}
          <section aria-label="Pièces du dossier">
            <QueryState query={documents}>
              {(items) =>
                items.length === 0 ? (
                  <EmptyState
                    title="Aucun document"
                    description="Aucun document consultable avec vos droits pour cette partie."
                  />
                ) : (
                  <Pieces
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
        </>
      )}
      {opened && (
        <DocumentDrawer
          id={opened}
          title={openedDocument ? typeLabel(openedDocument.documentType, types) : "Document"}
          onClose={() => {
            setSelection({});
          }}
        />
      )}
    </Page>
  );
}

function Summary({ documents }: { documents: DocumentView[] }) {
  const today = new Date();
  const parcours = [...new Set(documents.map((d) => d.parcours))].sort();
  const soon = documents.filter((d) => validity(d, today).state === "BIENTOT").length;
  const expired = documents.filter((d) => validity(d, today).state === "EXPIREE").length;
  return (
    <>
      {parcours.length > 0 && <Tag variant="info">Parcours {parcours.join(" · ")}</Tag>}
      {soon > 0 && (
        <Tag variant="warning">
          {soon} pièce{soon > 1 ? "s" : ""} à renouveler
        </Tag>
      )}
      {expired > 0 && (
        <Tag variant="danger">
          {expired} pièce{expired > 1 ? "s" : ""} expirée{expired > 1 ? "s" : ""}
        </Tag>
      )}
    </>
  );
}

const VALIDITY_FILTERS = [
  { value: "VALIDE", label: "Valides" },
  { value: "BIENTOT", label: "À renouveler (30 jours)" },
  { value: "EXPIREE", label: "Expirées" },
  { value: "SANS_ECHEANCE", label: "Sans échéance" },
];

function Pieces({
  documents,
  types,
  onOpen,
}: {
  documents: DocumentView[];
  types: Record<string, TypeInfo>;
  onOpen: (id: string) => void;
}) {
  const session = useSession();
  const [text, setText] = useState("");
  const [family, setFamily] = useState("");
  const [state, setState] = useState("");
  const today = useMemo(() => new Date(), []);
  const familyOf = (d: DocumentView) => types[d.documentType]?.family ?? "AUTRES";
  const families = [...new Set(documents.map(familyOf))];
  const rows = documents
    .filter((d) => !family || familyOf(d) === family)
    .filter((d) => !state || validity(d, today).state === state)
    .filter((d) => {
      const needle = text.trim().toLowerCase();
      return (
        !needle ||
        typeLabel(d.documentType, types).toLowerCase().includes(needle) ||
        d.documentType.toLowerCase().includes(needle)
      );
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const otherParcours = (d: DocumentView) =>
    session.data !== undefined && !session.data.parcours.includes(d.parcours);
  const open = (d: DocumentView) => (
    <button
      type="button"
      onClick={() => {
        onOpen(d.id);
      }}
      className="text-start font-semibold text-gray-900 hover:text-orange-700 hover:underline focus-visible:underline focus-visible:outline-none"
    >
      {typeLabel(d.documentType, types)}
    </button>
  );

  return (
    <DataTable
      label="Pièces"
      rows={rows}
      rowKey={(d) => d.id}
      toolbar={
        <div className="grid gap-3 sm:grid-cols-3 lg:flex lg:items-center">
          <div className="sm:col-span-3 lg:w-80">
            <TextField
              label="Rechercher une pièce"
              hideLabel
              type="search"
              placeholder="Rechercher une pièce"
              value={text}
              onChange={(e) => {
                setText(e.currentTarget.value);
              }}
            />
          </div>
          <div className="lg:w-52">
            <SelectField
              label="Famille"
              hideLabel
              placeholder="Toutes les familles"
              options={families
                .sort(
                  (a, b) =>
                    Object.keys(FAMILY_LABELS).indexOf(a) - Object.keys(FAMILY_LABELS).indexOf(b),
                )
                .map((f) => ({ value: f, label: familyLabel(f) }))}
              value={family}
              onChange={(e) => {
                setFamily(e.currentTarget.value);
              }}
            />
          </div>
          <div className="lg:w-56">
            <SelectField
              label="Validité"
              hideLabel
              placeholder="Toute validité"
              options={VALIDITY_FILTERS}
              value={state}
              onChange={(e) => {
                setState(e.currentTarget.value);
              }}
            />
          </div>
          <p className="text-sm text-gray-600 lg:ms-auto" role="status">
            {rows.length} sur {documents.length}
          </p>
        </div>
      }
      columns={[
        {
          header: "Document",
          cell: (d) => (
            <div className="flex items-center gap-3">
              <Miniature document={d} label={typeLabel(d.documentType, types)} />
              <div className="flex min-w-0 flex-col gap-0.5">
                {open(d)}
                <span className="text-xs text-gray-600">
                  {d.documentType} · v{d.currentVersion}
                </span>
              </div>
            </div>
          ),
        },
        {
          header: "Famille",
          cell: (d) => <span className="text-gray-700">{familyLabel(familyOf(d))}</span>,
          className: "max-xl:hidden",
        },
        {
          header: "Déposé le",
          cell: (d) => <span className="text-gray-700">{formatDate(d.createdAt)}</span>,
        },
        {
          header: "État",
          cell: (d) => <States document={d} otherParcours={otherParcours(d)} />,
        },
        { header: "Validité", cell: (d) => <ValidityTag validity={validity(d, today)} /> },
      ]}
      mobile={(d) => (
        <div className="flex gap-3">
          <Miniature document={d} label={typeLabel(d.documentType, types)} />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            {open(d)}
            <span className="text-sm text-gray-600">
              {familyLabel(familyOf(d))} · déposé le {formatDate(d.createdAt)}
            </span>
            <div className="flex flex-wrap gap-1.5">
              <ValidityTag validity={validity(d, today)} />
              <States document={d} otherParcours={otherParcours(d)} />
            </div>
          </div>
        </div>
      )}
    />
  );
}

function Miniature({ document, label }: { document: DocumentView; label: string }) {
  return (
    <span className="relative flex h-14 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md border border-gray-200 bg-gray-50 text-gray-500 [&>img]:absolute [&>img]:inset-0 [&>img]:size-full [&>img]:bg-white [&>img]:object-cover">
      <DocumentIcon />
      <Thumbnail id={document.id} label={label} />
    </span>
  );
}

function States({ document, otherParcours }: { document: DocumentView; otherParcours: boolean }) {
  const tags = [
    document.status !== "ACTIF" && (
      <Tag key="s" variant="info">
        {statusLabel(document.status)}
      </Tag>
    ),
    document.verification && (
      <Tag key="v" variant="warning">
        Type à vérifier
      </Tag>
    ),
    otherParcours && <Tag key="p">Autre parcours</Tag>,
    document.sensitivity !== "STANDARD" && (
      <Tag key="n">{SENSITIVITY_LABELS[document.sensitivity]}</Tag>
    ),
  ].filter(Boolean);
  return tags.length > 0 ? (
    <span className="flex flex-wrap gap-1.5">{tags}</span>
  ) : (
    <span className="text-gray-600">—</span>
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
    SANS_ECHEANCE: { variant: "default", text: () => "Sans échéance" },
  };

function until(v: Validity): string {
  return "until" in v ? formatDate(v.until) : "";
}

function ValidityTag({ validity: v }: { validity: Validity }) {
  return <Tag variant={VALIDITY[v.state].variant}>{VALIDITY[v.state].text(v)}</Tag>;
}

/** Bris de glace (rôle dédié) : motif tracé, pour inclure les documents restreints du dossier. */
function BreakGlass({ onApply }: { onApply: (access: Access) => void }) {
  const [reason, setReason] = useState("");
  return (
    <Section title="Documents restreints">
      <form
        aria-label="Bris de glace"
        className="flex flex-col gap-3 md:flex-row md:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          if (reason.trim()) onApply({ breakGlassReason: reason.trim() });
        }}
      >
        <div className="flex-1">
          <TextAreaField
            label="Motif de bris de glace"
            description="Accès exceptionnel, tracé et contrôlé."
            rows={1}
            maxLength={255}
            value={reason}
            onChange={(e) => {
              setReason(e.currentTarget.value);
            }}
          />
        </div>
        <Button type="submit" variant="secondary" disabled={!reason.trim()}>
          Inclure les documents restreints
        </Button>
      </form>
    </Section>
  );
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
