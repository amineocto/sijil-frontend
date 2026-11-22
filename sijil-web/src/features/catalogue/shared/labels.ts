import type { TypeStatus } from "@/shared/api";

export const STATUS_LABELS: Record<TypeStatus, string> = {
  BROUILLON: "Brouillon",
  SOUMIS: "Soumis",
  EN_REVUE: "En revue",
  PUBLIE: "Publié",
  DEPRECIE: "Déprécié",
  RETIRE: "Retiré",
};

export const STATUS_COLORS: Record<TypeStatus, string> = {
  BROUILLON: "gray",
  SOUMIS: "blue",
  EN_REVUE: "violet",
  PUBLIE: "green",
  DEPRECIE: "orange",
  RETIRE: "red",
};

const ERROR_LABELS: Record<string, string> = {
  REQUIRED: "obligatoire",
  PLACEHOLDER: "valeur provisoire à remplacer",
  TYPE: "type de valeur incorrect",
  PATTERN: "format incorrect",
  ENUM: "valeur non autorisée",
  INVALID_JSON: "JSON invalide",
  INVALID_METADATA_SCHEMA: "schéma de métadonnées invalide",
  UNKNOWN_METADATA_FIELD: "champ de métadonnées inconnu",
  METADATA_FIELD_NOT_DATE: "le champ de métadonnées doit être une date",
  SIZE_ABOVE_PLATFORM_MAX: "taille supérieure au maximum de la plateforme",
  FORMATS_NOT_PROCESSABLE: "formats incompatibles avec les traitements",
  PARCOURS_INACTIVE: "parcours inactif",
};

/** Libellé lisible d'un code d'erreur du serveur ; le code brut s'il est inconnu. */
export function errorLabel(code: string): string {
  return ERROR_LABELS[code] ?? code;
}
