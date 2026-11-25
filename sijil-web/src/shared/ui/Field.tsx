import { useId, type ReactNode } from "react";

export interface FieldProps {
  label: string;
  description?: string | undefined;
  error?: string | undefined;
  required?: boolean | undefined;
  /** Libellé lu par les lecteurs d'écran mais non affiché (filtre d'une barre d'outils). */
  hideLabel?: boolean | undefined;
}

interface FieldIds {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
}

/**
 * Libellé, aide et erreur reliés au contrôle (`htmlFor`, `aria-describedby`) : les libellés des
 * champs d'`@awb/ui` ne le sont pas, un lecteur d'écran ne les annoncerait pas (ADR 0037).
 */
export function Field({
  label,
  description,
  error,
  required,
  hideLabel,
  children,
}: FieldProps & { children: (ids: FieldIds) => ReactNode }) {
  const id = useId();
  const described = [description && `${id}-aide`, error && `${id}-erreur`].filter(Boolean);
  return (
    <div className="flex w-full flex-col gap-1.5">
      <label htmlFor={id} className={hideLabel ? "sr-only" : "text-sm font-medium text-gray-700"}>
        {label}
        {required && (
          <span className="ms-0.5 text-red-700" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children({
        id,
        ...(described.length > 0 ? { "aria-describedby": described.join(" ") } : {}),
        ...(error ? { "aria-invalid": true as const } : {}),
      })}
      {description && (
        <p id={`${id}-aide`} className="text-sm text-gray-600">
          {description}
        </p>
      )}
      {error && (
        <p id={`${id}-erreur`} className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Classes des champs d'`@awb/ui`, pour les contrôles natifs : 40 px de haut comme les boutons de la
 * charte (champs et boutons s'alignent), 16 px de texte sur mobile (pas de zoom à la saisie).
 */
export const CONTROL =
  "h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-base text-gray-900 outline-none transition-colors hover:border-gray-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 aria-[invalid=true]:border-red-500 disabled:bg-gray-50 disabled:text-gray-500 sm:text-sm";
