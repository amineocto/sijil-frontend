import createClient from "openapi-fetch";
import { ApiError, csrfMiddleware, networkError } from "@sijil/ui-kit";
import type { components, paths } from "@/api/schema";

export type Schemas = components["schemas"];
export type TypeStatus = Schemas["TypeStatus"];
export type Definition = Record<string, unknown>;

/** Client du BFF (même origine, cookie de session, jeton CSRF sur les écritures). */
export const api = createClient<paths>({
  baseUrl: globalThis.location.origin,
  // Résolu à chaque appel : un intercepteur (tests, outils) installé après le chargement s'applique.
  fetch: (request) => globalThis.fetch(request),
});
api.use(csrfMiddleware);

interface FetchResult<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

/** Résultat d'un appel `openapi-fetch`, ou {@link ApiError} lisible (message, référence, champs). */
export async function call<T>(request: Promise<FetchResult<T>>): Promise<T> {
  let result: FetchResult<T>;
  try {
    result = await request;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw networkError();
  }
  if (result.response.status === 401) {
    // Session absente ou expirée : le BFF relance la connexion OIDC.
    redirectToLogin();
  }
  if (!result.response.ok || result.error !== undefined) {
    throw new ApiError(
      result.response.status,
      result.error ?? {},
      result.response.headers.get("X-Correlation-Id") ?? undefined,
    );
  }
  return result.data as T;
}

/** Comme {@link call}, avec l'`ETag` de la réponse (révision du document, pour `If-Match`). */
export async function callWithETag<T>(
  request: Promise<FetchResult<T>>,
): Promise<{ data: T; etag: string }> {
  let etag = "";
  const data = await call(
    request.then((result) => {
      etag = result.response.headers.get("ETag") ?? "";
      return result;
    }),
  );
  return { data, etag };
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** Point d'entrée de la connexion OIDC du BFF (code d'autorisation avec PKCE). */
export const LOGIN_PATH = "/oauth2/authorization/sijil";

/** Navigation hors de l'application (connexion, déconnexion) ; remplaçable dans les tests. */
export const navigation = {
  assign(url: string) {
    globalThis.location.assign(url);
  },
};

export function redirectToLogin() {
  navigation.assign(LOGIN_PATH);
}
