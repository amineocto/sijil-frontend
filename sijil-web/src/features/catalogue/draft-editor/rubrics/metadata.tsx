import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { EditorValues } from "@/features/catalogue/draft-editor/form";
import { Button, SelectField, TextField } from "@/shared/ui";
import { CloseIcon } from "@/shared/ui/icons";
import { ChipsField, Switch } from "./controls";
import { objectOf, omit, stringsOf, usePart, type Json } from "./part";

/** Formats proposés pour une métadonnée, et leur traduction en schéma JSON. */
export const FORMATS = [
  { value: "text", label: "Texte" },
  { value: "date", label: "Date" },
  { value: "integer", label: "Nombre entier" },
  { value: "number", label: "Nombre décimal" },
  { value: "boolean", label: "Oui ou non" },
  { value: "enum", label: "Liste de valeurs" },
] as const;

type Format = (typeof FORMATS)[number]["value"];

export interface Field {
  name: string;
  title: string;
  format: Format;
  required: boolean;
  maxLength: string;
  values: string[];
  /** Attributs du schéma que l'écran ne présente pas (pattern, minimum…), conservés tels quels. */
  rest: Json;
}

/** Format d'une propriété du schéma. */
export function formatOf(property: Json): Format {
  if (Array.isArray(property["enum"])) return "enum";
  if (property["type"] === "boolean") return "boolean";
  if (property["type"] === "integer") return "integer";
  if (property["type"] === "number") return "number";
  if (property["format"] === "date") return "date";
  return "text";
}

/** Champs lus dans le schéma des métadonnées, dans l'ordre de ses propriétés. */
export function fieldsOf(schema: Json): Field[] {
  const required = stringsOf(schema["required"]);
  return Object.entries(objectOf(schema["properties"])).map(([name, raw]) => {
    const property = objectOf(raw);
    const { title, maxLength, enum: values } = property;
    const rest = omit(property, ["type", "format", "title", "maxLength", "enum"]);
    return {
      name,
      title: typeof title === "string" ? title : "",
      format: formatOf(property),
      required: required.includes(name),
      maxLength: typeof maxLength === "number" ? String(maxLength) : "",
      values: stringsOf(values),
      rest,
    };
  });
}

/** Schéma des métadonnées réécrit depuis les champs ; les autres clés de la racine sont gardées. */
export function schemaOf(fields: Field[], previous: Json): Json {
  const properties: Json = {};
  for (const f of fields) {
    const property: Json = { ...f.rest };
    if (f.format === "boolean") property["type"] = "boolean";
    else if (f.format === "integer") property["type"] = "integer";
    else if (f.format === "number") property["type"] = "number";
    else {
      property["type"] = "string";
      if (f.format === "date") property["format"] = "date";
      if (f.format === "enum") property["enum"] = f.values;
      if (f.format === "text" && f.maxLength) property["maxLength"] = Number(f.maxLength);
    }
    // Libellé gardé tel que saisi : le rogner à chaque frappe effacerait l'espace en cours.
    if (f.title !== "") property["title"] = f.title;
    properties[f.name] = property;
  }
  const required = fields.filter((f) => f.required).map((f) => f.name);
  const root = omit(previous, ["required", "properties"]);
  return {
    type: "object",
    ...root,
    ...(required.length ? { required } : {}),
    properties,
  };
}

/** Nom technique tiré d'un libellé : « Date d'expiration » → dateExpiration. */
export function technicalName(title: string): string {
  const words = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w.length > 1 || /\d/.test(w));
  const name = words
    .map((w, i) =>
      i === 0 ? w.toLowerCase() : (w[0] ?? "").toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join("");
  return /^[a-z]/.test(name) ? name.slice(0, 64) : "";
}

const NAME = /^[a-z][A-Za-z0-9]{0,63}$/;

