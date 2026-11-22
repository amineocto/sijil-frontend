import { z } from "zod";
import type { Definition } from "@/shared/api";
import { JSON_KEYS, topLevelKey } from "@/features/catalogue/shared/rubriques";

export const LEVELS = ["CLIENT", "PERSONNE", "COMPTE"] as const;
export const SENSITIVITIES = ["STANDARD", "SENSIBLE", "RESTREINT"] as const;

const jsonText = z.string().refine(
  (text) => {
    if (text.trim() === "") return true;
    try {
      JSON.parse(text);
      return true;
    } catch {
      return false;
    }
  },
  { message: "JSON invalide" },
);

/** Validation en ligne de l'éditeur ; le serveur reste juge (contrôles complets à la soumission). */
export const editorSchema = z.object({
  labelFr: z.string().trim().min(1, "Le libellé français est obligatoire").max(200),
  labelAr: z.string().max(200),
  labelEn: z.string().max(200),
  family: z
    .string()
    .regex(/^([A-Z][A-Z0-9_]{1,31})?$/, "Majuscules, chiffres et _ (2 à 32 caractères)"),
  level: z.enum(["", ...LEVELS]),
  sensitivity: z.enum(["", ...SENSITIVITIES]),
  json: z.record(z.string(), jsonText),
});

export type EditorValues = z.infer<typeof editorSchema>;

/** Valeurs du formulaire tirées d'une définition (éventuellement incomplète). */
export function toValues(definition: Definition): EditorValues {
  const labels = (definition["labels"] ?? {}) as Record<string, unknown>;
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  return {
    labelFr: text(labels["fr"]),
    labelAr: text(labels["ar"]),
    labelEn: text(labels["en"]),
    family: text(definition["family"]),
    level: oneOf(LEVELS, definition["level"]),
    sensitivity: oneOf(SENSITIVITIES, definition["sensitivity"]),
    json: Object.fromEntries(
      JSON_KEYS.map((key) => [
        key,
        definition[key] === undefined ? "" : JSON.stringify(definition[key], null, 2),
      ]),
    ),
  };
}

/** Définition à enregistrer ; une rubrique vide est omise (brouillon incomplet). */
export function toDefinition(values: EditorValues): Definition {
  const labels: Record<string, string> = { fr: values.labelFr.trim() };
  if (values.labelAr.trim()) labels["ar"] = values.labelAr.trim();
  if (values.labelEn.trim()) labels["en"] = values.labelEn.trim();
  const definition: Definition = { labels };
  if (values.family) definition["family"] = values.family;
  if (values.level) definition["level"] = values.level;
  if (values.sensitivity) definition["sensitivity"] = values.sensitivity;
  for (const [key, text] of Object.entries(values.json)) {
    if (text.trim() !== "") definition[key] = JSON.parse(text) as unknown;
  }
  return definition;
}

const FIELD_OF_POINTER: Record<string, keyof EditorValues> = {
  "/labels/fr": "labelFr",
  "/labels/ar": "labelAr",
  "/labels/en": "labelEn",
  "/labels": "labelFr",
  "/family": "family",
  "/level": "level",
  "/sensitivity": "sensitivity",
};

/** Champ du formulaire qui porte une erreur du serveur (pointeur JSON), s'il y en a un. */
export function fieldOfPointer(pointer: string): string | undefined {
  const field = FIELD_OF_POINTER[pointer];
  if (field) return field;
  const key = topLevelKey(pointer);
  return JSON_KEYS.includes(key) ? `json.${key}` : undefined;
}

function oneOf<T extends string>(allowed: readonly T[], value: unknown): T | "" {
  return allowed.includes(value as T) ? (value as T) : "";
}
