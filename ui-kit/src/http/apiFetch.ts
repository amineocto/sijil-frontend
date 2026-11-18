import { ApiError, networkError, type ProblemDetails } from "@/http/ApiError";
import { CSRF_HEADER, isUnsafeMethod, readCsrfToken } from "@/http/csrf";

const CORRELATION_HEADER = "X-Correlation-Id";

export interface ApiRequest {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/**
 * Appel JSON au BFF de la même origine : cookie de session, jeton CSRF sur les méthodes non sûres,
 * erreurs converties en {@link ApiError}. Le navigateur ne manipule jamais de jeton d'accès.
 */
export async function apiFetch<T>(path: string, request: ApiRequest = {}): Promise<T> {
  const method = (request.method ?? "GET").toUpperCase();
  const headers = new Headers({ Accept: "application/json", ...request.headers });
  if (request.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  const csrf = readCsrfToken();
  if (csrf && isUnsafeMethod(method)) {
    headers.set(CSRF_HEADER, csrf);
  }
  const init: RequestInit = { method, headers, credentials: "same-origin" };
  if (request.body !== undefined) init.body = JSON.stringify(request.body);
  if (request.signal) init.signal = request.signal;

  let response: Response;
  try {
    response = await fetch(path, init);
  } catch (error) {
    if (isAbort(error)) throw error;
    throw networkError();
  }
  if (!response.ok) {
    throw await toApiError(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  try {
    return (await response.json()) as T;
  } catch {
    // Réponse 2xx illisible : on l'affiche comme une erreur standard, avec sa référence.
    throw new ApiError(response.status, {}, response.headers.get(CORRELATION_HEADER) ?? undefined);
  }
}

/** Convertit une réponse en erreur, que le corps soit un Problem Details ou non. */
export async function toApiError(response: Response): Promise<ApiError> {
  const correlationId = response.headers.get(CORRELATION_HEADER) ?? undefined;
  let problem: ProblemDetails = {};
  const contentType = response.headers.get("Content-Type") ?? "";
  if (contentType.includes("json")) {
    try {
      problem = (await response.json()) as ProblemDetails;
    } catch {
      problem = {};
    }
  }
  return new ApiError(response.status, problem, correlationId);
}

/** Comparaison par nom : une `DOMException` peut venir d'un autre royaume (iframe, jsdom). */
function isAbort(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && "name" in error && error.name === "AbortError"
  );
}
