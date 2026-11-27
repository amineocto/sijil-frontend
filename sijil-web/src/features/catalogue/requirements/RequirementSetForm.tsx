import { useState } from "react";
import {
  CheckboxGroup,
  ChipsField,
  PeriodField,
  Switch,
} from "@/features/catalogue/draft-editor/rubrics/controls";
import { useTypeIndex } from "@/features/dossier/typeIndex";
import type { Schemas } from "@/shared/api";
import { PARTY_ROLE_LABELS, PARTY_TYPE_LABELS } from "@/shared/labels";
import { Button, Heading, SelectField, Tag, TextField } from "@/shared/ui";
import { AddIcon, DeleteIcon } from "@/shared/ui/icons";

export type Definition = Schemas["RequirementSetDefinition"];
export type Requirement = Definition["requirements"][number];
type Scalar = string | number | boolean;

export const ASSURANCE_LABELS: Record<string, string> = {
  DECLARE: "Déclarée par le client",
  CONTROLE_AUTO: "Contrôlée automatiquement",
  VERIFIE_PARCOURS: "Vérifiée par le parcours",
  SOURCE_OFFICIELLE: "Issue d'une source officielle",
};

const ID = /^[a-z][a-z0-9_-]{0,31}$/;

/** Identifiant technique tiré du libellé : « Pièce d'identité » → `piece-d-identite`. */
export function idOf(label: string): string {
  const slug = label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
    .replace(/-+$/, "");
  return /^[a-z]/.test(slug) ? slug : slug ? `e-${slug}`.slice(0, 32) : "";
}

/** Erreurs du formulaire, par champ ; vide si la définition peut être enregistrée. */
export function problemsOf(d: Definition): Record<string, string> {
  const out: Record<string, string> = {};
  if (d.label.trim().length < 3) out["label"] = "Au moins 3 caractères";
  if (d.requirements.length === 0) out["requirements"] = "Ajoutez au moins une exigence";
  const ids = new Set<string>();
  d.requirements.forEach((r, i) => {
    if (!ID.test(r.id)) out[`${String(i)}.id`] = "Une minuscule puis lettres, chiffres, - ou _";
    else if (ids.has(r.id)) out[`${String(i)}.id`] = "Déjà utilisé par une autre exigence";
    ids.add(r.id);
    if (r.anyOf.length === 0) out[`${String(i)}.anyOf`] = "Choisissez au moins un type";
    if (r.for?.roles && r.for.roles.length === 0)
      out[`${String(i)}.for`] = "Choisissez au moins un rôle";
  });
  return out;
}

/** Définition envoyée : sans condition restée vide (le schéma veut au moins une valeur). */
export function cleaned(d: Definition): Definition {
  return {
    ...d,
    label: d.label.trim(),
    requirements: d.requirements.map((r) => {
      const when = Object.fromEntries(
        Object.entries(r.when ?? {}).filter(([, v]) => !Array.isArray(v) || v.length > 0),
      );
      const rest: Requirement = { ...r };
      delete rest.when;
      return Object.keys(when).length ? { ...rest, when } : rest;
    }),
  };
}

const NEW_REQUIREMENT: Requirement = {
  id: "",
  label: "",
  anyOf: [],
  freshness: "VALID_ON_DATE",
};

/**
 * Formulaire d'un jeu d'exigences (L7-04) : une carte par pièce attendue, sans JSON. En lecture
 * seule, les mêmes champs sont désactivés.
 */
export function RequirementSetForm({
  value,
  onChange,
  readOnly,
  showErrors,
}: {
  value: Definition;
  onChange: (next: Definition) => void;
  readOnly: boolean;
  showErrors: boolean;
}) {
  const problems = showErrors ? problemsOf(value) : {};
  const setRequirement = (i: number, next: Requirement) => {
    onChange({ ...value, requirements: value.requirements.map((r, j) => (j === i ? next : r)) });
  };
  return (
    <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-5">
      <TextField
        label="Libellé du jeu"
        description="Par exemple « Ouverture de compte particulier »."
        required
        value={value.label}
        error={problems["label"]}
        onChange={(e) => {
          onChange({ ...value, label: e.currentTarget.value });
        }}
      />
      {value.requirements.map((r, i) => (
        <RequirementCard
          // L'ordre ne change qu'à la suppression : l'index suffit à garder la saisie en cours.
          key={i}
          index={i}
          requirement={r}
          problems={problems}
          readOnly={readOnly}
          onChange={(next) => {
            setRequirement(i, next);
          }}
          onRemove={() => {
            onChange({ ...value, requirements: value.requirements.filter((_, j) => j !== i) });
          }}
        />
      ))}
      {problems["requirements"] && (
        <p className="text-sm text-red-700" role="alert">
          {problems["requirements"]}
        </p>
      )}
      {!readOnly && (
        <div>
          <Button
            variant="secondary"
            onClick={() => {
              onChange({ ...value, requirements: [...value.requirements, NEW_REQUIREMENT] });
            }}
          >
            <AddIcon className="size-4" />
            Ajouter une exigence
          </Button>
        </div>
      )}
    </fieldset>
  );
}

