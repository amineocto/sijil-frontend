import { Checkbox, NumberInput, Select, Stack, TextInput } from "@mantine/core";
import type { MetadataField } from "@/shared/metadata";

/** Formulaire généré depuis le schéma de métadonnées du type ; erreurs par champ de `sijil-api`. */
export function MetadataFields({
  fields,
  values,
  errors,
  onChange,
}: {
  fields: MetadataField[];
  values: Record<string, string>;
  errors: Record<string, string[]>;
  onChange: (values: Record<string, string>) => void;
}) {
  const set = (name: string, value: string) => {
    onChange({ ...values, [name]: value });
  };
  return (
    <Stack gap="sm">
      {fields.map((field) => {
        const common = {
          label: field.label,
          required: field.required,
          error: errors[field.name]?.join(", "),
        };
        const value = values[field.name] ?? "";
        switch (field.kind) {
          case "choice":
            return (
              <Select
                key={field.name}
                {...common}
                data={field.options}
                value={value || null}
                onChange={(v) => {
                  set(field.name, v ?? "");
                }}
              />
            );
          case "boolean":
            return (
              <Checkbox
                key={field.name}
                label={field.label}
                checked={value === "true"}
                onChange={(e) => {
                  set(field.name, String(e.currentTarget.checked));
                }}
              />
            );
          case "number":
            return (
              <NumberInput
                key={field.name}
                {...common}
                value={value}
                onChange={(v) => {
                  set(field.name, String(v));
                }}
              />
            );
          default:
            return (
              <TextInput
                key={field.name}
                {...common}
                type={field.kind === "date" ? "date" : "text"}
                maxLength={field.maxLength}
                value={value}
                onChange={(e) => {
                  set(field.name, e.currentTarget.value);
                }}
              />
            );
        }
      })}
    </Stack>
  );
}
