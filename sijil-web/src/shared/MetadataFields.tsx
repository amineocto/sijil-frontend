import type { MetadataField } from "@/shared/metadata";
import { CheckboxField, SelectField, TextField } from "@/shared/ui";

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
    <div className="flex flex-col gap-3">
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
              <SelectField
                key={field.name}
                {...common}
                placeholder=""
                options={field.options.map((o) => ({ value: o, label: o }))}
                value={value}
                onChange={(e) => {
                  set(field.name, e.currentTarget.value);
                }}
              />
            );
          case "boolean":
            return (
              <CheckboxField
                key={field.name}
                label={field.label}
                checked={value === "true"}
                onChange={(e) => {
                  set(field.name, String(e.currentTarget.checked));
                }}
              />
            );
          default:
            return (
              <TextField
                key={field.name}
                {...common}
                type={field.kind === "date" ? "date" : field.kind === "number" ? "number" : "text"}
                {...(field.kind === "number" ? { inputMode: "decimal" as const, step: "any" } : {})}
                maxLength={field.maxLength}
                value={value}
                onChange={(e) => {
                  set(field.name, e.currentTarget.value);
                }}
              />
            );
        }
      })}
    </div>
  );
}
