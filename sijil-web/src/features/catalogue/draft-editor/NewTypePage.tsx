import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { z } from "zod";
import { ErrorState } from "@sijil/ui-kit";
import { api, call, isApiError } from "@/shared/api";
import { Page } from "@/shared/ui/page";
import { QueryState } from "@/shared/QueryState";
import { useSession } from "@/shared/session";
import { Button, Panel, SelectField, TextField } from "@/shared/ui";

const newTypeSchema = z.object({
  code: z
    .string()
    .regex(/^[A-Z][A-Z0-9_]{1,63}$/, "Majuscules, chiffres et _ ; commence par une lettre"),
  referentParcours: z.string().min(1, "Choisissez un parcours"),
  labelFr: z.string().trim().min(1, "Le libellé français est obligatoire"),
});

type NewTypeValues = z.infer<typeof newTypeSchema>;

/** Création d'un type : version 1 en brouillon, puis passage à l'éditeur. */
export function NewTypePage() {
  const session = useSession();
  return (
    <Page
      title="Nouveau type de document"
      subtitle="Le type naît en brouillon (version 1) ; il sera publié après contrôles et revue."
      width="narrow"
    >
      <QueryState query={session}>{(data) => <NewTypeForm parcours={data.parcours} />}</QueryState>
    </Page>
  );
}

function NewTypeForm({ parcours }: { parcours: string[] }) {
  const navigate = useNavigate();
  const form = useForm<NewTypeValues>({
    resolver: zodResolver(newTypeSchema),
    defaultValues: {
      code: "",
      referentParcours: parcours[0] ?? "",
      labelFr: "",
    },
    mode: "onBlur",
  });
  // Une clé par intention : un double envoi du formulaire crée un seul type (AUD-20261120-240).
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const create = useMutation({
    mutationFn: (values: NewTypeValues) =>
      call(
        api.POST("/api/types", {
          params: { header: { "Idempotency-Key": idempotencyKey } },
          body: {
            code: values.code,
            referentParcours: values.referentParcours,
            definition: { labels: { fr: values.labelFr.trim() } },
          },
        }),
      ),
    onSuccess: (created) => void navigate(`/catalogue/types/${created.code}/brouillon`),
    onError: (error) => {
      if (isApiError(error) && error.status === 409) {
        form.setError("code", {
          type: "server",
          message: "Ce code existe déjà",
        });
      }
    },
  });
  const errors = form.formState.errors;
  return (
    <Panel className="max-w-lg">
      <form
        noValidate
        aria-label="Nouveau type"
        className="flex flex-col gap-4"
        onSubmit={(event) =>
          void form.handleSubmit((values) => {
            create.mutate(values);
          })(event)
        }
      >
        <TextField label="Code" required error={errors.code?.message} {...form.register("code")} />
        <SelectField
          label="Parcours référent"
          options={parcours.map((p) => ({ value: p, label: p }))}
          error={errors.referentParcours?.message}
          {...form.register("referentParcours")}
        />
        <TextField
          label="Libellé français"
          required
          error={errors.labelFr?.message}
          {...form.register("labelFr")}
        />
        {isApiError(create.error) && create.error.status !== 409 && (
          <ErrorState error={create.error} headingLevel={3} />
        )}
        <div>
          <Button type="submit" loading={create.isPending}>
            Créer le brouillon
          </Button>
        </div>
      </form>
    </Panel>
  );
}
