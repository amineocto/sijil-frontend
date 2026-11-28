import { navigation } from "@/shared/api";
import { Button, ButtonLink, Notice } from "@/shared/ui";
import { Page } from "@/shared/ui/page";

export function RouteError() {
  return (
    <Page title="Cet écran n'a pas pu s'afficher" width="narrow">
      <div className="flex flex-col items-start gap-4">
        <Notice tone="danger" role="alert" title="Une erreur est survenue">
          Rechargez la page. Si le problème revient, signalez-le au support en indiquant
          l&apos;écran et l&apos;heure.
        </Notice>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => {
              navigation.assign(globalThis.location.href);
            }}
          >
            Recharger la page
          </Button>
          <ButtonLink to="/" variant="secondary">
            Revenir à la recherche
          </ButtonLink>
        </div>
      </div>
    </Page>
  );
}
