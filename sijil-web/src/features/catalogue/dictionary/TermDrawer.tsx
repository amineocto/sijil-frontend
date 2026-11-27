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
  const codeError =
    !current && checked && !CODE.test(v.code)
      ? "Une minuscule puis lettres et chiffres, sans espace"
      : undefined;
  const labelError =
    checked && !v.labelFr.trim() ? "Le libellé français est obligatoire" : undefined;

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
        if ((current || CODE.test(v.code)) && v.labelFr.trim()) save.mutate();
      }}
    >
      <fieldset disabled={readOnly} className="flex flex-col gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            label="Nom technique"
            description={
              current ? "Ne change plus." : "Celui du schéma des types, par exemple dateExpiration."
            }
            required
            readOnly={current !== undefined}
            value={v.code}
            error={codeError}
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
          error={labelError}
          onChange={(e) => {
            set({ labelFr: e.currentTarget.value });
          }}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            label="Libellé arabe"
            dir="rtl"
            lang="ar"
            value={v.labelAr}
            onChange={(e) => {
              set({ labelAr: e.currentTarget.value });
            }}
          />
          <TextField
            label="Libellé anglais"
            lang="en"
            value={v.labelEn}
            onChange={(e) => {
              set({ labelEn: e.currentTarget.value });
            }}
          />
        </div>
        <TextAreaField
          label="Définition"
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
              type="number"
              min={1}
              value={v.maxLength}
              onChange={(e) => {
                set({ maxLength: e.currentTarget.value });
              }}
            />
            <TextField
              label="Motif"
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
        {(v.format === "INTEGER" || v.format === "NUMBER") && (
          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              label="Minimum"
              type="number"
              value={v.minimum}
              onChange={(e) => {
                set({ minimum: e.currentTarget.value });
              }}
            />
            <TextField
              label="Maximum"
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
