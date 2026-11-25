import { useWatch, type UseFormReturn } from "react-hook-form";
import type { EditorValues } from "@/features/catalogue/draft-editor/form";

export type Json = Record<string, unknown>;

/**
 * Une clé de la définition (`retention`, `formats`…) éditée par des champs : elle reste stockée en
 * texte JSON dans le formulaire (`json.<clé>`), comme en mode avancé ; les champs la lisent et la
 * réécrivent. Le serveur reste juge, contrôles complets à la soumission.
 */
export interface Part<T> {
  /** Valeur lue ; `undefined` si la rubrique est vide. */
  value: T | undefined;
  /** Faux si le texte n'est pas du JSON (à corriger en mode avancé). */
  valid: boolean;
  set: (next: T | undefined) => void;
}

export function usePart<T>(form: UseFormReturn<EditorValues>, key: string): Part<T> {
  const text = useWatch({ control: form.control, name: `json.${key}` });
  const { value, valid } = parse(text);
  return {
    value: value as T | undefined,
    valid,
    set: (next) => {
      form.setValue(`json.${key}`, next === undefined ? "" : JSON.stringify(next, null, 2), {
        shouldDirty: true,
        shouldValidate: true,
      });
    },
  };
}

export function parse(text: string): { value: unknown; valid: boolean } {
  if (text.trim() === "") return { value: undefined, valid: true };
  try {
    return { value: JSON.parse(text) as unknown, valid: true };
  } catch {
    return { value: undefined, valid: false };
  }
}

/** Objet sans ses clés vides (`undefined`, chaîne vide) : le schéma les refuserait. */
export function compact<T extends Json>(object: T): T {
  return Object.fromEntries(
    Object.entries(object).filter(([, v]) => v !== undefined && v !== ""),
  ) as T;
}

/** Objet de la rubrique, ou un objet vide pour une rubrique encore vide. */
export function objectOf(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : {};
}

export function stringsOf(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/** Texte d'une valeur de la définition (chaîne ou nombre), vide sinon. */
export function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

/** Objet sans les clés données. */
export function omit(object: Json, keys: readonly string[]): Json {
  return Object.fromEntries(Object.entries(object).filter(([k]) => !keys.includes(k)));
}
