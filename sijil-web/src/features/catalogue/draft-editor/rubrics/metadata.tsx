import { useState, type ReactNode } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { EditorValues } from "@/features/catalogue/draft-editor/form";
import {
  constraintsOf,
  FORMAT_LABELS,
  schemaOf as termSchema,
  STATUS_LABELS,
  type Term,
  useTerms,
} from "@/features/catalogue/dictionary/terms";
import { Button, Notice, SelectField, Tag, TextLink } from "@/shared/ui";
import { ChevronIcon, CloseIcon } from "@/shared/ui/icons";
import { Switch } from "./controls";
import { objectOf, stringsOf, usePart, type Json } from "./part";

/** Métadonnées du schéma, dans l'ordre de ses propriétés. */
export function namesOf(schema: Json): string[] {
  return Object.keys(objectOf(schema["properties"]));
}

/** Schéma avec le terme ajouté en dernier, tel que le catalogue le recopiera. */
export function withTerm(schema: Json, term: Term): Json {
  return {
    type: "object",
    ...schema,
    properties: { ...objectOf(schema["properties"]), [term.code]: termSchema(term) },
  };
}

/** Schéma sans la métadonnée, ni dans les propriétés ni parmi les obligatoires. */
export function without(schema: Json, name: string): Json {
  const properties = Object.fromEntries(
    Object.entries(objectOf(schema["properties"])).filter(([n]) => n !== name),
  );
  return required({ ...schema, properties }, name, false);
}

/** Schéma où la métadonnée a pris la place de sa voisine (ordre d'affichage au dépôt). */
export function moved(schema: Json, name: string, delta: -1 | 1): Json {
  const entries = Object.entries(objectOf(schema["properties"]));
  const from = entries.findIndex(([n]) => n === name);
  const source = entries[from];
  const target = entries[from + delta];
  if (!source || !target) return schema;
  entries[from] = target;
  entries[from + delta] = source;
  return { ...schema, properties: Object.fromEntries(entries) };
}

/** Schéma où la métadonnée est, ou n'est plus, exigée au dépôt. */
export function required(schema: Json, name: string, value: boolean): Json {
  const current = stringsOf(schema["required"]).filter((n) => n !== name);
  const next = value ? [...current, name] : current;
  const rest = { ...schema };
  delete rest["required"];
  return next.length ? { ...rest, required: next } : rest;
}

/**
 * Rubrique « Métadonnées » (ADR 0038) : le contributeur choisit des termes actifs du dictionnaire,
 * tenu par le Data Office ; il ne règle que l'obligation au dépôt et l'ordre d'affichage.
 */
export function MetadataEditor({ form }: { form: UseFormReturn<EditorValues> }) {
  const part = usePart<Json>(form, "metadataSchema");
  const terms = useTerms();
  const [chosen, setChosen] = useState("");
  const schema = objectOf(part.value);
  const names = namesOf(schema);
  const mandatory = stringsOf(schema["required"]);
  const byCode = new Map((terms.data ?? []).map((t) => [t.code, t]));
  const available = (terms.data ?? []).filter(
    (t) => t.status === "ACTIF" && !names.includes(t.code),
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-600">
        Les informations demandées au dépôt d&apos;un document de ce type, choisies dans le{" "}
        <TextLink to="/catalogue/dictionnaire">dictionnaire de métadonnées</TextLink>. Il vous
        manque un champ ? Demandez-le au Data Office.
      </p>
      {terms.isError && (
        <Notice tone="danger" role="alert" title="Dictionnaire indisponible">
          Les termes ne peuvent pas être chargés ; réessayez plus tard.
        </Notice>
      )}
      {names.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-700">
          Aucune métadonnée pour l&apos;instant.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {names.map((name, index) => {
            const term = byCode.get(name);
            const title = term?.labelFr ?? name;
            return (
              <li
                key={name}
                aria-label={`Métadonnée ${String(index + 1)} : ${title}`}
                className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-semibold text-gray-900">{title}</span>
                    <span className="font-mono text-xs text-gray-600">{name}</span>
                    {term && (
                      <span className="text-sm text-gray-600">
                        {FORMAT_LABELS[term.format]} · {constraintsOf(term)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 in-[fieldset:disabled]:hidden">
                    <IconButton
                      label={`Monter ${title}`}
                      disabled={index === 0}
                      onClick={() => {
                        part.set(moved(schema, name, -1));
                      }}
                    >
                      <ChevronIcon className="size-4 rotate-90" />
                    </IconButton>
                    <IconButton
                      label={`Descendre ${title}`}
                      disabled={index === names.length - 1}
                      onClick={() => {
                        part.set(moved(schema, name, 1));
                      }}
                    >
                      <ChevronIcon className="size-4 -rotate-90" />
                    </IconButton>
                    <IconButton
                      label={`Retirer ${title}`}
                      onClick={() => {
                        part.set(without(schema, name));
                      }}
                    >
                      <CloseIcon className="size-4" />
                    </IconButton>
                  </div>
                </div>
                {terms.isSuccess && !term && (
                  <p className="flex flex-wrap items-center gap-2 text-sm text-red-700">
                    <Tag variant="danger">Hors dictionnaire</Tag>
                    La soumission sera refusée : retirez cette métadonnée ou demandez le terme au
                    Data Office.
                  </p>
                )}
                {term && term.status !== "ACTIF" && (
                  <p className="flex flex-wrap items-center gap-2 text-sm text-amber-800">
                    <Tag variant="warning">{STATUS_LABELS[term.status]}</Tag>
                    Ce terme n&apos;est plus admis dans une nouvelle version : remplacez-le.
                  </p>
                )}
                <Switch
                  label="Obligatoire au dépôt"
                  checked={mandatory.includes(name)}
                  onChange={(value) => {
                    part.set(required(schema, name, value));
                  }}
                />
              </li>
            );
          })}
        </ol>
      )}
      <div className="flex flex-wrap items-end gap-3 in-[fieldset:disabled]:hidden">
        <div className="min-w-64 flex-1 sm:max-w-md">
          <SelectField
            label="Métadonnée du dictionnaire"
            options={[
              {
                value: "",
                label: available.length ? "Choisir un terme actif" : "Aucun terme disponible",
              },
              ...available.map((t) => ({ value: t.code, label: `${t.labelFr} (${t.code})` })),
            ]}
            value={chosen}
            onChange={(e) => {
              setChosen(e.currentTarget.value);
            }}
          />
        </div>
        <Button
          variant="secondary"
          disabled={!byCode.has(chosen)}
          onClick={() => {
            const term = byCode.get(chosen);
            if (!term) return;
            part.set(withTerm(schema, term));
            setChosen("");
          }}
        >
          Ajouter
        </Button>
      </div>
    </div>
  );
}

function IconButton({
  label,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-8 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-200 hover:text-gray-900 disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
