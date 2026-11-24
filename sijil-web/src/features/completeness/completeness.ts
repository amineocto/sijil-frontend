import type { TagVariant } from "@/shared/ui";
import { api, call, type Schemas } from "@/shared/api";

export type CompletenessRequest = Schemas["CompletenessRequest"];
export type CompletenessResult = Schemas["CompletenessResult"];
export type CompletenessParty = Schemas["CompletenessParty"];
export type CompletenessState = Schemas["CompletenessState"];

export const STATE_LABELS: Record<CompletenessState, string> = {
  SATISFAITE: "Satisfaite",
  MANQUANTE: "Manquante",
  EXPIREE: "Expirée",
  INSUFFISANTE: "Insuffisante",
  NON_APPLICABLE: "Sans objet",
};

export const STATE_COLORS: Record<CompletenessState, TagVariant> = {
  SATISFAITE: "success",
  MANQUANTE: "danger",
  EXPIREE: "warning",
  INSUFFISANTE: "warning",
  NON_APPLICABLE: "default",
};

export const ROLE_LABELS: Record<CompletenessParty["role"], string> = {
  TITULAIRE: "Titulaire",
  CO_TITULAIRE: "Co-titulaire",
  GARANT: "Garant",
  MANDATAIRE: "Mandataire",
  REPRESENTANT_LEGAL: "Représentant légal",
  AUTRE: "Autre",
};

/** Calcul de la façade, avec les droits de l'utilisateur (lot 7). */
export function evaluate(request: CompletenessRequest): Promise<CompletenessResult> {
  return call(api.POST("/api/completeness-evaluations", { body: request }));
}

/** Lignes « clé=valeur » du contexte du dossier ; une ligne mal formée est ignorée. */
export function parseContext(text: string): Record<string, string> {
  const context: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const [key, ...rest] = line.split("=");
    const value = rest.join("=").trim();
    if (key?.trim() && value) context[key.trim()] = value;
  }
  return context;
}

export function partyLabel(party: CompletenessParty | null | undefined): string {
  if (!party) return "—";
  return `${ROLE_LABELS[party.role]} · ${party.externalId}`;
}
