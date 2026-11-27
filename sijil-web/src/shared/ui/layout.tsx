import {
  useId,
  useState,
  type HTMLAttributes,
  type ReactNode,
  type TableHTMLAttributes,
  type ThHTMLAttributes,
} from "react";
import { Alert, AlertDescription, AlertTitle, Badge, type BadgeProps } from "@awb/ui";
import { Link, type LinkProps } from "react-router";
import { twMerge } from "tailwind-merge";

/** Titre de page (h2) ou de section (h3, h4), à la typographie de la charte. */
export function Heading({
  level = 2,
  children,
  className,
}: {
  level?: 2 | 3 | 4;
  children: ReactNode;
  className?: string;
}) {
  const Tag = `h${String(level)}` as "h2" | "h3" | "h4";
  const size = { 2: "text-2xl", 3: "text-lg", 4: "text-base" }[level];
  return (
    <Tag className={twMerge(`${size} font-semibold text-gray-900`, className)}>{children}</Tag>
  );
}

/** Texte secondaire, au contraste vérifié (gray-600 : 7,1:1). */
export function Muted({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={twMerge("text-sm text-gray-600", className)}>{children}</p>;
}

/** Lien interne de l'application. */
export function TextLink({ className, ...props }: LinkProps) {
  return (
    <Link
      {...props}
      className={twMerge(
        "font-medium text-orange-700 underline-offset-2 hover:underline focus-visible:underline",
        typeof className === "string" ? className : undefined,
      )}
    />
  );
}

/** Carte blanche de la charte, cadre des sections d'un écran. */
export function Panel({ children, className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      {...props}
      className={twMerge("rounded-xl border border-gray-200 bg-white p-6 shadow-xs", className)}
    >
      {children}
    </section>
  );
}

export type Tone = "info" | "success" | "warning" | "danger" | "default";

/** Message de la charte (`Alert` d'`@awb/ui`), annoncé par défaut comme une alerte. */
export function Notice({
  tone = "default",
  title,
  children,
  role,
}: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  role?: "alert" | "status" | "note";
}) {
  return (
    <Alert variant={tone} {...(role ? { role } : {})}>
      {title && <AlertTitle>{title}</AlertTitle>}
      {children && <AlertDescription>{children}</AlertDescription>}
    </Alert>
  );
}

export type TagVariant = NonNullable<BadgeProps["variant"]>;

/** Étiquette d'état (`Badge` d'`@awb/ui`). */
export function Tag({
  variant = "default",
  children,
}: {
  variant?: TagVariant;
  children: ReactNode;
}) {
  return (
    <Badge variant={variant} size="sm" className="gap-1 whitespace-nowrap">
      {children}
    </Badge>
  );
}

/**
 * Tableau de la charte : en-tête gris, lignes séparées, défilement horizontal si besoin. `bare` :
 * sans cadre propre, quand une carte l'entoure déjà (pas de double bordure).
 */
export function Table({
  className,
  bare = false,
  ...props
}: TableHTMLAttributes<HTMLTableElement> & { bare?: boolean }) {
  return (
    <div
      className={
        bare
          ? "w-full overflow-x-auto [&_tr>*:first-child]:ps-6 [&_tr>*:last-child]:pe-6"
          : "w-full overflow-x-auto rounded-lg border border-gray-200 bg-white"
      }
    >
      <table
        {...props}
        className={twMerge(
          "w-full border-collapse text-sm [&_thead_th]:bg-gray-50 [&_thead_th]:text-xs [&_thead_th]:font-semibold [&_thead_th]:tracking-wide [&_thead_th]:text-gray-600 [&_thead_th]:uppercase",
          className,
        )}
      />
    </div>
  );
}

export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      {...props}
      className={twMerge(
        "border-b border-gray-200 bg-gray-100 px-4 py-3 text-start font-semibold text-gray-700",
        className,
      )}
    />
  );
}

export function Td({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      {...props}
      className={twMerge("border-b border-gray-100 px-4 py-3 text-gray-900", className)}
    />
  );
}

/** Barre de progression nommée (celle d'`@awb/ui` n'expose ni rôle ni valeur). */
export function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
      className="h-2 w-full overflow-hidden rounded-full bg-gray-200"
    >
      <div className="h-full bg-orange-700 transition-all" style={{ width: `${String(value)}%` }} />
    </div>
  );
}

const BUTTON_LINK = {
  primary: "bg-orange-700 text-white hover:bg-orange-800",
  secondary: "border border-orange-300 bg-orange-100 text-orange-700 hover:bg-orange-200",
};

/** Lien présenté comme un bouton de la charte ; désactivé, il n'est plus suivi. */
export function ButtonLink({
  variant = "primary",
  disabled = false,
  className,
  onClick,
  ...props
}: LinkProps & { variant?: "primary" | "secondary"; disabled?: boolean }) {
  return (
    <Link
      {...props}
      aria-disabled={disabled || undefined}
      onClick={(event) => {
        if (disabled) event.preventDefault();
        else onClick?.(event);
      }}
      className={twMerge(
        "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 font-semibold transition-all",
        BUTTON_LINK[variant],
        disabled && "pointer-events-none opacity-50",
        typeof className === "string" ? className : undefined,
      )}
    />
  );
}

/** Bloc de code de la charte (JSON d'une définition). */
export function CodeBlock({ children, ...props }: HTMLAttributes<HTMLPreElement>) {
  return (
    <pre
      {...props}
      className="overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-xs break-words whitespace-pre-wrap text-gray-900"
    >
      {children}
    </pre>
  );
}

export interface Tab {
  id: string;
  label: ReactNode;
  content: ReactNode;
}

/**
 * Onglets au style de ceux d'`@awb/ui`, l'onglet actif en orange-700 : le leur (orange-600 sur
 * blanc, 4,0:1) n'atteint pas 4,5:1 et ne prend pas de classe. `keepMounted` garde les panneaux
 * cachés montés, pour qu'un formulaire garde sa saisie et ses erreurs d'une rubrique à l'autre.
 */
export function Tabs({
  tabs,
  label,
  keepMounted = false,
}: {
  tabs: Tab[];
  label: string;
  keepMounted?: boolean;
}) {
  const [selected, setSelected] = useState(tabs[0]?.id);
  const prefix = useId();
  return (
    <div>
      <div
        role="tablist"
        aria-label={label}
        className="flex w-full overflow-x-auto border-b border-gray-200 [scrollbar-width:none]"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`${prefix}-${tab.id}`}
            aria-selected={selected === tab.id}
            aria-controls={`${prefix}-${tab.id}-panneau`}
            onClick={() => {
              setSelected(tab.id);
            }}
            className="-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 border-transparent px-4 py-2.5 text-sm font-semibold whitespace-nowrap text-gray-600 transition-colors hover:border-orange-500 hover:bg-orange-50 hover:text-orange-700 aria-selected:border-orange-700 aria-selected:text-orange-700"
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs
        .filter((tab) => keepMounted || tab.id === selected)
        .map((tab) => (
          <div
            key={tab.id}
            role="tabpanel"
            id={`${prefix}-${tab.id}-panneau`}
            aria-labelledby={`${prefix}-${tab.id}`}
            hidden={selected !== tab.id}
            className="mt-4 flex flex-col gap-4"
          >
            {tab.content}
          </div>
        ))}
    </div>
  );
}
