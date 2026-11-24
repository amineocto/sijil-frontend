import { CheckboxField, TextField } from "@/shared/ui";

interface Property {
  type?: string;
  format?: string;
  title?: string;
}

/** Aperçu du formulaire de saisie généré à partir du schéma de métadonnées (lecture seule). */
export function MetadataPreview({ schemaText }: { schemaText: string }) {
  const schema = parse(schemaText);
  const properties = Object.entries(schema?.properties ?? {});
  return (
    <fieldset
      disabled
      className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4"
    >
      <legend className="px-1 text-sm font-semibold text-gray-700">
        Aperçu du formulaire généré
      </legend>
      {properties.length === 0 ? (
        <p className="text-sm text-gray-900">Aucun champ de métadonnées à afficher.</p>
      ) : (
        properties.map(([name, property]) => {
          const label = property.title ?? name;
          const required = schema?.required?.includes(name) ?? false;
          return property.type === "boolean" ? (
            <CheckboxField key={name} label={label} />
          ) : (
            <TextField key={name} label={label} required={required} type={inputType(property)} />
          );
        })
      )}
    </fieldset>
  );
}

function inputType(property: Property): string {
  if (property.format === "date") return "date";
  if (property.type === "integer" || property.type === "number") return "number";
  return "text";
}

function parse(
  text: string,
): { properties?: Record<string, Property>; required?: string[] } | null {
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}
