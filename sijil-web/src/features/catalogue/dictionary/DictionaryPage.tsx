import { useState } from "react";
import { EmptyState } from "@sijil/ui-kit";
import { DataTable, Page } from "@/shared/ui/page";
import { QueryState } from "@/shared/QueryState";
import { canGovernDictionary, useSession } from "@/shared/session";
import { Button, Notice, SelectField, Tag, TextField } from "@/shared/ui";
import { TermDrawer } from "@/features/catalogue/dictionary/TermDrawer";
import {
  constraintsOf,
  FORMAT_LABELS,
  PERSONAL_DATA_LABELS,
  STATUS_LABELS,
  type Term,
  useTerms,
} from "@/features/catalogue/dictionary/terms";

type StatusFilter = "" | Term["status"];

/**
 * Écran « Dictionnaire » (ADR 0038) : les termes de métadonnées que les types choisissent en
 * libre-service. Tous les profils du catalogue le lisent ; le Data Office le tient.
 */
export function DictionaryPage() {
  const session = useSession();
  const terms = useTerms();
  const governs = canGovernDictionary(session.data);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<StatusFilter>("");
  // Terme ouvert dans le volet : null pour un nouveau terme, undefined si le volet est fermé.
  const [open, setOpen] = useState<Term | null | undefined>(undefined);
  const [saved, setSaved] = useState<Term | null>(null);

  const matches = (t: Term) => {
    const query = text.trim().toLowerCase();
    return (
      (status === "" || t.status === status) &&
      (query === "" ||
        t.code.toLowerCase().includes(query) ||
        t.labelFr.toLowerCase().includes(query))
    );
  };
  // Le Data Office modifie un terme non retiré ; les autres profils le consultent.
  const editable = (t: Term) => governs && t.status !== "RETIRE";
  const edit = (t: Term) => (
    <Button
      variant="secondary"
      size="sm"
      aria-label={`${editable(t) ? "Modifier" : "Consulter"} ${t.code}`}
      onClick={() => {
        setSaved(null);
        setOpen(t);
      }}
    >
      {editable(t) ? "Modifier" : "Consulter"}
    </Button>
  );

  return (
    <Page
      title="Dictionnaire de métadonnées"
      subtitle="Les métadonnées que les types de document demandent au dépôt. Un type ne choisit que des termes actifs ; leur format et leurs contraintes sont recopiés dans sa version à la soumission."
      actions={
        governs && (
          <Button
            onClick={() => {
              setSaved(null);
              setOpen(null);
            }}
          >
            Nouveau terme
          </Button>
        )
      }
    >
      {!governs && (
        <Notice tone="info" role="note" title="Dictionnaire tenu par le Data Office">
          Vous le consultez en lecture. Pour un terme manquant ou à corriger, adressez-vous au Data
          Office, seul habilité à créer, modifier, déprécier ou retirer un terme.
        </Notice>
      )}
      {saved && (
        <Notice tone="success" role="status" title="Terme enregistré">
          {saved.labelFr} ({saved.code}) est {STATUS_LABELS[saved.status].toLowerCase()}.
        </Notice>
      )}
      <QueryState query={terms}>
        {(items) => {
          const rows = items.filter(matches);
          return (
            <DataTable
              label="Termes du dictionnaire"
              rows={rows}
              rowKey={(t) => t.code}
              toolbar={
                <div className="grid gap-4 sm:grid-cols-2 lg:max-w-2xl">
                  <TextField
                    label="Rechercher"
                    placeholder="Libellé ou nom technique"
                    value={text}
                    onChange={(e) => {
                      setText(e.currentTarget.value);
                    }}
                  />
                  <SelectField
                    label="Statut"
                    options={[
                      { value: "", label: "Tous" },
                      ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
                    ]}
                    value={status}
                    onChange={(e) => {
                      setStatus(e.currentTarget.value as StatusFilter);
                    }}
                  />
                </div>
              }
              footer={
                rows.length === 0 ? (
                  <EmptyState
                    title="Aucun terme"
                    description="Aucun terme ne correspond à la recherche."
                  />
                ) : undefined
              }
              columns={[
                {
                  header: "Terme",
                  cell: (t) => <TermName term={t} />,
                },
                { header: "Format", cell: (t) => FORMAT_LABELS[t.format] },
                {
                  header: "Contraintes",
                  cell: (t) => constraintsOf(t),
                  className: "max-xl:hidden",
                },
                { header: "Donnée personnelle", cell: (t) => PERSONAL_DATA_LABELS[t.personalData] },
                { header: "Statut", cell: (t) => <StatusTag term={t} /> },
                { header: "Action", align: "end" as const, cell: edit },
              ]}
              mobile={(t) => (
                <div className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <TermName term={t} />
                    <StatusTag term={t} />
                  </div>
                  <span className="text-sm text-gray-600">
                    {FORMAT_LABELS[t.format]} · {constraintsOf(t)}
                  </span>
                  <div>{edit(t)}</div>
                </div>
              )}
            />
          );
        }}
      </QueryState>
      {open !== undefined && (
        <TermDrawer
          key={open?.code ?? "nouveau"}
          code={open?.code}
          readOnly={open !== null && !editable(open)}
          onClose={() => {
            setOpen(undefined);
          }}
          onSaved={(term) => {
            setOpen(undefined);
            setSaved(term);
          }}
        />
      )}
    </Page>
  );
}

function TermName({ term }: { term: Term }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="font-semibold">{term.labelFr}</span>
      <span className="font-mono text-xs text-gray-600">{term.code}</span>
    </div>
  );
}

function StatusTag({ term }: { term: Term }) {
  const variant =
    term.status === "ACTIF" ? "success" : term.status === "DEPRECIE" ? "warning" : "default";
  return <Tag variant={variant}>{STATUS_LABELS[term.status]}</Tag>;
}
