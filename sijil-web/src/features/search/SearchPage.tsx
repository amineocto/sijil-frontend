import { CompletenessPanel } from "@/features/completeness/CompletenessPanel";
import { PartyLookup } from "@/features/dossier/PartyLookup";
import { FullTextSearch } from "@/features/search/FullTextSearch";
import { Heading, Muted, Panel, Tabs } from "@/shared/ui";

/**
 * Écran « Recherche » : ouvrir le dossier d'un client, d'une personne ou d'un compte, chercher dans
 * le contenu des documents, ou évaluer la complétude d'un dossier à plusieurs parties.
 */
export function SearchPage() {
  return (
    <div className="flex flex-col gap-6">
      <Heading>Rechercher</Heading>
      <Tabs
        label="Modes de recherche"
        tabs={[
          { id: "dossier", label: "Dossier", content: <DossierLookup /> },
          { id: "texte", label: "Plein texte", content: <FullTextSearch /> },
          { id: "completude", label: "Complétude", content: <CompletenessPanel /> },
        ]}
      />
    </div>
  );
}

function DossierLookup() {
  return (
    <Panel className="flex max-w-3xl flex-col gap-4">
      <Heading level={3}>Ouvrir un dossier</Heading>
      <Muted>
        Toutes les pièces d&apos;un client, d&apos;une personne ou d&apos;un compte, classées par
        famille avec leur validité. La même recherche est toujours en haut de l&apos;écran.
      </Muted>
      <PartyLookup label="Ouvrir un dossier depuis la recherche" className="h-12" />
    </Panel>
  );
}
