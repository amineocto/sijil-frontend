import type { MetadataField } from "@/shared/metadata";

/**
 * Contrôles faits dans le navigateur avant tout envoi : les mêmes règles que le serveur (contrats
 * `admin-channel.yaml` et `sijil-api.yaml`, schéma de métadonnées du type), dites en mots de métier.
 * Le serveur reste juge : ses refus s'affichent aussi, rattachés au champ.
 */
export type Problems = Record<string, string>;

/** Motif d'une action sur un document (suppression, restauration, modification) : 3 à 500. */
export const REASON = { min: 3, max: 500 } as const;
/** Finalité ou motif de bris de glace, relayés en en-tête : 255 au plus. */
export const ACCESS_REASON_MAX = 255;
/** Identifiant d'une partie au dépôt (`parties[].id`). */
export const PARTY_ID = /^[A-Za-z0-9_:-]{1,64}$/;
/** Identifiant externe d'une partie (dossier, complétude). */
export const EXTERNAL_ID = /^[A-Za-z0-9_-]{1,32}$/;
/** Code d'un type ou d'un jeu d'exigences. */
export const UPPER_CODE = /^[A-Z][A-Z0-9_]{1,63}$/;

/** Texte obligatoire ou facultatif, borné ; rend le problème ou `undefined`. */
export function textProblem(
  value: string,
  { required = false, min = 0, max }: { required?: boolean; min?: number; max?: number },
): string | undefined {
  const length = value.trim().length;
  if (length === 0) return required ? "Obligatoire" : undefined;
  if (length < min) return `Au moins ${String(min)} caractères`;
  if (max !== undefined && value.length > max) return `${String(max)} caractères au plus`;
  return undefined;
}

/** Identifiant à motif fixe, avec un exemple pour l'utilisateur. */
export function idProblem(
  value: string,
  pattern: RegExp,
  { required = true, hint }: { required?: boolean; hint: string },
): string | undefined {
  const v = value.trim();
  if (v === "") return required ? "Obligatoire" : undefined;
  return pattern.test(v) ? undefined : hint;
}

export const CODE_HINT =
  "Majuscule d'abord, puis majuscules, chiffres ou _ (2 à 64), par exemple CARTE_SEJOUR";
export const PARTY_ID_HINT = "Lettres, chiffres, _ - ou : (64 au plus), sans espace";
export const EXTERNAL_ID_HINT = "Lettres, chiffres, _ ou - (32 au plus), sans espace";

/** Une date `AAAA-MM-JJ` qui existe au calendrier. */
export function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function matches(pattern: string, value: string): boolean {
  try {
    return new RegExp(pattern, "u").test(value);
  } catch {
    // Motif que le navigateur ne sait pas lire : le serveur tranchera.
    return true;
  }
}

/** Message d'un motif non respecté ; les minuscules, cause fréquente, sont nommées. */
function patternProblem(pattern: string, value: string): string {
  if (value !== value.toUpperCase() && matches(pattern, value.toUpperCase())) {
    return `Lettres en majuscules attendues : ${value.toUpperCase()}`;
  }
  if (value !== value.trim() && matches(pattern, value.trim())) {
    return "Sans espace au début ni à la fin";
  }
  return "Format incorrect pour ce champ";
}

/** Problèmes de métadonnées, comme `MetadataValidator` côté serveur (schéma du type). */
export function metadataProblems(
  fields: MetadataField[],
  values: Record<string, string>,
): Problems {
  const problems: Problems = {};
  for (const field of fields) {
    const raw = values[field.name] ?? "";
    const value = field.kind === "text" ? raw : raw.trim();
    if (value.trim() === "") {
      if (field.required) problems[field.name] = "Obligatoire";
      continue;
    }
    const problem = fieldProblem(field, value);
    if (problem) problems[field.name] = problem;
  }
  return problems;
}

