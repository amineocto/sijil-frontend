import { messages } from "../i18n/messages";
import type { ApiError } from "../http/ApiError";
import { Heading, type HeadingLevel } from "./Heading";

export interface ErrorStateProps {
  error: Pick<ApiError, "message" | "correlationId">;
  title?: string;
  /** Si fourni, un bouton permet de relancer la requête. */
  onRetry?: () => void;
  retryLabel?: string;
  /** Niveau du titre dans la page (2 par défaut). */
  headingLevel?: HeadingLevel;
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
  headingLevel = 2,
}: ErrorStateProps) {
  return (
    <div className="sijil-state sijil-state--error" role="alert">
      <Heading level={headingLevel}>{title}</Heading>
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
