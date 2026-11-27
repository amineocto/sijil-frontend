import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoadingState } from "@sijil/ui-kit";
import { api, call, isApiError, type Schemas } from "@/shared/api";
import { Button, Notice, SelectField, TextAreaField, TextField } from "@/shared/ui";
import { Drawer } from "@/shared/ui/Drawer";
import { ChipsField } from "@/features/catalogue/draft-editor/rubrics/controls";
import {
  FORMAT_LABELS,
  PERSONAL_DATA_LABELS,
  STATUS_LABELS,
  type Term,
  type TermFormat,
} from "@/features/catalogue/dictionary/terms";
import { at, textProblem, type Problems } from "@/shared/validation";

const CODE = /^[a-z][A-Za-z0-9]{0,63}$/;

interface Values {
  code: string;
  labelFr: string;
  labelAr: string;
  labelEn: string;
  definition: string;
  format: TermFormat;
  maxLength: string;
  pattern: string;
  values: string[];
  minimum: string;
  maximum: string;
  personalData: Schemas["PersonalData"];
  filenetProperty: string;
  status: Term["status"];
}

const EMPTY: Values = {
  code: "",
  labelFr: "",
  labelAr: "",
  labelEn: "",
  definition: "",
  format: "TEXT",
  maxLength: "",
  pattern: "",
  values: [],
  minimum: "",
  maximum: "",
  personalData: "AUCUNE",
  filenetProperty: "",
  status: "ACTIF",
};

function valuesOf(t: Term): Values {
  const text = (v: string | number | null | undefined) => (v == null ? "" : String(v));
  return {
    code: t.code,
    labelFr: t.labelFr,
    labelAr: text(t.labelAr),
    labelEn: text(t.labelEn),
    definition: text(t.definition),
    format: t.format,
    maxLength: text(t.maxLength),
    pattern: text(t.pattern),
    values: t.values,
    minimum: text(t.minimum),
    maximum: text(t.maximum),
    personalData: t.personalData,
    filenetProperty: text(t.filenetProperty),
    status: t.status,
  };
}

/** Contrôles du contrat `MetadataTermCreate`/`Update`, faits avant l'envoi. */
export function termProblems(v: Values, creating: boolean): Problems {
  const isNumber = v.format === "INTEGER" || v.format === "NUMBER";
  const numberProblem = (s: string) => {
    if (!s.trim()) return undefined;
    const n = Number(s);
    if (!Number.isFinite(n)) return "Nombre attendu";
    return v.format === "INTEGER" && !Number.isInteger(n) ? "Nombre entier attendu" : undefined;
  };
  const max = Number(v.maxLength);
  return {
    ...at(
      "code",
      creating && !CODE.test(v.code)
        ? "Une minuscule puis lettres et chiffres, sans espace"
        : undefined,
    ),
    ...at("labelFr", textProblem(v.labelFr, { required: true, max: 120 })),
    ...at("labelAr", textProblem(v.labelAr, { max: 120 })),
    ...at("labelEn", textProblem(v.labelEn, { max: 120 })),
    ...at("definition", textProblem(v.definition, { max: 1000 })),
    ...at("filenetProperty", textProblem(v.filenetProperty, { max: 128 })),
    ...(v.format === "TEXT"
      ? {
          ...at(
            "maxLength",
            v.maxLength.trim() && !(Number.isInteger(max) && max >= 1 && max <= 100000)
              ? "Nombre entier de 1 à 100 000"
              : undefined,
          ),
          ...at("pattern", patternProblem(v.pattern)),
        }
      : {}),
    ...(v.format === "ENUM"
      ? at(
          "values",
          v.values.length === 0
            ? "Ajoutez au moins une valeur"
            : v.values.length > 200
              ? "200 valeurs au plus"
              : v.values.some((x) => x.length > 120)
                ? "Chaque valeur fait 120 caractères au plus"
                : undefined,
        )
      : {}),
    ...(isNumber
      ? {
          ...at("minimum", numberProblem(v.minimum)),
          ...at(
            "maximum",
            numberProblem(v.maximum) ??
              (v.minimum.trim() && v.maximum.trim() && Number(v.minimum) > Number(v.maximum)
                ? "Le maximum doit être supérieur ou égal au minimum"
                : undefined),
          ),
        }
      : {}),
  };
}