function fieldProblem(field: MetadataField, value: string): string | undefined {
  switch (field.kind) {
    case "date":
      return isIsoDate(value) ? undefined : "Date invalide";
    case "number": {
      const n = Number(value);
      if (!Number.isFinite(n)) return "Nombre attendu";
      if (field.integer && !Number.isInteger(n)) return "Nombre entier attendu";
      if (field.minimum !== undefined && n < field.minimum) {
        return `${String(field.minimum)} au moins`;
      }
      if (field.maximum !== undefined && n > field.maximum) {
        return `${String(field.maximum)} au plus`;
      }
      return undefined;
    }
    case "choice":
      return field.options.includes(value) ? undefined : "Choisissez une valeur de la liste";
    case "boolean":
      return undefined;
    default:
      if (field.minLength !== undefined && value.length < field.minLength) {
        return `Au moins ${String(field.minLength)} caractères`;
      }
      if (field.maxLength !== undefined && value.length > field.maxLength) {
        return `${String(field.maxLength)} caractères au plus`;
      }
      if (field.pattern && !matches(field.pattern, value)) {
        return patternProblem(field.pattern, value);
      }
      return undefined;
  }
}

/** Fichier absent, d'un format non admis par le type ou trop lourd. */
export function fileProblem(
  file: File | null,
  formats: readonly string[],
  maxSizeMb: number,
): string | undefined {
  if (!file) return "Choisissez un fichier";
  if (formats.length > 0 && !formats.includes(file.type)) {
    return `Format non admis pour ce type (${formats.map(formatLabel).join(", ")})`;
  }
  if (file.size === 0) return "Le fichier est vide";
  if (file.size > maxSizeMb * 1024 * 1024) {
    return `Fichier trop volumineux : ${String(maxSizeMb)} Mo au plus`;
  }
  return undefined;
}

const FORMAT_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "image/tiff": "TIFF",
};

export function formatLabel(mediaType: string): string {
  return FORMAT_LABELS[mediaType] ?? mediaType;
}

/** Codes d'erreur du serveur, dits comme les contrôles du navigateur. */
const SERVER_CODES: Record<string, string> = {
  REQUIRED: "Obligatoire",
  PATTERN: "Format incorrect pour ce champ",
  ENUM: "Choisissez une valeur de la liste",
  TYPE: "Type de valeur incorrect",
  FORMAT: "Format incorrect pour ce champ",
  MAXLENGTH: "Trop long",
  MINLENGTH: "Trop court",
  MINIMUM: "Valeur trop petite",
  MAXIMUM: "Valeur trop grande",
  ADDITIONALPROPERTIES: "Champ non prévu par le type",
  ROLE_NOT_ALLOWED: "Rôle non admis pour ce type",
  FORMAT_NOT_ALLOWED: "Format de fichier non admis pour ce type",
  CONTENT_MISSING: "Le fichier n'est pas arrivé : renvoyez-le",
  CONTENT_MISMATCH: "Le fichier reçu ne correspond pas : renvoyez-le",
  EXPIRED: "Session d'envoi expirée : renvoyez le fichier",
};

export function serverMessage(code: string): string {
  return SERVER_CODES[code] ?? code;
}

/**
 * Erreurs du serveur par champ du formulaire : `metadata/numero` → `numero`, `parties/0/id` →
 * `parties/0/id` ; les codes deviennent des phrases.
 */
export function serverProblems(byField: Record<string, string[]>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [field, codes] of Object.entries(byField)) {
    const key = field.replace(/^\/?metadata\//, "");
    (out[key] ??= []).push(...codes.map(serverMessage));
  }
  return out;
}

/** Fusion des problèmes du navigateur et du serveur, pour l'affichage sous chaque champ. */
export function merged(
  local: Problems,
  server: Record<string, string[]>,
): Record<string, string[]> {
  const out: Record<string, string[]> = { ...server };
  for (const [k, v] of Object.entries(local))
    out[k] = [v, ...(out[k] ?? []).filter((x) => x !== v)];
  return out;
}

/** `{ [key]: message }` si un problème existe, `{}` sinon : pour composer les problèmes d'un écran. */
export function at(key: string, message: string | undefined): Problems {
  return message ? { [key]: message } : {};
}
