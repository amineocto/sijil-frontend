import type { MetadataProperty, MetadataSchema } from "@/shared/types";

/** Champ du formulaire généré depuis le schéma de métadonnées du type. */
export interface MetadataField {
  name: string;
  label: string;
  kind: "text" | "date" | "number" | "boolean" | "choice";
  required: boolean;
  options: string[];
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  /** Nombre entier (`integer`) plutôt que décimal. */
  integer?: boolean;
}

export function fieldsOf(schema: MetadataSchema | undefined): MetadataField[] {
  const required = new Set(schema?.required ?? []);
  return Object.entries(schema?.properties ?? {}).map(([name, p]) => ({
    name,
    label: p.title ?? name,
    kind: kindOf(p),
    required: required.has(name),
    options: p.enum ?? [],
    ...(p.maxLength === undefined ? {} : { maxLength: p.maxLength }),
    ...(p.minLength === undefined ? {} : { minLength: p.minLength }),
    ...(p.pattern === undefined ? {} : { pattern: p.pattern }),
    ...(p.minimum === undefined ? {} : { minimum: p.minimum }),
    ...(p.maximum === undefined ? {} : { maximum: p.maximum }),
    ...(p.type === "integer" ? { integer: true } : {}),
  }));
}

function kindOf(p: MetadataProperty): MetadataField["kind"] {
  if (p.enum) return "choice";
  if (p.type === "boolean") return "boolean";
  if (p.type === "integer" || p.type === "number") return "number";
  if (p.format === "date") return "date";
  return "text";
}

/** Valeurs saisies (chaînes) → métadonnées typées ; un champ vide est omis. */
export function toMetadata(
  fields: MetadataField[],
  values: Record<string, string>,
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  for (const field of fields) {
    const raw = values[field.name]?.trim() ?? "";
    if (raw === "") continue;
    if (field.kind === "number") metadata[field.name] = Number(raw);
    else if (field.kind === "boolean") metadata[field.name] = raw === "true";
    else metadata[field.name] = raw;
  }
  return metadata;
}

/** Métadonnées → valeurs du formulaire. */
export function toValues(metadata: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(metadata).map(([name, value]) => [name, formatValue(value)]),
  );
}

export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

/** Libellé de repli d'un champ sans « title » : « dateExpiration » devient « Date expiration ». */
export function humanize(name: string): string {
  const words = name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Valeur à lire : une date ISO s'affiche au format français (« 30/06/2030 »). */
export function displayValue(value: unknown): string {
  const text = formatValue(value);
  const date = ISO_DATE.exec(text);
  return date ? `${date[3] ?? ""}/${date[2] ?? ""}/${date[1] ?? ""}` : text;
}
