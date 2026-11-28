import { useState } from "react";
import { Avatar } from "@awb/ui";
import { Link, useNavigate } from "react-router";
import { CompletenessPanel } from "@/features/completeness/CompletenessPanel";
import { dossierPath } from "@/features/dossier/paths";
import { recentDossiers } from "@/shared/recentDossiers";
import { FullTextSearch } from "@/features/search/FullTextSearch";
import { formatDate, PARTY_OPTIONS, PARTY_TYPE_LABELS } from "@/shared/labels";
import { useSession } from "@/shared/session";
import type { PartyType } from "@/shared/types";
import { Button, SelectField, TextField } from "@/shared/ui";
import { Page, Section } from "@/shared/ui/page";
import { textProblem } from "@/shared/validation";
import { useRefusedSubmit } from "@/shared/refusedSubmit";

export type SearchMode = "dossier" | "texte" | "completude";

const TABS = [
  { label: "Dossier", to: "/", end: true },
  { label: "Plein texte", to: "/recherche/plein-texte" },
  { label: "Complétude", to: "/recherche/completude" },
];

/**
 * Écran « Recherche » : ouvrir le dossier d'un client, d'une personne ou d'un compte, chercher dans
 * le contenu des documents, ou évaluer la complétude d'un dossier à plusieurs parties. Chaque mode
 * est un onglet d'écran, avec son adresse.
 */
export function SearchPage({ mode = "dossier" }: { mode?: SearchMode }) {
  return (
    <Page title="Rechercher" tabs={TABS} tabsLabel="Modes de recherche" width="wide">
      {mode === "dossier" && <DossierLookup />}
      {mode === "texte" && <FullTextSearch />}
      {mode === "completude" && <CompletenessPanel />}
    </Page>
  );
}

export const FullTextSearchPage = () => <SearchPage mode="texte" />;
export const CompletenessSearchPage = () => <SearchPage mode="completude" />;

function DossierLookup() {
  const navigate = useNavigate();
  const [type, setType] = useState<PartyType>("CLIENT");
  const [id, setId] = useState("");
  const [checked, setChecked] = useState(false);
  const problem = textProblem(id, { required: true, max: 64 });
  const { container: formRef, refuse, summary: problemSummary } = useRefusedSubmit(problem ? 1 : 0);
  const session = useSession();
  const recents = recentDossiers(session.data?.user);
  return (
    <>
      <Section title="Ouvrir un dossier">
        <p className="mb-4 text-sm text-gray-600">
          Toutes les pièces d&apos;un client, d&apos;une personne ou d&apos;un compte, classées par
          famille avec leur validité.
        </p>
        <form
          ref={formRef}
          aria-label="Ouvrir un dossier depuis la recherche"
          className="grid gap-4 sm:grid-cols-[12rem_1fr_auto] sm:items-end"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            setChecked(true);
            if (!problem) void navigate(dossierPath(type, id.trim()));
            else refuse();
          }}
        >
          <SelectField
            label="Partie"
            options={PARTY_OPTIONS}
            value={type}
            onChange={(e) => {
              setType(e.currentTarget.value as PartyType);
            }}
          />
          <TextField
            label="Identifiant"
            required
            placeholder="Ex. C123456"
            maxLength={64}
            error={checked ? problem : undefined}
            value={id}
            onChange={(e) => {
              setId(e.currentTarget.value);
            }}
          />
          <Button type="submit">Ouvrir le dossier</Button>
        </form>
        {problemSummary}
      </Section>
      {recents.length > 0 && (
        <section aria-labelledby="dossiers-recents">
          <h2
            id="dossiers-recents"
            className="mb-3 text-xs font-bold tracking-wide text-gray-600 uppercase"
          >
            Dossiers récemment ouverts
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {recents.map((r) => {
              const name = `${PARTY_TYPE_LABELS[r.type] ?? r.type} ${r.id}`;
              return (
                <li key={`${r.type}-${r.id}`}>
                  <Link
                    to={dossierPath(r.type, r.id)}
                    className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-xs transition-all hover:border-orange-300 hover:shadow-md focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:outline-none"
                  >
                    <Avatar
                      size="md"
                      name={name}
                      style={{ backgroundColor: "var(--color-orange-700)" }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-gray-900">{name}</span>
                      <span className="block truncate text-sm text-gray-600">
                        Ouvert le {formatDate(r.openedAt)}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
