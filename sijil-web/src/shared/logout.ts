import { CSRF_HEADER, readCsrfToken } from "@sijil/ui-kit";
import { navigation } from "@/shared/api";
import { forgetRecentDossiers } from "@/shared/recentDossiers";

/**
 * Déconnexion : le BFF close sa session (POST protégé par le jeton CSRF) et rend l'adresse de
 * déconnexion de l'IdP, que le navigateur ouvre pour clore aussi la session OIDC.
 */
export async function logout() {
  forgetRecentDossiers();
  const response = await globalThis.fetch(`${globalThis.location.origin}/logout`, {
    method: "POST",
    credentials: "same-origin",
    headers: { [CSRF_HEADER]: readCsrfToken() ?? "" },
  });
  const body = response.ok ? ((await response.json()) as { redirectUrl?: string }) : {};
  navigation.assign(body.redirectUrl ?? "/");
}
