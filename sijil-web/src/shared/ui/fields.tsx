import type { InputHTMLAttributes, Ref, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { Checkbox, Radio, Textarea, type TextareaProps } from "@awb/ui";
import { twMerge } from "tailwind-merge";
import { CONTROL, Field, type FieldProps } from "@/shared/ui/Field";
import { Chevron } from "@/shared/ui/icons";

/** Attributs natifs du contrôle ; `ref` pour react-hook-form (`register`). */
/**
 * Retire les attributs absents : les types d'`@awb/ui` n'admettent pas `undefined` explicite
 * (`exactOptionalPropertyTypes`).
 */
function present<T extends object>(attributes: T): T {
  return Object.fromEntries(
    Object.entries(attributes).filter(([, value]) => value !== undefined),
  ) as T;
}

type Native<T, E = HTMLInputElement> = Omit<T, "id" | "required"> & { ref?: Ref<E> };

/**
 * Champ texte natif aux classes de l'`Input` d'`@awb/ui` : celui-ci garde `required` pour son
 * astérisque sans le poser sur le champ, qui échapperait alors à la validation du formulaire.
 */
export function TextField({
  label,
  description,
  error,
  required,
  hideLabel,
  className,
  ...input
}: FieldProps & Native<InputHTMLAttributes<HTMLInputElement>>) {
  return (
    <Field
      label={label}
      description={description}
      error={error}
      required={required}
      hideLabel={hideLabel}
    >
      {(ids) => (
        <input
          {...input}
          {...ids}
          required={required}
          className={twMerge(CONTROL, "placeholder:text-gray-500", className)}
        />
      )}
    </Field>
  );
}

/** Zone de texte de la charte (`Textarea` d'`@awb/ui`), qui grandit avec son contenu. */
export function TextAreaField({
  label,
  description,
  error,
  required,
  ...textarea
}: FieldProps & Native<TextareaHTMLAttributes<HTMLTextAreaElement>, HTMLTextAreaElement>) {
  return (
    <Field label={label} description={description} error={error} required={required}>
      {(ids) => (
        <Textarea
          {...present(textarea as TextareaProps)}
          {...ids}
          {...(required ? { required: true } : {})}
          autoResize
          variant={error ? "error" : "default"}
        />
      )}
    </Field>
  );
}

export interface Option {
  value: string;
  label: string;
}

/**
 * Liste de choix native, aux couleurs de la charte : le `Select` d'`@awb/ui` est un bouton sans nom
 * accessible ni valeur de formulaire.
 */
export function SelectField({
  label,
  description,
  error,
  required,
  options,
  placeholder,
  hideLabel,
  ...select
}: FieldProps &
  Native<SelectHTMLAttributes<HTMLSelectElement>, HTMLSelectElement> & {
    options: Option[];
    placeholder?: string;
  }) {
  return (
    <Field
      label={label}
      description={description}
      error={error}
      required={required}
      hideLabel={hideLabel}
    >
      {(ids) => (
        <div className="relative">
          <select
            {...select}
            {...ids}
            required={required}
            className={twMerge(CONTROL, "sijil-select pe-9")}
          >
            {placeholder !== undefined && <option value="">{placeholder}</option>}
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <Chevron />
        </div>
      )}
    </Field>
  );
}

/** Choix d'un fichier, aux couleurs de la charte. */
export function FileField({
  label,
  description,
  error,
  required,
  onFile,
  ...input
}: FieldProps &
  Native<Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange">> & {
    onFile: (file: File | null) => void;
  }) {
  return (
    <Field label={label} description={description} error={error} required={required}>
      {(ids) => (
        <input
          {...input}
          {...ids}
          type="file"
          // Obligation annoncée, vérifiée par l'écran à l'envoi : jsdom tient pour vide un champ
          // fichier rempli par user-event, et bloquerait l'envoi du formulaire dans les tests.
          aria-required={required}
          className={`${CONTROL} file:me-3 file:rounded-md file:border-0 file:bg-orange-50 file:px-3 file:py-1 file:font-semibold file:text-orange-700`}
          onChange={(e) => {
            onFile(e.currentTarget.files?.[0] ?? null);
          }}
        />
      )}
    </Field>
  );
}

/** Case à cocher de la charte ; son libellé l'entoure, il la nomme donc. */
export function CheckboxField(
  props: { label: string } & Native<InputHTMLAttributes<HTMLInputElement>>,
) {
  return <Checkbox {...props} />;
}

/** Groupe de boutons radio de la charte, nommé par sa légende. */
export function RadioGroup({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-1 text-sm font-medium text-gray-700">{legend}</legend>
      {options.map((o) => (
        <Radio
          key={o.value}
          name={name}
          label={o.label}
          value={o.value}
          checked={value === o.value}
          onChange={() => {
            onChange(o.value);
          }}
        />
      ))}
    </fieldset>
  );
}
