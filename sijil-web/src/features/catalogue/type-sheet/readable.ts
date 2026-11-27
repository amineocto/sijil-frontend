import { RUBRIQUES, topLevelKey } from "@/features/catalogue/shared/rubriques";
import { canonical } from "@/features/catalogue/type-sheet/diff";
import { FAMILY_LABELS } from "@/features/dossier/dossier";
import { PARTY_ROLE_LABELS, PARTY_TYPE_LABELS, SENSITIVITY_LABELS } from "@/shared/labels";

/** Un champ modifié entre deux définitions, dit dans les mots de l'éditeur (pas de JSON). */
export interface FieldChange {
  rubric: string;
  field: string;
  before: string;
  after: string;
}

/** Libellé de chaque clé de la définition, tel que l'éditeur le montre. */
const KEY_LABELS: Record<string, string> = {
  labels: "Libellé",
  fr: "français",
  ar: "arabe",
  en: "anglais",
  description: "Description",
  family: "Famille",
  level: "Niveau de rattachement",
  parties: "Parties",
  roles: "Rôles",
  metadataSchema: "Métadonnées",
  properties: "",
  required: "Obligatoires",
  title: "Libellé",
  format: "Format",
  type: "Format",
  maxLength: "Longueur maximale",
  pattern: "Motif",
  enum: "Valeurs permises",
  minimum: "Minimum",
  maximum: "Maximum",
  validity: "Validité",
  expiresAt: "Expiration de la pièce",
  field: "Métadonnée de la date",
  duration: "Durée",
  retention: "Rétention",
  policy: "Politique de rétention",
  policyVersion: "Version de la politique",
  startEvent: "Point de départ",
  eventCode: "Événement métier",
  coldAfter: "Archive froide après",
  onExpiry: "À l'échéance",
  legalBasis: "Base légale",
  legalReference: "Référence du texte",
  storage: "Stockage",
  bucket: "Emplacement de stockage",
  lossyRecompression: "Recompression avec perte",
  versioning: "Nouvelles versions",
  allowed: "Autorisées",
  max: "Nombre maximal",
  formats: "Formats admis",
  maxSizeMb: "Taille maximale (Mo)",
  origins: "Origines",
  parcours: "Parcours",
  channels: "Canaux de collecte",
  prospect: "Collectable pour un prospect",
  processing: "Traitements",
  ocr: "Reconnaissance du texte (OCR)",
  extraction: "Extraction de champs",
  pdfa: "Rendu PDF/A",
  detection: "Détection du type",
  enabled: "Active",
  keywords: "Mots-clés",
  mrz: "Code MRZ",
  minScore: "Score minimal",
  sensitivity: "Sensibilité",
  visibility: "Visibilité",
  portfolio: "Éligible au portefeuille client 360",
  client: "Éligible au portefeuille client 360",
  subsidiaries: "Visible des filiales",
  reuse: "Réutilisation par d'autres parcours",
  filenet: "FileNet",
  documentClass: "Classe documentaire",
  typeValue: "Valeur du type",
};

/** Libellé des valeurs codées, toutes rubriques confondues. */
const VALUE_LABELS: Record<string, string> = {
  ...SENSITIVITY_LABELS,
  ...PARTY_TYPE_LABELS,
  ...PARTY_ROLE_LABELS,
  ...FAMILY_LABELS,
  CREATION: "Création du document",
  FIN_RELATION: "Fin de la relation client",
  ECHEANCE_CONTRAT: "Échéance du contrat",
  EXPIRATION: "Expiration du document",
  EVENEMENT_METIER: "Événement métier",
  NONE: "Aucune",
  PURGE: "Purger",
  FROM_METADATA: "Lue dans une métadonnée",
  COMPUTED: "Calculée",
  MRZ: "Bande MRZ",
  QR: "Code QR",
  SERVICE: "Service d'extraction",
  "application/pdf": "PDF",
  "image/jpeg": "Image JPEG",
  "image/png": "Image PNG",
  "image/tiff": "Image TIFF",
  string: "Texte",
  integer: "Nombre entier",
  number: "Nombre",
  boolean: "Oui ou non",
  date: "Date",
};

const UNITS: Record<string, [string, string]> = {
  Y: ["an", "ans"],
  M: ["mois", "mois"],
  D: ["jour", "jours"],
};

/** `P10Y6M` → « 10 ans 6 mois » ; une autre valeur est rendue telle quelle. */
export function periodLabel(value: string): string {
  const match = /^P(?=\d)(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?$/.exec(value);
  if (!match) return value;
  return (["Y", "M", "D"] as const)
    .map((unit, i) => {
      const n = match[i + 1];
      if (!n) return "";
      const [one, many] = UNITS[unit] ?? ["", ""];
      return `${n} ${n === "1" ? one : many}`;
    })
    .filter(Boolean)
    .join(" ");
}

/** Valeur lisible : Oui/Non, libellés des codes, durées, listes séparées par des virgules. */
export function valueLabel(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return VALUE_LABELS[value] ?? periodLabel(value);
  if (Array.isArray(value)) return value.length ? value.map(valueLabel).join(", ") : "—";
  return canonical(value);
}

function keyLabel(key: string): string {
  return KEY_LABELS[key] ?? key;
}

/** Feuilles d'une valeur : chemin de clés → valeur ; une liste est une feuille. */
function leaves(
  value: unknown,
  path: string[] = [],
): Map<string, { path: string[]; value: unknown }> {
  const out = new Map<string, { path: string[]; value: unknown }>();
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      for (const [k, v] of leaves(child, [...path, key])) out.set(k, v);
    }
  } else if (path.length > 0) {
    const named = canonicalPath(path);
    out.set(named.join("/"), { path: named, value });
  }
  return out;
}

/** `visibility.client` est l'ancien nom de `visibility.portfolio` (ADR 0025) : un seul champ. */
function canonicalPath(path: string[]): string[] {
  return path[0] === "visibility" && path[1] === "client" ? ["visibility", "portfolio"] : path;
}

/** Champs modifiés entre deux définitions, rangés par rubrique de l'éditeur. */
export function fieldChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): FieldChange[] {
  const left = leaves(before);
  const right = leaves(after);
  const keys = [...new Set([...left.keys(), ...right.keys()])];
  const order = (key: string) => {
    const index = RUBRIQUES.findIndex(
      (r) => r.jsonKeys.includes(topLevelKey(key)) || r.fieldKeys.includes(topLevelKey(key)),
    );
    return index < 0 ? RUBRIQUES.length : index;
  };
  return keys
    .filter((key) => canonical(left.get(key)?.value) !== canonical(right.get(key)?.value))
    .sort((a, b) => order(a) - order(b) || a.localeCompare(b))
    .map((key) => {
      const path = (left.get(key) ?? right.get(key))?.path ?? [];
      const rubric =
        RUBRIQUES.find(
          (r) => r.jsonKeys.includes(topLevelKey(key)) || r.fieldKeys.includes(topLevelKey(key)),
        )?.label ?? keyLabel(path[0] ?? key);
      const field = path.map(keyLabel).filter(Boolean).join(" › ") || rubric;
      return {
        rubric,
        field,
        before: valueLabel(left.get(key)?.value),
        after: valueLabel(right.get(key)?.value),
      };
    });
}
