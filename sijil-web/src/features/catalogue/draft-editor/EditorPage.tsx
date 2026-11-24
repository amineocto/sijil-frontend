import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch, type FieldErrors, type UseFormReturn } from "react-hook-form";
import { useParams } from "react-router";
import { ErrorState } from "@sijil/ui-kit";
import { api, call, isApiError, type Schemas } from "@/shared/api";
import { errorLabel, STATUS_LABELS } from "@/features/catalogue/shared/labels";
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
  Button,
  ButtonLink,
  Heading,
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
    <div className="flex flex-col gap-6">
      <Heading>Brouillon du type {code}</Heading>
      <QueryState query={editor}>
        {(data) => <EditorForm key={String(data.version)} initial={data} />}
      </QueryState>
    </div>
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
  return (
    <Tabs
      label="Rubriques de la définition"
      keepMounted
      tabs={RUBRIQUES.map((rubrique) => {
        const count = errorCount(rubrique, errors);
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
            <>
              {rubrique.id === "identite" && <IdentityFields form={form} />}
              {rubrique.id === "sensibilite" && (
                <SelectField
                  label="Sensibilité"
                  options={[
                    { value: "", label: "Non renseignée" },
                    ...SENSITIVITIES.map((v) => ({ value: v, label: v })),
                  ]}
                  error={errors.sensitivity?.message}
                  {...form.register("sensitivity")}
                />
              )}
              {rubrique.jsonKeys.map((key) => (
                <TextAreaField
                  key={key}
                  label={`${key} (JSON)`}
                  rows={3}
                  className="font-mono text-sm"
                  error={errors.json?.[key]?.message}
                  {...form.register(`json.${key}`)}
                />
              ))}
              {rubrique.id === "metadonnees" && <MetadataPreviewOf form={form} />}
            </>
          ),
        };
      })}
    />
  );
}

function IdentityFields({ form }: { form: UseFormReturn<EditorValues> }) {
  const errors = form.formState.errors;
  return (
    <>
      <TextField
        label="Libellé français"
        required
        error={errors.labelFr?.message}
        {...form.register("labelFr")}
      />
      <TextField
        label="Libellé arabe"
        dir="rtl"
        lang="ar"
        error={errors.labelAr?.message}
        {...form.register("labelAr")}
      />
      <TextField label="Libellé anglais" lang="en" {...form.register("labelEn")} />
      <TextField label="Famille" error={errors.family?.message} {...form.register("family")} />
      <SelectField
        label="Niveau de rattachement"
        options={[
          { value: "", label: "Non renseigné" },
          ...LEVELS.map((v) => ({ value: v, label: v })),
        ]}
        error={errors.level?.message}
        {...form.register("level")}
      />
    </>
  );
}

function MetadataPreviewOf({ form }: { form: UseFormReturn<EditorValues> }) {
  const text = useWatch({ control: form.control, name: "json.metadataSchema" });
  return <MetadataPreview schemaText={text} />;
}

function errorCount(rubrique: Rubrique, errors: FieldErrors<EditorValues>): number {
  const identity: Record<string, (keyof EditorValues)[]> = {
    identite: ["labelFr", "labelAr", "labelEn", "family", "level"],
    sensibilite: ["sensitivity"],
  };
  const fields = (identity[rubrique.id] ?? []).filter((f) => errors[f]).length;
  const json = rubrique.jsonKeys.filter((key) => errors.json?.[key]).length;
  return fields + json;
}
