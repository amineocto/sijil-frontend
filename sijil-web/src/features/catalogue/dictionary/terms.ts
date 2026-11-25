import { useQuery } from "@tanstack/react-query";
import { api, call, type Schemas } from "@/shared/api";

/** Terme du dictionnaire de métadonnées (ADR 0038). */
export type Term = Schemas["MetadataTerm"];
export type TermFormat = Schemas["MetadataFormat"];

export const FORMAT_LABELS: Record<TermFormat, string> = {
  TEXT: "Texte",
  DATE: "Date",
  INTEGER: "Nombre entier",
  NUMBER: "Nombre décimal",
  BOOLEAN: "Oui ou non",
  ENUM: "Liste de valeurs",
};

export const PERSONAL_DATA_LABELS: Record<Schemas["PersonalData"], string> = {
  AUCUNE: "Aucune",
  PERSONNELLE: "Personnelle",
  SENSIBLE: "Sensible",
};

export const STATUS_LABELS: Record<Schemas["MetadataTermStatus"], string> = {
  ACTIF: "Actif",
  DEPRECIE: "Déprécié",
  RETIRE: "Retiré",
};

/** Dictionnaire complet, lu une fois par écran. */
export function useTerms() {
  return useQuery({
    queryKey: ["metadata-terms"],
    queryFn: () => call(api.GET("/api/metadata-terms")),
  });
}

/** Contraintes d'un terme, en une ligne lisible. */
export function constraintsOf(term: Term): string {
  const parts: string[] = [];
  if (term.maxLength != null) parts.push(`${String(term.maxLength)} caractères au plus`);
  if (term.pattern) parts.push(`motif ${term.pattern}`);
  if (term.values.length) parts.push(`valeurs : ${term.values.join(", ")}`);
  if (term.minimum != null && term.maximum != null) {
    parts.push(`entre ${String(term.minimum)} et ${String(term.maximum)}`);
  } else if (term.minimum != null) {
    parts.push(`au moins ${String(term.minimum)}`);
  } else if (term.maximum != null) {
    parts.push(`au plus ${String(term.maximum)}`);
  }
  return parts.join(" · ") || "—";
}

/**
 * Propriété du schéma JSON qui traduit le terme, comme la recopie le catalogue à la soumission :
 * l'aperçu et la validité de l'éditeur voient ainsi ce que le dépôt exigera.
 */
export function schemaOf(term: Term): Record<string, unknown> {
  const type =
    term.format === "BOOLEAN"
      ? "boolean"
      : term.format === "INTEGER"
        ? "integer"
        : term.format === "NUMBER"
          ? "number"
          : "string";
  const property: Record<string, unknown> = { type };
  if (term.format === "DATE") property["format"] = "date";
  if (term.maxLength != null) property["maxLength"] = term.maxLength;
  if (term.pattern) property["pattern"] = term.pattern;
  if (term.values.length) property["enum"] = term.values;
  if (term.minimum != null) property["minimum"] = term.minimum;
  if (term.maximum != null) property["maximum"] = term.maximum;
  property["title"] = term.labelFr;
  return property;
}
