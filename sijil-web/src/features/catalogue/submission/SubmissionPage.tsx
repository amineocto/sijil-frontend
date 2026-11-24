import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router";
import { ErrorState } from "@sijil/ui-kit";
import { api, call, isApiError, type Schemas } from "@/shared/api";
import { errorLabel, STATUS_LABELS } from "@/features/catalogue/shared/labels";
import { Page } from "@/shared/ui/page";
import { QueryState } from "@/shared/QueryState";
import { RUBRIQUES, rubriqueOf } from "@/features/catalogue/shared/rubriques";
import { Button, Notice, Panel, TextLink } from "@/shared/ui";

/** Écran « Soumission » : contrôles automatiques du serveur, erreurs par rubrique. */
export function SubmissionPage() {
  const code = useParams()["code"] ?? "";
  const editor = useQuery({
    queryKey: ["editor", code],
    queryFn: () => call(api.GET("/api/types/{code}/editor", { params: { path: { code } } })),
  });
  return (
    <Page
      title={<>Soumission du type {code}</>}
      subtitle="Contrôles automatiques de la version, puis envoi en revue : personne ne publie seul son propre travail."
      width="wide"
    >
      <QueryState query={editor}>{(data) => <Submission draft={data} />}</QueryState>
    </Page>
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
      <Notice tone="success" role="status" title="Version soumise à la revue">
        La version {submit.data.version} est à l&apos;état « {STATUS_LABELS[submit.data.status]} ».{" "}
        <TextLink to={`/catalogue/types/${draft.code}`}>Retour à la fiche</TextLink>
      </Notice>
    );
  }
  if (draft.status !== "BROUILLON") {
    return (
      <Notice tone="info" title="Rien à soumettre" role="note">
        La version {draft.version} est à l&apos;état « {STATUS_LABELS[draft.status]} ».
      </Notice>
    );
  }
  const failures = isApiError(submit.error) && submit.error.status === 422 ? submit.error : null;
  return (
    <Panel className="flex flex-col gap-4">
      <p className="text-sm text-gray-900">
        Les contrôles vérifient que la définition de la version {draft.version} est complète, sans
        valeur provisoire, et que les parcours sont actifs.
      </p>
      <div>
        <Button
          onClick={() => {
            submit.mutate();
          }}
          loading={submit.isPending}
        >
          Lancer les contrôles et soumettre
        </Button>
      </div>
      {failures && <CheckResults errors={failures.fieldErrors} code={draft.code} />}
      {isApiError(submit.error) && submit.error.status === 412 && (
        <Notice tone="danger" title="Le brouillon a été modifié entre-temps">
          Rechargez la page avant de soumettre.
        </Notice>
      )}
      {isApiError(submit.error) && ![412, 422].includes(submit.error.status) && (
        <ErrorState error={submit.error} headingLevel={3} />
      )}
    </Panel>
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
    <Notice tone="danger" title="Contrôles en échec" role="alert">
      <div className="flex flex-col gap-2">
        {byRubrique.map(({ rubrique, errors: list }) => (
          <section key={rubrique.id} aria-label={rubrique.label}>
            <p className="font-bold">{rubrique.label}</p>
            <ul className="list-disc ps-5">
              {list.map((e) => (
                <li key={`${e.field}-${e.code}`}>
                  <code>{e.field}</code> : {errorLabel(e.code)}
                </li>
              ))}
            </ul>
          </section>
        ))}
        <TextLink to={`/catalogue/types/${code}/brouillon`}>Corriger le brouillon</TextLink>
      </div>
    </Notice>
  );
}
