import { Checkbox, Fieldset, Text, TextInput } from "@mantine/core";

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
    <Fieldset legend="Aperçu du formulaire généré" disabled>
      {properties.length === 0 ? (
        <Text>Aucun champ de métadonnées à afficher.</Text>
      ) : (
        properties.map(([name, property]) => {
          const label = property.title ?? name;
          const required = schema?.required?.includes(name) ?? false;
          return property.type === "boolean" ? (
            <Checkbox key={name} label={label} mt="xs" />
          ) : (
            <TextInput
              key={name}
              label={label}
              required={required}
              type={inputType(property)}
              mt="xs"
            />
          );
        })
      )}
    </Fieldset>
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