type PartyScope = "ALL" | "ROLES" | "LEVEL";

function RequirementCard({
  index,
  requirement: r,
  problems,
  readOnly,
  onChange,
  onRemove,
}: {
  index: number;
  requirement: Requirement;
  problems: Record<string, string>;
  readOnly: boolean;
  onChange: (next: Requirement) => void;
  onRemove: () => void;
}) {
  const types = useTypeIndex();
  const [pick, setPick] = useState("");
  const n = String(index);
  const title = r.label?.trim() || `Exigence ${String(index + 1)}`;
  // Une valeur `undefined` retire le champ de l'exigence.
  const set = (patch: { [K in keyof Requirement]?: Requirement[K] | undefined }) => {
    const next = Object.fromEntries(
      Object.entries({ ...r, ...patch }).filter(([, v]) => v !== undefined),
    );
    onChange(next as Requirement);
  };
  const scope: PartyScope = r.for?.roles ? "ROLES" : r.for?.level ? "LEVEL" : "ALL";
  const byPeriod = r.freshness !== "VALID_ON_DATE";
  const available = Object.entries(types)
    .filter(([code]) => !r.anyOf.includes(code))
    .map(([code, t]) => ({ value: code, label: `${t.label ?? code} (${code})` }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <section
      aria-label={title}
      className="flex flex-col gap-4 rounded-lg border border-gray-200 p-4 sm:p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <Heading level={4}>{title}</Heading>
        {!readOnly && (
          <Button variant="ghost" size="sm" aria-label={`Supprimer ${title}`} onClick={onRemove}>
            <DeleteIcon className="size-4" />
            Supprimer
          </Button>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          label="Libellé"
          description="Ce que le parcours attend, par exemple « Pièce d'identité valide »."
          value={r.label ?? ""}
          onChange={(e) => {
            const label = e.currentTarget.value;
            // L'identifiant suit le libellé tant qu'il n'a pas été changé à la main.
            const follows = r.id === "" || r.id === idOf(r.label ?? "");
            set({ label: label || undefined, id: follows ? idOf(label) : r.id });
          }}
        />
        <TextField
          label="Identifiant"
          description="Rempli depuis le libellé ; il nomme l'exigence dans les résultats."
          required
          value={r.id}
          error={problems[`${n}.id`]}
          onChange={(e) => {
            set({ id: e.currentTarget.value.toLowerCase() });
          }}
        />
      </div>
      <div className="flex flex-col gap-2">
        {readOnly ? (
          <p className="text-sm font-medium text-gray-700">Types de document acceptés</p>
        ) : (
          <SelectField
            label="Types de document acceptés"
            description="Un seul des types choisis suffit."
            placeholder={available.length ? "Ajouter un type" : "Aucun autre type"}
            options={available}
            value={pick}
            error={problems[`${n}.anyOf`]}
            onChange={(e) => {
              const code = e.currentTarget.value;
              if (code) set({ anyOf: [...r.anyOf, code] });
              setPick("");
            }}
          />
        )}
        {r.anyOf.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Types acceptés">
            {r.anyOf.map((code) => (
              <li key={code} className="flex items-center gap-1">
                <Tag variant="outline">{types[code]?.label ?? code}</Tag>
                {!readOnly && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Retirer ${types[code]?.label ?? code}`}
                    onClick={() => {
                      set({ anyOf: r.anyOf.filter((c) => c !== code) });
                    }}
                  >
                    Retirer
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          label="Nombre de pièces"
          description="De 1 à 12, par exemple 3 bulletins de salaire."
          type="number"
          min={1}
          max={12}
          placeholder="1"
          value={r.count === undefined ? "" : String(r.count)}
          onChange={(e) => {
            // Vide ou 1 : la valeur par défaut du schéma, sans l'écrire.
            const count = Number(e.currentTarget.value);
            set({ count: count > 1 ? count : undefined });
          }}
        />
        <SelectField
          label="Confiance minimale"
          options={[
            { value: "", label: "Aucune exigence" },
            ...Object.entries(ASSURANCE_LABELS).map(([value, label]) => ({ value, label })),
          ]}
          value={r.minAssurance ?? ""}
          onChange={(e) => {
            set({ minAssurance: e.currentTarget.value || undefined });
          }}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField
          label="Parties concernées"
          options={[
            { value: "ALL", label: "Chaque partie de la demande" },
            { value: "ROLES", label: "Selon leur rôle" },
            { value: "LEVEL", label: "Selon le niveau du document" },
          ]}
          value={scope}
          onChange={(e) => {
            const next = e.currentTarget.value as PartyScope;
            set({
              for:
                next === "ROLES"
                  ? { roles: ["TITULAIRE"] }
                  : next === "LEVEL"
                    ? { level: "CLIENT" }
                    : undefined,
            });
          }}
        />
        {scope === "LEVEL" && (
          <SelectField
            label="Niveau"
            options={Object.entries(PARTY_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
            value={r.for?.level ?? "CLIENT"}
            onChange={(e) => {
              set({ for: { level: e.currentTarget.value } });
            }}
          />
        )}
      </div>
      {scope === "ROLES" && (
        <CheckboxGroup
          legend="Rôles"
          options={Object.entries(PARTY_ROLE_LABELS).map(([value, label]) => ({ value, label }))}
          values={r.for?.roles ?? []}
          onChange={(roles) => {
            set({ for: { roles } });
          }}
        />
      )}
      {problems[`${n}.for`] && (
        <p className="text-sm text-red-700" role="alert">
          {problems[`${n}.for`]}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField
          label="Fraîcheur"
          options={[
            { value: "VALID_ON_DATE", label: "Non expirée à la date de l'évaluation" },
            { value: "PERIOD", label: "Datée de moins de…" },
          ]}
          value={byPeriod ? "PERIOD" : "VALID_ON_DATE"}
          onChange={(e) => {
            set({ freshness: e.currentTarget.value === "PERIOD" ? "P3M" : "VALID_ON_DATE" });
          }}
        />
        {byPeriod && (
          <PeriodField
            label="Ancienneté maximale"
            description="À compter de la date du document."
            required
            value={r.freshness}
            onChange={(freshness) => {
              set({ freshness: freshness ?? "P3M" });
            }}
          />
        )}
      </div>
      <Switch
        label="Une pièce déjà connue de la banque compte"
        description="Sinon, seule une pièce collectée dans ce dossier satisfait l'exigence."
        checked={r.reusable !== false}
        onChange={(reusable) => {
          set({ reusable: reusable ? undefined : false });
        }}
      />
      <Conditions
        readOnly={readOnly}
        when={(r.when ?? {}) as Record<string, Scalar | Scalar[]>}
        onChange={(when) => {
          set({ when: Object.keys(when).length ? when : undefined });
        }}
      />
    </section>
  );
}

/**
 * Conditions sur le contexte de la demande : l'exigence ne s'applique que si chaque champ vaut
 * l'une des valeurs listées. Une valeur saisie garde le type d'origine quand elle n'a pas changé.
 */
function Conditions({
  when,
  readOnly,
  onChange,
}: {
  when: Record<string, Scalar | Scalar[]>;
  readOnly: boolean;
  onChange: (next: Record<string, Scalar | Scalar[]>) => void;
}) {
  const [field, setField] = useState("");
  const entries = Object.entries(when);
  const valuesOf = (v: Scalar | Scalar[]) => (Array.isArray(v) ? v : [v]);
  const update = (key: string, texts: string[]) => {
    const original = valuesOf(when[key] ?? []);
    const typed = texts.map((t) => original.find((o) => String(o) === t) ?? t);
    const others = Object.entries(when).filter(([k]) => k !== key);
    const value = typed.length === 1 ? (typed[0] as Scalar) : typed;
    onChange(Object.fromEntries(typed.length === 0 ? others : [...others, [key, value]]));
  };
  return (
    <div className="flex flex-col gap-3">
      <h5 className="text-sm font-semibold text-gray-900">Conditions d&apos;application</h5>
      {entries.length === 0 && (
        <p className="text-sm text-gray-600">
          Aucune : l&apos;exigence s&apos;applique à toutes les demandes.
        </p>
      )}
      {readOnly &&
        entries.map(([key, v]) => (
          <p key={key} className="text-sm text-gray-800">
            Quand « {key} » vaut {valuesOf(v).map(String).join(" ou ")}
          </p>
        ))}
      {!readOnly &&
        entries.map(([key, v]) => (
          <ChipsField
            key={key}
            label={`Quand « ${key} » vaut`}
            description="L'une de ces valeurs ; retirez-les toutes pour supprimer la condition."
            values={valuesOf(v).map(String)}
            onChange={(texts) => {
              update(key, texts);
            }}
          />
        ))}
      {!readOnly && (
        <div className="flex items-end gap-2">
          <TextField
            label="Nouvelle condition sur le champ"
            description="Nom d'un champ du contexte transmis par le parcours, par exemple segment."
            value={field}
            onChange={(e) => {
              setField(e.currentTarget.value.replace(/[^A-Za-z0-9]/g, ""));
            }}
          />
          <Button
            variant="secondary"
            disabled={!/^[a-zA-Z][a-zA-Z0-9]{0,31}$/.test(field) || field in when}
            onClick={() => {
              onChange({ ...when, [field]: [] as Scalar[] });
              setField("");
            }}
          >
            <AddIcon className="size-4" />
            Ajouter la condition
          </Button>
        </div>
      )}
    </div>
  );
}
