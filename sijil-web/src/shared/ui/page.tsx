import type { ReactNode } from "react";
import { NavLink } from "react-router";
import { NARROW, useMedia } from "@/shared/ui/media";

export interface PageTab {
  label: string;
  to: string;
  /** Actif seulement sur cette adresse exacte (onglet par défaut). */
  end?: boolean;
}

/**
 * Écran du poste CRC : bandeau blanc pleine largeur (titre, sous-titre, actions, onglets d'écran en
 * liens), puis le contenu sur fond gris. Les onglets sont des adresses : un onglet se partage et se
 * rouvre, comme dans le poste CRC.
 */
export function Page({
  title,
  subtitle,
  leading,
  actions,
  tabs,
  tabsLabel,
  width = "full",
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  actions?: ReactNode;
  tabs?: PageTab[] | undefined;
  tabsLabel?: string;
  /** Largeur du contenu : pleine, ou bornée pour un formulaire ou une lecture. */
  width?: "full" | "wide" | "narrow";
  children: ReactNode;
}) {
  const bound = { full: "", wide: "mx-auto max-w-6xl", narrow: "mx-auto max-w-3xl" }[width];
  return (
    <div className="flex min-h-full flex-col">
      <div className="bg-white px-4 pt-5 shadow-sm sm:px-6 xl:px-8">
        <div
          className={`flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${tabs ? "" : "pb-5"}`}
        >
          <div className="flex min-w-0 items-center gap-4">
            {leading}
            <div className="flex min-w-0 flex-col gap-1.5">
              <h1 className="text-xl font-bold break-words text-gray-900 sm:text-2xl">{title}</h1>
              {subtitle && (
                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                  {subtitle}
                </div>
              )}
            </div>
          </div>
          {actions && <div className="flex flex-wrap gap-2 sm:shrink-0 sm:gap-3">{actions}</div>}
        </div>
        {tabs && (
          <nav
            aria-label={tabsLabel ?? "Rubriques"}
            className="-mx-4 mt-4 flex overflow-x-auto px-4 [scrollbar-width:none] sm:-mx-6 sm:px-6 xl:-mx-8 xl:px-8"
          >
            {tabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end ?? false}
                className="shrink-0 border-b-2 border-transparent px-3 py-2.5 text-sm font-semibold whitespace-nowrap text-gray-600 transition-colors hover:border-orange-500 hover:bg-orange-50 hover:text-orange-700 focus-visible:bg-orange-50 focus-visible:outline-none aria-[current=page]:border-orange-700 aria-[current=page]:text-orange-700 xl:px-4 xl:text-base"
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>
        )}
      </div>
      <div className="flex-1 p-4 sm:p-6 xl:p-8">
        <div className={`flex flex-col gap-5 ${bound}`}>{children}</div>
      </div>
    </div>
  );
}

/** Carte de section du poste CRC : titre et action dans un bandeau, contenu en dessous. */
export function Section({
  title,
  action,
  children,
  className = "",
  bodyClassName = "p-5",
}: {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`rounded-xl border border-gray-200 bg-white shadow-xs ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-3.5">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {action}
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/** Paires libellé et valeur, sur une à trois colonnes selon la largeur. */
export function KeyValues({
  items,
  columns = 2,
}: {
  items: [string, ReactNode][];
  columns?: 1 | 2 | 3;
}) {
  const grid = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 xl:grid-cols-3" }[columns];
  return (
    <dl className={`grid gap-x-6 gap-y-4 text-sm ${grid}`}>
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-xs font-semibold text-gray-600">{k}</dt>
          <dd className="mt-0.5 break-words text-gray-900">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  align?: "end";
}

/**
 * Tableau du poste CRC : en-tête gris et lignes séparées ; sous 768 px, chaque ligne devient une
 * carte (`mobile`), lisible sans défilement horizontal.
 */
export function DataTable<T>({
  label,
  columns,
  rows,
  rowKey,
  mobile,
  toolbar,
  footer,
}: {
  label: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  mobile: (row: T) => ReactNode;
  toolbar?: ReactNode;
  footer?: ReactNode;
}) {
  const narrow = useMedia(NARROW);
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xs">
      {toolbar && <div className="border-b border-gray-200 p-4">{toolbar}</div>}
      {narrow ? (
        <ul className="divide-y divide-gray-100" aria-label={label}>
          {rows.map((row) => (
            <li key={rowKey(row)} className="p-4">
              {mobile(row)}
            </li>
          ))}
        </ul>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label={label}>
            <thead className="bg-gray-50 text-start text-xs font-semibold tracking-wide text-gray-600 uppercase">
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.header}
                    scope="col"
                    className={`px-4 py-3 ${c.align === "end" ? "text-end" : "text-start"} ${c.className ?? ""}`}
                  >
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr key={rowKey(row)} className="hover:bg-orange-25">
                  {columns.map((c) => (
                    <td
                      key={c.header}
                      className={`px-4 py-3 align-middle text-gray-900 ${c.align === "end" ? "text-end" : ""} ${c.className ?? ""}`}
                    >
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {footer && <div className="border-t border-gray-200 px-4 py-3">{footer}</div>}
    </div>
  );
}
