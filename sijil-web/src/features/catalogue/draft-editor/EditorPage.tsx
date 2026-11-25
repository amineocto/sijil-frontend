import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch, type FieldErrors, type UseFormReturn } from "react-hook-form";
import { useParams } from "react-router";
import { ErrorState } from "@sijil/ui-kit";
import { api, call, isApiError, type Schemas } from "@/shared/api";
import { errorLabel, STATUS_LABELS } from "@/features/catalogue/shared/labels";
import { Page } from "@/shared/ui/page";
import { QueryState } from "@/shared/QueryState";
import { RUBRIQUES, type Rubrique } from "@/features/catalogue/shared/rubriques";
import {
  editorSchema,
  fieldOfPointer,
  LEVELS,
  SENSITIVITIES,
  toDefinition,
  toValues,
  type EditorValues,
} from "@/features/catalogue/draft-editor/form";
import { MetadataPreview } from "@/features/catalogue/draft-editor/MetadataPreview";
import {
  FilenetEditor,
  PartiesEditor,
  ProcessingEditor,
  RetentionEditor,
  StorageEditor,
  ValidityEditor,
  VisibilityEditor,
} from "@/features/catalogue/draft-editor/rubrics/editors";
import { MetadataEditor } from "@/features/catalogue/draft-editor/rubrics/metadata";
import { parse } from "@/features/catalogue/draft-editor/rubrics/part";
import { FAMILY_LABELS } from "@/features/dossier/dossier";
import { PARTY_TYPE_LABELS, SENSITIVITY_LABELS } from "@/shared/labels";
import {
  Button,
  ButtonLink,
  Notice,
  Panel,
  SelectField,
  Tabs,
  Tag,
  TextAreaField,
  TextField,
  TextLink,
} from "@/shared/ui";

/** Écran « Éditeur de brouillon » : formulaire par rubriques, enregistrement avec `If-Match`. */
export function EditorPage() {
  const code = useParams()["code"] ?? "";
  const editor = useQuery({
    queryKey: ["editor", code],
    queryFn: () => call(api.GET("/api/types/{code}/editor", { params: { path: { code } } })),
  });
  return (
    <Page
      title={<>Brouillon du type {code}</>}
      subtitle="La version publiée reste en vigueur pour les dépôts jusqu'à la publication de ce brouillon."
      width="wide"
    >
      <QueryState query={editor}>
        {(data) => <EditorForm key={String(data.version)} initial={data} />}
      </QueryState>
    </Page>
  );
}