/** Motif d'un terme : 200 caractères au plus, et une expression que le navigateur sait lire. */
function patternProblem(pattern: string): string | undefined {
  if (!pattern.trim()) return undefined;
  if (pattern.length > 200) return "200 caractères au plus";
  try {
    new RegExp(pattern, "u");
    return undefined;
  } catch {
    return "Expression régulière invalide";
  }
}

/** Termes envoyés : seuls ceux du format, sans champ vide (le contrat les refuserait). */
function termsOf(v: Values) {
  const text = (s: string) => (s.trim() ? s.trim() : undefined);
  const number = (s: string) => (s.trim() ? Number(s) : undefined);
  const isText = v.format === "TEXT";
  const isNumber = v.format === "INTEGER" || v.format === "NUMBER";
  return Object.fromEntries(
    Object.entries({
      labelFr: v.labelFr.trim(),
      labelAr: text(v.labelAr),
      labelEn: text(v.labelEn),
      definition: text(v.definition),
      maxLength: isText ? number(v.maxLength) : undefined,
      pattern: isText ? text(v.pattern) : undefined,
      values: v.format === "ENUM" ? v.values : undefined,
      minimum: isNumber ? number(v.minimum) : undefined,
      maximum: isNumber ? number(v.maximum) : undefined,
      personalData: v.personalData,
      filenetProperty: text(v.filenetProperty),
    }).filter(([, value]) => value !== undefined),
  ) as Schemas["MetadataTermUpdate"];
}

/**
 * Volet de création ou de modification d'un terme (Data Office). Le nom technique et le format
 * se choisissent à la création et ne changent plus : un changement de sens crée un nouveau terme.
 */
export function TermDrawer({
  code,
  readOnly = false,
  onClose,
  onSaved,
}: {
  code: string | undefined;
  /** Consultation par un profil qui ne tient pas le dictionnaire. */
  readOnly?: boolean;
  onClose: () => void;
  onSaved: (term: Term) => void;
}) {
  const current = useQuery({
    queryKey: ["metadata-terms", code],
    queryFn: () =>
      call(api.GET("/api/metadata-terms/{code}", { params: { path: { code: code ?? "" } } })),
    enabled: code !== undefined,
  });
  const title = readOnly
    ? `Terme ${code ?? ""}`
    : code
      ? `Modifier le terme ${code}`
      : "Nouveau terme";
  return (
    <Drawer
      label={title}
      title={<h2 className="text-lg font-semibold text-gray-900">{title}</h2>}
      width="max-w-2xl"
      onClose={onClose}
    >
      <div className="p-5 sm:p-6">
        {code && !current.data ? (
          current.error ? (
            <Notice tone="danger" role="alert" title="Terme introuvable">
              {isApiError(current.error) ? current.error.message : "Une erreur est survenue."}
            </Notice>
          ) : (
            <LoadingState />
          )
        ) : (
          <TermForm
            current={current.data}
            readOnly={readOnly}
            onCancel={onClose}
            onSaved={onSaved}
          />
        )}
      </div>
    </Drawer>
  );
}

