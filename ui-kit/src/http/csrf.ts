/** Cookie et en-tête du jeton CSRF synchronisé de Spring Security (05-securite.md). */
export const CSRF_COOKIE = "XSRF-TOKEN";
export const CSRF_HEADER = "X-XSRF-TOKEN";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS", "TRACE"]);

export function isUnsafeMethod(method: string): boolean {
  return !SAFE_METHODS.has(method.toUpperCase());
}

/** Lit le jeton CSRF déposé par le BFF dans un cookie lisible par la page (même origine). */
export function readCsrfToken(cookies: string = document.cookie): string | undefined {
  for (const cookie of cookies.split(";")) {
    const [name, ...value] = cookie.trim().split("=");
    if (name === CSRF_COOKIE) {
      return decodeURIComponent(value.join("="));
    }
  }
  return undefined;
}

/**
 * Middleware compatible `openapi-fetch` : ajoute le jeton CSRF aux méthodes non sûres. Les clients
 * générés depuis l'OpenAPI du BFF l'enregistrent avec `client.use(csrfMiddleware)`.
 */
export const csrfMiddleware = {
  onRequest({ request }: { request: Request }): Request {
    const token = readCsrfToken();
    if (token && isUnsafeMethod(request.method)) {
      request.headers.set(CSRF_HEADER, token);
    }
    return request;
  },
};
