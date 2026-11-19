import { useId, type ReactNode } from "react";
import { messages } from "../i18n/messages";
import { Heading, type HeadingLevel } from "./Heading";

export interface EmptyStateProps {
  title?: string;
  description?: string;
  /** Action proposée, par exemple « Ajouter un document ». */
  action?: ReactNode;
  /** Niveau du titre dans la page (2 par défaut). */
  headingLevel?: HeadingLevel;
}

/** État « vide » : la requête a réussi mais ne renvoie rien. */
export function EmptyState({
  title = messages.emptyTitle,
  description,
  action,
  headingLevel = 2,
}: EmptyStateProps) {
  const titleId = useId();
  return (
    <section className="sijil-state" aria-labelledby={titleId}>
      <Heading id={titleId} level={headingLevel}>
        {title}
      </Heading>
      {description && <p>{description}</p>}
      {action}
    </section>
  );
}