function TermForm({
  current,
  readOnly,
  onCancel,
  onSaved,
}: {
  current: Term | undefined;
  readOnly: boolean;
  onCancel: () => void;
  onSaved: (term: Term) => void;
}) {
  const client = useQueryClient();
  const [v, setV] = useState<Values>(current ? valuesOf(current) : EMPTY);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [checked, setChecked] = useState(false);
  const set = (patch: Partial<Values>) => {
    setV((previous) => ({ ...previous, ...patch }));
  };
  const problems = termProblems(v, !current);
  const shown = (key: string) => (checked ? problems[key] : undefined);

  const save = useMutation({
    mutationFn: () =>
      current
        ? call(
            api.PUT("/api/metadata-terms/{code}", {
              params: { path: { code: current.code }, header: { "If-Match": current.etag ?? "" } },
              body: { ...termsOf(v), status: v.status },
            }),
          )
        : call(
            api.POST("/api/metadata-terms", {
              params: { header: { "Idempotency-Key": idempotencyKey } },
              body: { ...termsOf(v), code: v.code.trim(), format: v.format },
            }),
          ),
    onSuccess: (term) => {
      void client.invalidateQueries({ queryKey: ["metadata-terms"] });
      onSaved(term);
    },
  });

  return (
    <form
      aria-label={
        readOnly && current
          ? `Terme ${current.code}`
          : current
            ? `Modification du terme ${current.code}`
            : "Nouveau terme"
      }
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setChecked(true);
        if (Object.keys(problems).length === 0) save.mutate();
      }}
    >
      <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            label="Nom technique"
            description={
              current ? "Ne change plus." : "Celui du schéma des types, par exemple dateExpiration."
            }
            required
            readOnly={current !== undefined}
            value={v.code}
            error={shown("code")}
            onChange={(e) => {
              set({ code: e.currentTarget.value });
            }}
          />
          <SelectField
            label="Format"
            description={current ? "Ne change plus." : undefined}
            disabled={current !== undefined}
            options={Object.entries(FORMAT_LABELS).map(([value, label]) => ({ value, label }))}
            value={v.format}
            onChange={(e) => {
              set({ format: e.currentTarget.value as TermFormat });
            }}
          />
        </div>
        <TextField
          label="Libellé français"
          required
          value={v.labelFr}
          error={shown("labelFr")}
          onChange={(e) => {
            set({ labelFr: e.currentTarget.value });
          }}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            label="Libellé arabe"
            error={shown("labelAr")}
            dir="rtl"
            lang="ar"
            value={v.labelAr}
            onChange={(e) => {
              set({ labelAr: e.currentTarget.value });
            }}
          />
          <TextField
            label="Libellé anglais"
            error={shown("labelEn")}
            lang="en"
            value={v.labelEn}
            onChange={(e) => {
              set({ labelEn: e.currentTarget.value });
            }}
          />
        </div>
        <TextAreaField
          label="Définition"
          error={shown("definition")}
          description="Ce que la métadonnée contient et d'où elle vient."
          rows={2}
          value={v.definition}
          onChange={(e) => {
            set({ definition: e.currentTarget.value });
          }}
        />
        {v.format === "TEXT" && (
          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              label="Longueur maximale"
              error={shown("maxLength")}
              type="number"
              min={1}
              value={v.maxLength}
              onChange={(e) => {
                set({ maxLength: e.currentTarget.value });
              }}
            />
            <TextField
              label="Motif"
              error={shown("pattern")}
              description="Expression régulière, par exemple ^[A-Z]{3}$."
              value={v.pattern}
              onChange={(e) => {
                set({ pattern: e.currentTarget.value });
              }}
            />
          </div>
        )}
        {v.format === "ENUM" && (
          <ChipsField
            label="Valeurs permises"
            placeholder="Ajouter une valeur"
            values={v.values}
            onChange={(values) => {
              set({ values });
            }}
          />
        )}
        {v.format === "ENUM" && shown("values") && (
          <p className="text-sm text-red-700" role="alert">
            {shown("values")}
          </p>
        )}
        {(v.format === "INTEGER" || v.format === "NUMBER") && (
          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              label="Minimum"
              error={shown("minimum")}
              type="number"
              value={v.minimum}
              onChange={(e) => {
                set({ minimum: e.currentTarget.value });
              }}
            />
            <TextField
              label="Maximum"
              error={shown("maximum")}
              type="number"
              value={v.maximum}
              onChange={(e) => {
                set({ maximum: e.currentTarget.value });
              }}
            />
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField
            label="Donnée personnelle"
            description="Classification à confirmer avec le DPO (ADR 0018)."
            options={Object.entries(PERSONAL_DATA_LABELS).map(([value, label]) => ({
              value,
              label,
            }))}
            value={v.personalData}
            onChange={(e) => {
              set({ personalData: e.currentTarget.value as Values["personalData"] });
            }}
          />
          <TextField
            label="Propriété FileNet"
            error={shown("filenetProperty")}
            description="Facultative tant que l'atelier FileNet n'a pas fixé les propriétés."
            value={v.filenetProperty}
            onChange={(e) => {
              set({ filenetProperty: e.currentTarget.value });
            }}
          />
        </div>
        {current && (
          <SelectField
            label="Statut"
            description="Un terme déprécié n'est plus admis dans une nouvelle version ; un terme retiré ne change plus."
            options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
            value={v.status}
            onChange={(e) => {
              set({ status: e.currentTarget.value as Values["status"] });
            }}
          />
        )}
      </fieldset>
      {save.error && (
        <Notice tone="danger" role="alert" title="Enregistrement refusé">
          {isApiError(save.error) ? save.error.message : "Une erreur est survenue."}
        </Notice>
      )}
      <div className="flex gap-3">
        {!readOnly && (
          <Button type="submit" loading={save.isPending}>
            Enregistrer
          </Button>
        )}
        <Button variant={readOnly ? "secondary" : "ghost"} onClick={onCancel}>
          {readOnly ? "Fermer" : "Annuler"}
        </Button>
      </div>
    </form>
  );
}
