import { useState } from "react";
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Group,
  NativeSelect,
  Stack,
  Tabs,
  TextInput,
  Textarea,
  Title,
} from "@mantine/core";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch, type FieldErrors, type UseFormReturn } from "react-hook-form";
import { Link, useParams } from "react-router";
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

/** Écran « Éditeur de brouillon » : formulaire par rubriques, enregistrement avec `If-Match`. */
export function EditorPage() {
  const code = useParams()["code"] ?? "";
  const editor = useQuery({
    queryKey: ["editor", code],
    queryFn: () => call(api.GET("/api/types/{code}/editor", { params: { path: { code } } })),
  });
  return (
    <Stack>
      <Title order={2}>Brouillon du type {code}</Title>
      <QueryState query={editor}>
        {(data) => <EditorForm key={String(data.version)} initial={data} />}
      </QueryState>
    </Stack>
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
      onSubmit={(event) =>
        void form.handleSubmit((values) => {
          save.mutate(values);
        })(event)
      }
    >
      <Stack>
        <Group>
          <Badge variant="outline">Version {initial.version}</Badge>
          <Badge variant="light">{STATUS_LABELS[initial.status]}</Badge>
          <Anchor component={Link} to={`/catalogue/types/${initial.code}`}>
            Voir la fiche
          </Anchor>
        </Group>
        {initial.reviewReason && (
          <Alert color="orange" title="Modifications demandées par la revue" role="note">
            {initial.reviewReason}
          </Alert>
        )}
        {!editable && (
          <Alert color="blue" title="Version non modifiable" role="note">
            Cette version est à l&apos;état « {STATUS_LABELS[initial.status]} ».
          </Alert>
        )}
        <fieldset disabled={!editable} style={{ border: 0, padding: 0, margin: 0 }}>
          <Rubriques form={form} />
        </fieldset>
        {save.isSuccess && !form.formState.isDirty && (
          <Alert color="green" role="status" title="Brouillon enregistré" />
        )}
        {unplaced.length > 0 && (
          <Alert color="red" title="Erreurs signalées par le serveur">
            <ul>
              {unplaced.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </Alert>
        )}
        {isApiError(save.error) && save.error.status === 412 && (
          <Alert color="red" title="Le brouillon a été modifié entre-temps">
            Rechargez la page pour repartir de la dernière version, puis refaites vos modifications.
          </Alert>
        )}
        {isApiError(save.error) && ![412, 422].includes(save.error.status) && (
          <ErrorState error={save.error} headingLevel={3} />
        )}
        {editable && (
          <Group>
            <Button type="submit" loading={save.isPending}>
              Enregistrer
            </Button>
            <Button
              component={Link}
              to={`/catalogue/types/${initial.code}/soumission`}
              variant="light"
              disabled={form.formState.isDirty}
            >
              Soumettre
            </Button>
          </Group>
        )}
      </Stack>
    </form>
  );
}

function Rubriques({ form }: { form: UseFormReturn<EditorValues> }) {
  const errors = form.formState.errors;
  return (
    <Tabs defaultValue="identite" keepMounted>
      <Tabs.List>
        {RUBRIQUES.map((rubrique) => {
          const count = errorCount(rubrique, errors);
          return (
            <Tabs.Tab key={rubrique.id} value={rubrique.id}>
              {rubrique.label}
              {count > 0 && (
                <Badge color="red" ml="xs" size="sm" aria-label={`${String(count)} erreur(s)`}>
                  {count}
                </Badge>
              )}
            </Tabs.Tab>
          );
        })}
      </Tabs.List>
      {RUBRIQUES.map((rubrique) => (
        <Tabs.Panel key={rubrique.id} value={rubrique.id} pt="md">
          <Stack>
            {rubrique.id === "identite" && <IdentityFields form={form} />}
            {rubrique.id === "sensibilite" && (
              <NativeSelect
                label="Sensibilité"
                data={[{ value: "", label: "Non renseignée" }, ...SENSITIVITIES]}
                error={errors.sensitivity?.message}
                {...form.register("sensitivity")}
              />
            )}
            {rubrique.jsonKeys.map((key) => (
              <Textarea
                key={key}
                label={`${key} (JSON)`}
                autosize
                minRows={3}
                styles={{ input: { fontFamily: "monospace" } }}
                error={errors.json?.[key]?.message}
                {...form.register(`json.${key}`)}
              />
            ))}
            {rubrique.id === "metadonnees" && <MetadataPreviewOf form={form} />}
          </Stack>
        </Tabs.Panel>
      ))}
    </Tabs>
  );
}

function IdentityFields({ form }: { form: UseFormReturn<EditorValues> }) {
  const errors = form.formState.errors;
  return (
    <>
      <TextInput
        label="Libellé français"
        required
        error={errors.labelFr?.message}
        {...form.register("labelFr")}
      />
      <TextInput
        label="Libellé arabe"
        dir="rtl"
        lang="ar"
        error={errors.labelAr?.message}
        {...form.register("labelAr")}
      />
      <TextInput label="Libellé anglais" lang="en" {...form.register("labelEn")} />
      <TextInput label="Famille" error={errors.family?.message} {...form.register("family")} />
      <NativeSelect
        label="Niveau de rattachement"
        data={[{ value: "", label: "Non renseigné" }, ...LEVELS]}
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
