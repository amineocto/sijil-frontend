import { Page } from "@/shared/ui/page";
import { ButtonLink, Muted } from "@/shared/ui";

export function NotFoundPage() {
  return (
    <Page title="Page introuvable" width="narrow">
      <div className="flex flex-col items-start gap-4">
        <Muted>
          Cette adresse ne correspond à aucun écran de Sijil. Elle a peut-être changé, ou le lien
          est incomplet.
        </Muted>
        <ButtonLink to="/">Revenir à la recherche</ButtonLink>
      </div>
    </Page>
  );
}
