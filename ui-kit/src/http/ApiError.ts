import { messages } from "../i18n/messages";

/** Erreur de champ publiée dans `errors[]` d'un Problem Details. */
export interface FieldError {
  field: string;
  code: string;
}

/** Corps Problem Details (RFC 9457) tel que produit par `api-commons`. */
export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  correlationId?: string;
  errors?: FieldError[];
}

/** Erreur d'appel au BFF, prête à être affichée (message, référence, erreurs par champ). */
export class ApiError extends Error {
  readonly status: number;
  readonly type: string | undefined;
  readonly correlationId: string | undefined;
  readonly fieldErrors: readonly FieldError[];

  constructor(status: number, problem: ProblemDetails, correlationId?: string) {
    super(problem.detail ?? problem.title ?? messages.unexpectedError);
    this.name = "ApiError";
    this.status = status;
    this.type = problem.type;
    this.correlationId = problem.correlationId ?? correlationId;
    this.fieldErrors = problem.errors ?? [];
  }

  /** Erreurs regroupées par champ, pour un formulaire (React Hook Form `setError`). */
  errorsByField(): Record<string, string[]> {
    const byField: Record<string, string[]> = {};
    for (const { field, code } of this.fieldErrors) {
      (byField[field] ??= []).push(code);
    }
    return byField;
  }
}

/** Erreur réseau : le BFF n'a pas répondu (statut 0). */
export function networkError(): ApiError {
  return new ApiError(0, { detail: messages.networkError });
}
