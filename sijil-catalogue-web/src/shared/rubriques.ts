/** Rubriques de l'éditeur (09-fronts.md) et clés de la définition qu'elles portent. */
export interface Rubrique {
  id: string;
  label: string;
  /** Clés éditées en JSON dans cette rubrique. */
  jsonKeys: readonly string[];
  /** Clés éditées par des champs de formulaire dans cette rubrique. */
  fieldKeys: readonly string[];
}

export const RUBRIQUES: readonly Rubrique[] = [
  {
    id: "identite",
    label: "Identité",
    fieldKeys: ["labels", "family", "level"],
    jsonKeys: ["parties"],
  },
  {
    id: "metadonnees",
    label: "Métadonnées",
    fieldKeys: [],
    jsonKeys: ["metadataSchema"],
  },
  { id: "validite", label: "Validité", fieldKeys: [], jsonKeys: ["validity"] },
  {
    id: "retention",
    label: "Rétention",
    fieldKeys: [],
    jsonKeys: ["retention"],
  },
  {
    id: "stockage",
    label: "Stockage",
    fieldKeys: [],
    jsonKeys: ["storage", "versioning", "formats", "maxSizeMb"],
  },
  {
    id: "traitements",
    label: "Traitements",
    fieldKeys: [],
    jsonKeys: ["origins", "processing"],
  },
  {
    id: "sensibilite",
    label: "Sensibilité et visibilité",
    fieldKeys: ["sensitivity"],
    jsonKeys: ["visibility", "reuse"],
  },
  { id: "filenet", label: "FileNet", fieldKeys: [], jsonKeys: ["filenet"] },
];

export const JSON_KEYS: readonly string[] = RUBRIQUES.flatMap((r) => r.jsonKeys);

/** Clé de premier niveau d'un pointeur JSON (`/retention/duration` → `retention`). */
export function topLevelKey(pointer: string): string {
  return pointer.replace(/^\//, "").split("/")[0] ?? "";
}

/** Rubrique qui porte une erreur, d'après son pointeur JSON ; « Identité » par défaut. */
export function rubriqueOf(pointer: string): Rubrique {
  const key = topLevelKey(pointer);
  return (
    RUBRIQUES.find((r) => r.jsonKeys.includes(key) || r.fieldKeys.includes(key)) ??
    (RUBRIQUES[0] as Rubrique)
  );
}
