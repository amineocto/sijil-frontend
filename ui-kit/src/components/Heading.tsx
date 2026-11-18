import type { ReactNode } from "react";

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

const TAGS = { 1: "h1", 2: "h2", 3: "h3", 4: "h4", 5: "h5", 6: "h6" } as const;

interface HeadingProps {
  level: HeadingLevel;
  id?: string;
  children: ReactNode;
}

/** Titre d'un état, au niveau voulu par la page pour garder une hiérarchie cohérente. */
export function Heading({ level, id, children }: HeadingProps) {
  const Tag = TAGS[level];
  return (
    <Tag id={id} className="sijil-state__title">
      {children}
    </Tag>
  );
}
