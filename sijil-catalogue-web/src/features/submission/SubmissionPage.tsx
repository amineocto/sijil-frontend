import { Alert, Anchor, Button, List, Stack, Text, Title } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { ErrorState } from "@sijil/ui-kit";
import { api, call, isApiError, type Schemas } from "@/shared/api";
import { errorLabel, STATUS_LABELS } from "@/shared/labels";
import { QueryState } from "@/shared/QueryState";
import { RUBRIQUES, rubriqueOf } from "@/shared/rubriques";

/** Écran « Soumission » : contrôles automatiques du serveur, erreurs par rubrique. */
export function SubmissionPage() {
  const code = useParams()["code"] ?? "";
  const editor = useQuery({
    queryKey: ["editor", code],
    queryFn: () => call(api.GET("/api/types/{code}/editor", { params: { path: { code } } })),
  });
  return (
    <Stack>
      <Title order={2}>Soumission du type {code}</Title>
      <QueryState query={editor}>{(data) => <Submission draft={data} />}</QueryState>
    </Stack>
  );
}

function Submission({ draft }: { draft: Schemas["Editor"] }) {
  const queryClient = useQueryClient();
  const submit = useMutation({
    mutationFn: () =>
      call(
        api.POST("/api/types/{code}/submission", {
          params: {
            path: { code: draft.code },
            header: { "If-Match": draft.etag },
          },
        }),
      ),
    onSuccess: (submitted) => {
      queryClient.setQueryData(["editor", draft.code], submitted);
      void queryClient.invalidateQueries({ queryKey: ["type", draft.code] });
    },
  });

  if (submit.isSuccess) {
    return (
      <Alert color="green" role="status" title="Version soumise à la revue">
        La version {submit.data.version} est à l&apos;état « {STATUS_LABELS[submit.data.status]} ».{" "}
        <Anchor component={Link} to={`/types/${draft.code}`}>
          Retour à la fiche
        </Anchor>
      </Alert>
    );
  }
  if (draft.status !== "BROUILLON") {
    return (
      <Alert color="blue" title="Rien à soumettre" role="note">
        La version {draft.version} est à l&apos;état « {STATUS_LABELS[draft.status]} ».
      </Alert>
    );
  }
  const failures = isApiError(submit.error) && submit.error.status === 422 ? submit.error : null;
  return (
    <Stack>
      <Text>
        Les contrôles vérifient que la définition de la version {draft.version} est complète, sans
        valeur provisoire, et que les parcours sont actifs.
      </Text>
      <Button
        onClick={() => {
          submit.mutate();
        }}
        loading={submit.isPending}
        w="fit-content"
      >
        Lancer les contrôles et soumettre
      </Button>
      {failures && <CheckResults errors={failures.fieldErrors} code={draft.code} />}
      {isApiError(submit.error) && submit.error.status === 412 && (
        <Alert color="red" title="Le brouillon a été modifié entre-temps">
          Rechargez la page avant de soumettre.
        </Alert>
      )}
      {isApiError(submit.error) && ![412, 422].includes(submit.error.status) && (
        <ErrorState error={submit.error} headingLevel={3} />
      )}
    </Stack>
  );
}

function CheckResults({
  errors,
  code,
}: {
  errors: readonly { field: string; code: string }[];
  code: string;
}) {
  const byRubrique = RUBRIQUES.map((rubrique) => ({
    rubrique,
    errors: errors.filter((e) => rubriqueOf(e.field).id === rubrique.id),
  })).filter((group) => group.errors.length > 0);
  return (
    <Alert color="red" title="Contrôles en échec" role="alert">
      <Stack gap="xs">
        {byRubrique.map(({ rubrique, errors: list }) => (
          <section key={rubrique.id} aria-label={rubrique.label}>
            <Text fw={700}>{rubrique.label}</Text>
            <List>
              {list.map((e) => (
                <List.Item key={`${e.field}-${e.code}`}>
                  <code>{e.field}</code> : {errorLabel(e.code)}
                </List.Item>
              ))}
            </List>
          </section>
        ))}
        <Anchor component={Link} to={`/types/${code}/brouillon`}>
          Corriger le brouillon
        </Anchor>
      </Stack>
    </Alert>
  );
}
