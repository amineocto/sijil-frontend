import { useId, useState } from "react";
import { useNavigate } from "react-router";
import { dossierPath } from "@/features/dossier/paths";
import { PARTY_OPTIONS } from "@/shared/labels";
import type { PartyType } from "@/shared/types";
import { Chevron, SearchIcon } from "@/shared/ui/icons";

/**
 * Recherche d'un dossier par partie, dans l'en-tête : type de partie et identifiant, puis ouverture
 * du dossier. Aucune donnée ne part dans l'adresse au-delà de l'identifiant de la partie.
 */
export function PartyLookup({
  className,
  tour,
  label = "Ouvrir un dossier",
}: {
  className?: string;
  tour?: string;
  label?: string;
}) {
  const navigate = useNavigate();
  const [type, setType] = useState<PartyType>("CLIENT");
  const [id, setId] = useState("");
  const prefix = useId();
  return (
    <form
      role="search"
      aria-label={label}
      data-tour={tour}
      className={`flex h-11 items-center rounded-xl border border-gray-300 bg-white shadow-xs focus-within:border-orange-700 focus-within:ring-2 focus-within:ring-orange-700/20 ${className ?? ""}`}
      onSubmit={(event) => {
        event.preventDefault();
        const value = id.trim();
        if (value) void navigate(dossierPath(type, value));
      }}
    >
      <label className="sr-only" htmlFor={`${prefix}-type`}>
        Type de partie
      </label>
      <span className="relative h-full shrink-0">
        <select
          id={`${prefix}-type`}
          value={type}
          onChange={(e) => {
            setType(e.currentTarget.value as PartyType);
          }}
          className="sijil-select h-full rounded-s-xl border-e border-gray-200 bg-gray-50 ps-3 pe-8 text-sm font-medium text-gray-700 focus:outline-none focus-visible:bg-orange-50"
        >
          {PARTY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Chevron className="end-2.5" />
      </span>
      <label className="sr-only" htmlFor={`${prefix}-id`}>
        Identifiant de la partie
      </label>
      <input
        id={`${prefix}-id`}
        type="search"
        autoComplete="off"
        placeholder="Identifiant du client, de la personne ou du compte"
        value={id}
        onChange={(e) => {
          setId(e.currentTarget.value);
        }}
        className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none"
      />
      <button
        type="submit"
        aria-label="Ouvrir le dossier"
        className="me-1 flex size-9 items-center justify-center rounded-lg text-gray-600 hover:bg-orange-50 hover:text-orange-700 focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:outline-none"
      >
        <SearchIcon />
      </button>
    </form>
  );
}