/** Rubrique « Métadonnées » : les champs saisis au dépôt, un par ligne. */
export function MetadataEditor({ form }: { form: UseFormReturn<EditorValues> }) {
  const part = usePart<Json>(form, "metadataSchema");
  const schema = objectOf(part.value);
  const fields = fieldsOf(schema);
  const write = (next: Field[]) => {
    part.set(schemaOf(next, schema));
  };
  const update = (index: number, patch: Partial<Field>) => {
    write(fields.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  };
  // Deux propriétés du même nom se fondraient en une : un nom pris reçoit un suffixe.
  const freeName = (base: string, index = -1) => {
    const taken = (name: string) => fields.some((f, i) => i !== index && f.name === name);
    let n = 1;
    let name = base;
    while (taken(name)) name = `${base}${String(++n)}`;
    return name;
  };
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-600">
        Les informations demandées au dépôt d&apos;un document de ce type. Le nom technique est
        déduit du libellé ; il ne change plus une fois le type publié.
      </p>
      {fields.length === 0 && (
        <p className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-700">
          Aucune métadonnée pour l&apos;instant.
        </p>
      )}
      <ol className="flex flex-col gap-3">
        {fields.map((field, index) => {
          const taken = fields.filter((_, i) => i !== index).map((f) => f.name);
          return (
            <li
              key={index}
              aria-label={`Métadonnée ${String(index + 1)} : ${field.title || field.name}`}
              className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-gray-900">
                  {field.title || field.name || "Nouvelle métadonnée"}
                </p>
                <button
                  type="button"
                  aria-label={`Supprimer la métadonnée ${field.title || field.name}`}
                  onClick={() => {
                    write(fields.filter((_, i) => i !== index));
                  }}
                  className="flex size-8 items-center justify-center rounded-lg text-gray-600 hover:bg-red-50 hover:text-red-700"
                >
                  <CloseIcon className="size-4" />
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <TextField
                  label="Libellé"
                  value={field.title}
                  onChange={(e) => {
                    const title = e.currentTarget.value;
                    // Le nom suit le libellé tant qu'il n'a pas été choisi à la main.
                    const follows =
                      !field.name ||
                      /^champ\d*$/.test(field.name) ||
                      field.name === freeName(technicalName(field.title), index);
                    update(index, {
                      title,
                      ...(follows
                        ? { name: freeName(technicalName(title) || field.name, index) }
                        : {}),
                    });
                  }}
                />
                <NameField
                  name={field.name}
                  taken={taken}
                  onChange={(name) => {
                    update(index, { name });
                  }}
                />
                <SelectField
                  label="Format"
                  options={FORMATS.map((f) => ({ value: f.value, label: f.label }))}
                  value={field.format}
                  onChange={(e) => {
                    update(index, { format: e.currentTarget.value as Format });
                  }}
                />
              </div>
              {field.format === "text" && (
                <div className="max-w-xs">
                  <TextField
                    label="Longueur maximale"
                    description="Facultative."
                    type="number"
                    min={1}
                    value={field.maxLength}
                    onChange={(e) => {
                      update(index, { maxLength: e.currentTarget.value });
                    }}
                  />
                </div>
              )}
              {field.format === "enum" && (
                <ChipsField
                  label="Valeurs permises"
                  placeholder="Ajouter une valeur"
                  values={field.values}
                  onChange={(values) => {
                    update(index, { values });
                  }}
                />
              )}
              <Switch
                label="Obligatoire au dépôt"
                checked={field.required}
                onChange={(required) => {
                  update(index, { required });
                }}
              />
            </li>
          );
        })}
      </ol>
      <div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            write([
              ...fields,
              {
                name: freeName("champ"),
                title: "",
                format: "text",
                required: false,
                maxLength: "",
                values: [],
                rest: {},
              },
            ]);
          }}
        >
          Ajouter une métadonnée
        </Button>
      </div>
    </div>
  );
}

/**
 * Nom technique : la saisie reste locale tant qu'elle n'est pas un nom valide et libre, pour ne
 * jamais écrire dans le schéma une propriété vide ou en double.
 */
function NameField({
  name,
  taken,
  onChange,
}: {
  name: string;
  taken: string[];
  onChange: (name: string) => void;
}) {
  const [draft, setDraft] = useState({ base: name, value: name });
  // Le nom a changé ailleurs (il suit le libellé) : la saisie en cours est abandonnée.
  const value = draft.base === name ? draft.value : name;
  return (
    <TextField
      label="Nom technique"
      value={value}
      error={nameError(value, taken)}
      onChange={(e) => {
        const next = e.currentTarget.value;
        const valid = nameError(next, taken) === undefined;
        setDraft({ base: valid ? next : name, value: next });
        if (valid) onChange(next);
      }}
    />
  );
}

function nameError(name: string, taken: string[]): string | undefined {
  if (name === "") return "Le nom technique est obligatoire";
  if (!NAME.test(name)) return "Une minuscule puis lettres et chiffres, sans espace";
  if (taken.includes(name)) return "Ce nom technique est déjà pris";
  return undefined;
}
