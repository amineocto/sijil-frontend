import { useId, useState, type ReactNode } from "react";
import { CONTROL } from "@/shared/ui/Field";
import { Chevron, CloseIcon } from "@/shared/ui/icons";

/** Unités d'une période ISO 8601 (P10Y, P3M, P2W, P30D). */
const UNITS = [
  { value: "Y", label: "ans" },
  { value: "M", label: "mois" },
  { value: "W", label: "semaines" },
  { value: "D", label: "jours" },
] as const;

/** Période d'une seule unité, lisible par le formulaire ; `null` pour une période composée. */
export function splitPeriod(period: string | undefined): { amount: string; unit: string } | null {
  if (!period) return { amount: "", unit: "Y" };
  const match = /^P(\d+)([YMWD])$/.exec(period);
  return match ? { amount: match[1] ?? "", unit: match[2] ?? "Y" } : null;
}

/** Durée saisie en nombre et unité, écrite en période ISO 8601 (« 10 ans » → P10Y). */
export function PeriodField({
  label,
  description,
  value,
  required = false,
  onChange,
}: {
  label: string;
  description?: string;
  value: string | undefined;
  required?: boolean;
  onChange: (period: string | undefined) => void;
}) {
  const id = useId();
  const split = splitPeriod(value);
  const [unit, setUnit] = useState(split?.unit ?? "Y");
  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${id}-libelle`} className="text-sm font-medium text-gray-700">
        {label}
        {required && (
          <span className="ms-0.5 text-red-700" aria-hidden="true">
            *
          </span>
        )}
      </span>
      {split === null ? (
        <p className="text-sm text-gray-700">
          Durée composée <code>{value}</code> : modifiable en mode avancé.
        </p>
      ) : (
        <div className="flex gap-2" role="group" aria-labelledby={`${id}-libelle`}>
          <input
            type="number"
            min={1}
            inputMode="numeric"
            aria-label={`${label} : nombre`}
            aria-describedby={description ? `${id}-aide` : undefined}
            value={split.amount}
            onChange={(e) => {
              const n = e.currentTarget.value;
              onChange(n === "" ? undefined : `P${n}${unit}`);
            }}
            className={`${CONTROL} w-28`}
          />
          <span className="relative w-36">
            <select
              aria-label={`${label} : unité`}
              value={unit}
              onChange={(e) => {
                const next = e.currentTarget.value;
                setUnit(next);
                if (split.amount) onChange(`P${split.amount}${next}`);
              }}
              className={`${CONTROL} sijil-select pe-9`}
            >
              {UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
            <Chevron />
          </span>
        </div>
      )}
      {description && (
        <p id={`${id}-aide`} className="text-sm text-gray-600">
          {description}
        </p>
      )}
    </div>
  );
}

/** Liste de valeurs libres (canaux, mots-clés…) : saisie puis Entrée ou « Ajouter ». */
export function ChipsField({
  label,
  description,
  values,
  placeholder,
  normalize = (v) => v,
  onChange,
}: {
  label: string;
  description?: string;
  values: string[];
  placeholder?: string;
  normalize?: (value: string) => string;
  onChange: (values: string[]) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const add = () => {
    const value = normalize(draft.trim());
    if (value && !values.includes(value)) onChange([...values, value]);
    setDraft("");
  };
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-gray-700">
        {label}
      </label>
      {values.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={`${label} : valeurs`}>
          {values.map((v) => (
            <li
              key={v}
              className="flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 py-0.5 ps-2.5 pe-1 text-sm text-gray-800"
            >
              {v}
              <button
                type="button"
                aria-label={`Retirer ${v}`}
                onClick={() => {
                  onChange(values.filter((x) => x !== v));
                }}
                className="flex size-6 items-center justify-center rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-900"
              >
                <CloseIcon className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          id={id}
          value={draft}
          placeholder={placeholder}
          aria-describedby={description ? `${id}-aide` : undefined}
          onChange={(e) => {
            setDraft(e.currentTarget.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          className={`${CONTROL} placeholder:text-gray-500`}
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="h-10 shrink-0 rounded-lg border border-orange-300 bg-orange-50 px-3 text-sm font-semibold text-orange-700 hover:bg-orange-100 disabled:opacity-50"
        >
          Ajouter
        </button>
      </div>
      {description && (
        <p id={`${id}-aide`} className="text-sm text-gray-600">
          {description}
        </p>
      )}
    </div>
  );
}

/** Cases à cocher pour une liste fermée de valeurs (rôles, parcours, formats). */
export function CheckboxGroup({
  legend,
  description,
  options,
  values,
  onChange,
}: {
  legend: string;
  description?: string;
  options: { value: string; label: string }[];
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-sm font-medium text-gray-700">{legend}</legend>
      <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {options.map((o) => (
          <label key={o.value} className="flex items-center gap-2 text-sm text-gray-900">
            <input
              type="checkbox"
              checked={values.includes(o.value)}
              onChange={(e) => {
                const on = e.currentTarget.checked;
                onChange(on ? [...values, o.value] : values.filter((v) => v !== o.value));
              }}
              className="size-4 accent-orange-700"
            />
            {o.label}
          </label>
        ))}
      </div>
      {description && <p className="text-sm text-gray-600">{description}</p>}
    </fieldset>
  );
}

/** Case à cocher seule, avec son explication. */
export function Switch({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        aria-describedby={description ? `${id}-aide` : undefined}
        onChange={(e) => {
          onChange(e.currentTarget.checked);
        }}
        className="mt-0.5 size-4 shrink-0 accent-orange-700"
      />
      <div className="flex flex-col gap-0.5">
        <label htmlFor={id} className="text-sm font-medium text-gray-900">
          {label}
        </label>
        {description && (
          <p id={`${id}-aide`} className="text-sm text-gray-600">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
