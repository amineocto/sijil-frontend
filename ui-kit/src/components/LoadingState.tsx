import { messages } from "../i18n/messages";

export interface LoadingStateProps {
  label?: string;
}

/** État « chargement » : annoncé poliment aux lecteurs d'écran. */
export function LoadingState({ label = messages.loading }: LoadingStateProps) {
  return (
    <div className="sijil-state" role="status" aria-live="polite">
      <span className="sijil-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
