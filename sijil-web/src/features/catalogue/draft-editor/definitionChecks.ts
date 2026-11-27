/**
 * Contrôles de forme d'une définition de type, faits avant l'enregistrement du brouillon : les
 * motifs et bornes du schéma `document-type-definition.schema.json` (mode DRAFT du catalogue).
 * Les règles de soumission (rubriques obligatoires, cohérences) restent au catalogue.
 */
export interface DefinitionProblem {
  pointer: string;
  message: string;
}

const PERIOD = /^P(?=\d)(\d+Y)?(\d+M)?(\d+W)?(\d+D)?$/;
const UPPER_CODE = /^[A-Z][A-Z0-9_]{1,31}$/;
const PARCOURS = /^[a-z][a-z0-9-]{1,31}$/;
const MEDIA_TYPE = /^(application|image|text)\/[a-z0-9][a-z0-9.+-]{0,63}$/;

type Json = Record<string, unknown>;

function obj(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : {};
}

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** Règles d'une feuille : pointeur, libellé lisible, contrôle. */
const RULES: {
  pointer: string;
  label: string;
  check: (value: unknown) => string | undefined;
}[] = [
  { pointer: "/labels/fr", label: "Libellé français", check: (v) => length(v, 1, 120) },
  { pointer: "/labels/ar", label: "Libellé arabe", check: (v) => length(v, 1, 120) },
  { pointer: "/labels/en", label: "Libellé anglais", check: (v) => length(v, 1, 120) },
  { pointer: "/description", label: "Description", check: (v) => length(v, 0, 2000) },
  {
    pointer: "/validity/field",
    label: "Métadonnée de la date",
    check: (v) => pattern(v, /^[a-z][A-Za-z0-9]{0,63}$/),
  },
  { pointer: "/validity/duration", label: "Durée de validité", check: (v) => period(v) },
  {
    pointer: "/retention/policy",
    label: "Politique de rétention",
    check: (v) => pattern(v, UPPER_CODE, "Majuscules, chiffres et _ , par exemple KYC_10A"),
  },
  {
    pointer: "/retention/eventCode",
    label: "Événement métier",
    check: (v) => pattern(v, UPPER_CODE, "Majuscules, chiffres et _"),
  },
  { pointer: "/retention/duration", label: "Durée de conservation", check: (v) => period(v) },
  { pointer: "/retention/coldAfter", label: "Archive froide après", check: (v) => period(v) },
  { pointer: "/retention/legalBasis", label: "Base légale", check: (v) => length(v, 3, 500) },
  {
    pointer: "/retention/legalReference",
    label: "Référence du texte",
    check: (v) => length(v, 0, 200),
  },
  {
    pointer: "/storage/bucket",
    label: "Emplacement de stockage",
    check: (v) => pattern(v, PARCOURS, "Minuscules, chiffres et -, par exemple eer-pieces"),
  },
  {
    pointer: "/versioning/max",
    label: "Nombre maximal de versions",
    check: (v) => range(v, 1, 1000, true),
  },
  {
    pointer: "/maxSizeMb",
    label: "Taille maximale (Mo)",
    check: (v) => range(v, 1, undefined, false),
  },
  {
    pointer: "/processing/detection/minScore",
    label: "Score minimal",
    check: (v) => range(v, 0, 1, false),
  },
  {
    pointer: "/processing/detection/mrz",
    label: "Code MRZ",
    check: (v) => pattern(v, /^[A-Z]{1,2}$/, "Une ou deux majuscules"),
  },
  {
    pointer: "/filenet/documentClass",
    label: "Classe documentaire",
    check: (v) => pattern(v, /^[A-Za-z][A-Za-z0-9_]{0,63}$/),
  },
  {
    pointer: "/filenet/typeValue",
    label: "Valeur du type",
    check: (v) =>
      pattern(v, /^[^'"\\]{1,128}$/, "Sans apostrophe, guillemet ni barre oblique inverse"),
  },
];

function length(value: unknown, min: number, max: number): string | undefined {
  const s = str(value);
  if (s === undefined) return undefined;
  if (s.length < min)
    return min === 1 ? "ne peut pas être vide" : `au moins ${String(min)} caractères`;
  return s.length > max ? `${String(max)} caractères au plus` : undefined;
}

function pattern(value: unknown, re: RegExp, hint = "format incorrect"): string | undefined {
  const s = str(value);
  return s === undefined || re.test(s) ? undefined : hint;
}

function period(value: unknown): string | undefined {
  return pattern(value, PERIOD, "durée invalide (années, mois, semaines ou jours)");
}

function range(
  value: unknown,
  min: number,
  max: number | undefined,
  integer: boolean,
): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) return "nombre attendu";
  if (integer && !Number.isInteger(value)) return "nombre entier attendu";
  if (value < min) return `${String(min)} au moins`;
  return max !== undefined && value > max ? `${String(max)} au plus` : undefined;
}

function at(definition: Json, pointer: string): unknown {
  return pointer
    .split("/")
    .slice(1)
    .reduce<unknown>((node, key) => obj(node)[key], definition);
}

/** Problèmes de forme d'une définition, par pointeur JSON. */
export function definitionProblems(definition: Json): DefinitionProblem[] {
  const problems: DefinitionProblem[] = [];
  for (const rule of RULES) {
    const message = rule.check(at(definition, rule.pointer));
    if (message) problems.push({ pointer: rule.pointer, message: `${rule.label} : ${message}` });
  }
  const list = (pointer: string, label: string, re: RegExp, hint: string) => {
    const values = at(definition, pointer);
    if (!Array.isArray(values)) return;
    const bad = values.filter((v) => typeof v !== "string" || !re.test(v));
    if (bad.length) {
      problems.push({ pointer, message: `${label} : ${bad.map(String).join(", ")} — ${hint}` });
    }
  };
  list("/formats", "Formats admis", MEDIA_TYPE, "type de fichier inconnu");
  list("/origins/channels", "Canaux de collecte", UPPER_CODE, "majuscules, chiffres et _");
  list("/origins/parcours", "Parcours", PARCOURS, "minuscules, chiffres et -");
  const keywords = at(definition, "/processing/detection/keywords");
  if (Array.isArray(keywords)) {
    const bad = keywords.filter((k) => typeof k !== "string" || k.length < 2 || k.length > 64);
    if (keywords.length > 50 || bad.length) {
      problems.push({
        pointer: "/processing/detection/keywords",
        message: "Mots-clés : 50 au plus, de 2 à 64 caractères chacun",
      });
    }
  }
  return problems;
}
