import { Notice, TextLink } from "@/shared/ui";

/** Brouillon ou soumission demandés pour un type sans version en préparation. */
export function NoDraft({ code }: { code: string }) {
  return (
    <Notice tone="info" title="Aucun brouillon en cours" role="note">
      Ce type n&apos;a pas de version en préparation. Ouvrez une nouvelle version depuis{" "}
      <TextLink to={`/catalogue/types/${code}`}>sa fiche</TextLink>.
    </Notice>
  );
}