function EditorForm({ initial }: { initial: Schemas["Editor"] }) {
  const queryClient = useQueryClient();
  const [etag, setEtag] = useState(initial.etag);
  const [unplaced, setUnplaced] = useState<string[]>([]);
  const form = useForm<EditorValues>({
    resolver: zodResolver(editorSchema),
    defaultValues: toValues(initial.definition),
    mode: "onBlur",
  });
  const save = useMutation({
    mutationFn: (values: EditorValues) =>
      call(
        api.PUT("/api/types/{code}/editor", {
          params: {
            path: { code: initial.code },
            header: { "If-Match": etag },
          },
          body: { definition: toDefinition(values) },
        }),
      ),
    onSuccess: (saved, values) => {
      setEtag(saved.etag);
      setUnplaced([]);
      form.reset(values);
      queryClient.setQueryData(["editor", initial.code], saved);
      void queryClient.invalidateQueries({ queryKey: ["type", initial.code] });
    },
    onError: (error) => {
      if (!isApiError(error)) return;
      const notPlaced: string[] = [];
      for (const { field, code } of error.fieldErrors) {
        const name = fieldOfPointer(field);
        if (name) {
          form.setError(name as keyof EditorValues, {
            type: "server",
            message: errorLabel(code),
          });
        } else {
          notPlaced.push(`${field} : ${errorLabel(code)}`);
        }
      }
      setUnplaced(notPlaced);
    },
  });
  const editable = initial.status === "BROUILLON";

  return (
    <form
      noValidate
      aria-label="Définition du type"
      className="flex flex-col gap-4"
      onSubmit={(event) =>
        void form.handleSubmit((values) => {
          save.mutate(values);
        })(event)
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <Tag variant="outline">Version {initial.version}</Tag>
        <Tag>{STATUS_LABELS[initial.status]}</Tag>
        <TextLink to={`/catalogue/types/${initial.code}`}>Voir la fiche</TextLink>
      </div>
      {initial.reviewReason && (
        <Notice tone="warning" title="Modifications demandées par la revue" role="note">
          {initial.reviewReason}
        </Notice>
      )}
      {!editable && (
        <Notice tone="info" title="Version non modifiable" role="note">
          Cette version est à l&apos;état « {STATUS_LABELS[initial.status]} ».
        </Notice>
      )}
      <Panel>
        <fieldset disabled={!editable}>
          <Rubriques form={form} />
        </fieldset>
      </Panel>
      {save.isSuccess && !form.formState.isDirty && (
        <Notice tone="success" role="status" title="Brouillon enregistré" />
      )}
      {unplaced.length > 0 && (
        <Notice tone="danger" title="Erreurs signalées par le serveur">
          <ul className="list-disc ps-5">
            {unplaced.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </Notice>
      )}
      {isApiError(save.error) && save.error.status === 412 && (
        <Notice tone="danger" title="Le brouillon a été modifié entre-temps">
          Rechargez la page pour repartir de la dernière version, puis refaites vos modifications.
        </Notice>
      )}
      {isApiError(save.error) && ![412, 422].includes(save.error.status) && (
        <ErrorState error={save.error} headingLevel={3} />
      )}
      {editable && (
        <div className="flex flex-wrap gap-3">
          <Button type="submit" loading={save.isPending}>
            Enregistrer
          </Button>
          <ButtonLink
            to={`/catalogue/types/${initial.code}/soumission`}
            variant="secondary"
            disabled={form.formState.isDirty}
          >
            Soumettre
          </ButtonLink>
        </div>
      )}
    </form>
  );
}

function Rubriques({ form }: { form: UseFormReturn<EditorValues> }) {
  const errors = form.formState.errors;
  const [advanced, setAdvanced] = useState<Record<string, boolean>>({});
  const texts = useWatch({ control: form.control, name: "json" });
  return (
    <Tabs
      label="Rubriques de la définition"
      keepMounted
      tabs={RUBRIQUES.map((rubrique) => {
        const count = errorCount(rubrique, errors);
        // Un texte qui n'est pas du JSON ne s'édite qu'en mode avancé : les champs l'écraseraient.
        const broken = rubrique.jsonKeys.some((key) => !parse(texts[key] ?? "").valid);
        const showJson = broken || advanced[rubrique.id] === true;
        const jsonErrors = rubrique.jsonKeys
          .map((key) => errors.json?.[key]?.message)
          .filter((m): m is string => Boolean(m));
        return {
          id: rubrique.id,
          label: (
            <>
              {rubrique.label}
              {count > 0 && (
                <span
                  className="rounded-full bg-red-100 px-2 text-xs text-red-700"
                  aria-label={`${String(count)} erreur(s)`}
                >
                  {count}
                </span>
              )}
            </>
          ),
          content: (
            <div className="flex flex-col gap-5">
              {rubrique.id === "identite" && <IdentityFields form={form} />}
              {rubrique.id === "sensibilite" && (
                <SelectField
                  label="Sensibilité"
                  description="Un document sensible ou restreint n'est visible que des profils habilités."
                  options={[
                    { value: "", label: "Non renseignée" },
                    ...SENSITIVITIES.map((v) => ({ value: v, label: SENSITIVITY_LABELS[v] ?? v })),
                  ]}
                  error={errors.sensitivity?.message}
                  {...form.register("sensitivity")}
                />
              )}
              {!showJson && jsonErrors.length > 0 && (
                <Notice tone="danger" title="À corriger dans cette rubrique">
                  <ul className="list-disc ps-5">
                    {jsonErrors.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </Notice>
              )}
              {!showJson && <StructuredRubric id={rubrique.id} form={form} />}
              {broken && (
                <Notice tone="warning" title="JSON invalide" role="status">
                  Corrigez le texte de cette rubrique pour retrouver ses champs.
                </Notice>
              )}
              {showJson &&
                rubrique.jsonKeys.map((key) => (
                  <TextAreaField
                    key={key}
                    label={`${key} (JSON)`}
                    rows={4}
                    className="font-mono text-sm"
                    error={errors.json?.[key]?.message}
                    {...form.register(`json.${key}`)}
                  />
                ))}
              {rubrique.jsonKeys.length > 0 && !broken && (
                <div>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-pressed={showJson}
                    onClick={() => {
                      setAdvanced({ ...advanced, [rubrique.id]: !showJson });
                    }}
                  >
                    {showJson ? "Revenir aux champs" : "Modifier en JSON (avancé)"}
                  </Button>
                </div>
              )}
              {rubrique.id === "metadonnees" && <MetadataPreviewOf form={form} />}
            </div>
          ),
        };
      })}
    />
  );
}

/** Champs d'une rubrique ; les clés JSON qu'elle porte sont réécrites à chaque saisie. */
function StructuredRubric({ id, form }: { id: string; form: UseFormReturn<EditorValues> }) {
  switch (id) {
    case "identite":
      return <PartiesEditor form={form} />;
    case "metadonnees":
      return <MetadataEditor form={form} />;
    case "validite":
      return <ValidityEditor form={form} />;
    case "retention":
      return <RetentionEditor form={form} />;
    case "stockage":
      return <StorageEditor form={form} />;
    case "traitements":
      return <ProcessingEditor form={form} />;
    case "sensibilite":
      return <VisibilityEditor form={form} />;
    case "filenet":
      return <FilenetEditor form={form} />;
    default:
      return null;
  }
}

function IdentityFields({ form }: { form: UseFormReturn<EditorValues> }) {
  const errors = form.formState.errors;
  const family = useWatch({ control: form.control, name: "family" });
  const families = Object.entries(FAMILY_LABELS).map(([value, label]) => ({ value, label }));
  if (family && !FAMILY_LABELS[family]) families.push({ value: family, label: family });
  return (
    <>
      <TextField
        label="Libellé français"
        required
        error={errors.labelFr?.message}
        {...form.register("labelFr")}
      />
      <TextAreaField
        label="Description"
        description="Ce que contient la pièce et à quoi elle sert, pour les contributeurs et les agents qui la déposent."
        rows={3}
        error={errors.description?.message}
        {...form.register("description")}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          label="Libellé arabe"
          dir="rtl"
          lang="ar"
          error={errors.labelAr?.message}
          {...form.register("labelAr")}
        />
        <TextField label="Libellé anglais" lang="en" {...form.register("labelEn")} />
        <SelectField
          label="Famille"
          options={[{ value: "", label: "Non renseignée" }, ...families]}
          error={errors.family?.message}
          {...form.register("family")}
        />
        <SelectField
          label="Niveau de rattachement"
          description="La partie à laquelle chaque document est rattaché."
          options={[
            { value: "", label: "Non renseigné" },
            ...LEVELS.map((v) => ({ value: v, label: PARTY_TYPE_LABELS[v] ?? v })),
          ]}
          error={errors.level?.message}
          {...form.register("level")}
        />
      </div>
    </>
  );
}

function MetadataPreviewOf({ form }: { form: UseFormReturn<EditorValues> }) {
  const text = useWatch({ control: form.control, name: "json.metadataSchema" });
  return <MetadataPreview schemaText={text} />;
}

function errorCount(rubrique: Rubrique, errors: FieldErrors<EditorValues>): number {
  const identity: Record<string, (keyof EditorValues)[]> = {
    identite: ["labelFr", "labelAr", "labelEn", "description", "family", "level"],
    sensibilite: ["sensitivity"],
  };
  const fields = (identity[rubrique.id] ?? []).filter((f) => errors[f]).length;
  const json = rubrique.jsonKeys.filter((key) => errors.json?.[key]).length;
  return fields + json;
}
