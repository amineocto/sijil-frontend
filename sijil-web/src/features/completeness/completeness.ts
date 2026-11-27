import type { TagVariant } from "@/shared/ui";
import { api, call, type Schemas } from "@/shared/api";
import { PARTY_ROLE_LABELS } from "@/shared/labels";

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

export const ROLE_LABELS: Record<CompletenessParty["role"], string> = PARTY_ROLE_LABELS;

/** Calcul de la façade, avec les droits de l'utilisateur (lot 7). */
export function evaluate(request: CompletenessRequest): Promise<CompletenessResult> {
  return call(api.POST("/api/completeness-evaluations", { body: request }));
}

/** Lignes du contexte mal formées : « clé=valeur », clé d'une lettre puis lettres et chiffres. */
export function contextProblem(text: string): string | undefined {
  const bad = text
    .split("\n")
    .map((line, i) => ({ line: line.trim(), n: i + 1 }))
    .filter(({ line }) => line !== "")
    .filter(({ line }) => {
      const [key, ...rest] = line.split("=");
      return !/^[a-zA-Z][a-zA-Z0-9]{0,31}$/.test(key?.trim() ?? "") || !rest.join("=").trim();
    })
    .map(({ n }) => n);
  return bad.length
    ? `Ligne${bad.length > 1 ? "s" : ""} ${bad.join(", ")} : écrivez clé=valeur, par exemple segment=SALARIE`
    : undefined;
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
