import type { ReactNode } from "react";
import { messages } from "@/i18n/messages";

export interface EmptyStateProps {
  title?: string;
  description?: string;
  /** Action proposée, par exemple « Ajouter un document ». */
  action?: ReactNode;
}

/** État « vide » : la requête a réussi mais ne renvoie rien. */
export function EmptyState({ title = messages.emptyTitle, description, action }: EmptyStateProps) {
  return (
    <section className="sijil-state" aria-label={title}>
      <h2 className="sijil-state__title">{title}</h2>
      {description && <p>{description}</p>}
      {action}
    </section>
  );
}
