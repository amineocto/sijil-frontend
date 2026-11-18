import { messages } from "@/i18n/messages";
import type { ApiError } from "@/http/ApiError";

export interface ErrorStateProps {
  error: Pick<ApiError, "message" | "correlationId">;
  title?: string;
  /** Si fourni, un bouton permet de relancer la requête. */
  onRetry?: () => void;
  retryLabel?: string;
}

/**
 * État « erreur » : message lisible et `correlationId` affiché, pour que l'utilisateur puisse le
 * communiquer au support (09-fronts.md).
 */
export function ErrorState({
  error,
  title = messages.errorTitle,
  onRetry,
  retryLabel = messages.errorRetry,
}: ErrorStateProps) {
  return (
    <div className="sijil-state sijil-state--error" role="alert">
      <h2 className="sijil-state__title">{title}</h2>
      <p>{error.message}</p>
      {error.correlationId && (
        <p className="sijil-state__reference">
          {messages.correlationLabel} : <span>{error.correlationId}</span>
        </p>
      )}
      {onRetry && (
        <button type="button" className="sijil-button" onClick={onRetry}>
          {retryLabel}
        </button>
      )}
    </div>
  );
}
