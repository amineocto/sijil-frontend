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
import { CodeIcon, RUBRIC_ICONS } from "@/shared/ui/icons";
import { NoDraft } from "@/features/catalogue/shared/NoDraft";
import {
  definitionProblems,
  type DefinitionProblem,
} from "@/features/catalogue/draft-editor/definitionChecks";
import { queryKeys } from "@/shared/queryKeys";
import { ProblemSummary } from "@/shared/refusedSubmit";

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
      <QueryState query={editor} notFound={<NoDraft code={code} />}>
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.catalogueType(initial.code) });
    },
    onError: (error) => {
      if (!isApiError(error)) return;
      place(
        error.fieldErrors.map(({ field, code }) => ({ pointer: field, message: errorLabel(code) })),
      );
    },
  });
  // Erreurs (du navigateur ou du catalogue) rattachées au champ ou à la rubrique de leur pointeur.
  const place = (problems: DefinitionProblem[]) => {
    const notPlaced: string[] = [];
    const byName = new Map<string, string[]>();
    for (const { pointer, message } of problems) {
      const name = fieldOfPointer(pointer);
      if (name) byName.set(name, [...(byName.get(name) ?? []), message]);
      else notPlaced.push(`${pointer} : ${message}`);
    }
    for (const [name, messages] of byName) {
      form.setError(name as keyof EditorValues, { type: "server", message: messages.join(" ; ") });
    }
    setUnplaced(notPlaced);
  };
  const editable = initial.status === "BROUILLON";

  return (
    <form
      noValidate
      aria-label="Définition du type"
      className="flex flex-col gap-4"
      onSubmit={(event) =>
        void form.handleSubmit((values) => {
          const problems = definitionProblems(toDefinition(values));
          if (problems.length > 0) place(problems);
          else save.mutate(values);
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
        <Rubriques form={form} readOnly={!editable} />
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
      {form.formState.submitCount > 0 && (
        <ProblemSummary count={problemCountOf(form.formState.errors)} />
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

/**
 * Définition d'un type en lecture seule (fiche, revue) : les mêmes formulaires que l'éditeur,
 * désactivés, pour qu'un utilisateur métier la lise sans JSON.
 */
export function DefinitionView({ definition }: { definition: Record<string, unknown> }) {
  const form = useForm<EditorValues>({ defaultValues: toValues(definition) });
  return (
    <div role="group" aria-label="Définition du type, en lecture seule">
      <Rubriques form={form} readOnly />
    </div>
  );
}

/**
 * Rubriques en onglets. En lecture seule, seul le contenu de chaque onglet est désactivé : les
 * onglets restent cliquables (un fieldset désactivé désactive aussi leurs boutons).
 */
function Rubriques({ form, readOnly }: { form: UseFormReturn<EditorValues>; readOnly: boolean }) {
  const errors = form.formState.errors;
  return (
    <Tabs
      label="Rubriques de la définition"
      keepMounted
      tabs={RUBRIQUES.map((rubrique) => {
        const count = errorCount(rubrique, errors);
        const jsonErrors = rubrique.jsonKeys
          .map((key) => errors.json?.[key]?.message)
          .filter((m): m is string => Boolean(m));
        return {
          id: rubrique.id,
          label: (
            <>
              <CodeIcon icons={RUBRIC_ICONS} code={rubrique.id} className="size-4 shrink-0" />
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
            <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-5">
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
              {jsonErrors.length > 0 && (
                <Notice tone="danger" title="À corriger dans cette rubrique">
                  <ul className="list-disc ps-5">
                    {jsonErrors.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </Notice>
              )}
              <StructuredRubric id={rubrique.id} form={form} />
              {rubrique.id === "metadonnees" && <MetadataPreviewOf form={form} />}
            </fieldset>
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

function problemCountOf(errors: FieldErrors<EditorValues>): number {
  const { json, ...fields } = errors;
  return Object.keys(fields).length + Object.keys(json ?? {}).length;
}
