import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { CompletenessResultView } from "@/features/completeness/CompletenessResultView";
import { EvaluationForm } from "@/features/completeness/EvaluationForm";
import { evaluate } from "@/features/completeness/completeness";
import { SET_STATUS_LABELS } from "@/features/catalogue/requirements/RequirementSetsPage";
import { api, call, isApiError, type Schemas } from "@/shared/api";
import { Page } from "@/shared/ui/page";
import { QueryState } from "@/shared/QueryState";
import { canContributeToCatalogue, canReview, useSession } from "@/shared/session";
import { Button, Heading, Notice, Panel, Tag, TextField } from "@/shared/ui";
import {
  cleaned,
  problemsOf,
  RequirementSetForm,
  type Definition,
} from "@/features/catalogue/requirements/RequirementSetForm";

type RequirementSet = Schemas["RequirementSet"];

const TEMPLATE: Definition = {
  label: "",
  requirements: [
    {
      id: "piece-d-identite",
      label: "Pièce d'identité",
      anyOf: ["CIN", "PASSEPORT"],
      for: { roles: ["TITULAIRE"] },
      freshness: "VALID_ON_DATE",
      minAssurance: "CONTROLE_AUTO",
    },
  ],
};

/** Nouveau jeu d'exigences (L7-04). */
export function NewRequirementSetPage() {
  return <Editor set={undefined} />;
}

/** Éditeur et simulateur d'une version (L7-04). */
export function RequirementSetEditorPage() {
  const { code = "", version = "" } = useParams();
  const set = useQuery({
    queryKey: ["requirement-set", code, version],
    queryFn: () =>
      call(
        api.GET("/api/requirement-sets/{code}/versions/{version}", {
          params: { path: { code, version: Number(version) } },
        }),
      ),
  });
  return (
    <QueryState query={set}>{(data) => <Editor key={data.etag ?? ""} set={data} />}</QueryState>
  );
}

function Editor({ set }: { set: RequirementSet | undefined }) {
  const session = useSession();
  const navigate = useNavigate();
  const queries = useQueryClient();
  const [code, setCode] = useState(set?.code ?? "");
  const [definition, setDefinition] = useState<Definition>(set?.definition ?? TEMPLATE);
  const [checked, setChecked] = useState(false);
  const [key] = useState(() => crypto.randomUUID());
  const draft = set === undefined || set.status === "BROUILLON";
  const editable = draft && canContributeToCatalogue(session.data, set?.parcours);
  const valid = Object.keys(problemsOf(definition)).length === 0;

  const save = useMutation({
    mutationFn: (d: Definition) =>
      set === undefined
        ? call(
            api.POST("/api/requirement-sets", {
              params: { header: { "Idempotency-Key": key } },
              body: { code, definition: d },
            }),
          )
        : call(
            api.PUT("/api/requirement-sets/{code}/versions/{version}", {
              params: {
                path: { code: set.code, version: set.version },
                header: { "If-Match": set.etag ?? "" },
              },
              body: { definition: d },
            }),
          ),
    onSuccess: (saved) => {
      void queries.invalidateQueries({ queryKey: ["requirement-sets"] });
      void navigate(`/catalogue/exigences/${saved.code}/versions/${String(saved.version)}`, {
        replace: true,
      });
      void queries.invalidateQueries({ queryKey: ["requirement-set"] });
    },
  });
  const publish = useMutation({
    mutationFn: (s: RequirementSet) =>
      call(
        api.POST("/api/requirement-sets/{code}/versions/{version}/publication", {
          params: {
            path: { code: s.code, version: s.version },
            header: { "If-Match": s.etag ?? "" },
          },
        }),
      ),
    onSuccess: () => {
      void queries.invalidateQueries({ queryKey: ["requirement-set"] });
      void queries.invalidateQueries({ queryKey: ["requirement-sets"] });
    },
  });
  const simulate = useMutation({ mutationFn: evaluate });

  return (
    <Page
      title={set ? `Jeu ${set.code}, version ${String(set.version)}` : "Nouveau jeu d'exigences"}
      subtitle={set && <Tag>{SET_STATUS_LABELS[set.status] ?? set.status}</Tag>}
      width="wide"
    >
      <Panel className="flex flex-col gap-4">
        {set === undefined && (
          <TextField
            label="Code du jeu"
            description="Majuscules, chiffres et _ ; par exemple CREDIT_IMMO_PARTICULIER"
            required
            value={code}
            onChange={(event) => {
              setCode(event.currentTarget.value.toUpperCase());
            }}
          />
        )}
        <RequirementSetForm
          value={definition}
          onChange={setDefinition}
          readOnly={!editable}
          showErrors={checked}
        />
        {save.error && <Problem error={save.error} title="Enregistrement refusé" />}
        {publish.error && <Problem error={publish.error} title="Publication refusée" />}
        <div className="flex flex-wrap gap-3">
          {editable && (
            <Button
              disabled={set === undefined && !code}
              loading={save.isPending}
              onClick={() => {
                setChecked(true);
                if (valid) save.mutate(cleaned(definition));
              }}
            >
              Enregistrer le brouillon
            </Button>
          )}
          {set?.status === "BROUILLON" && canReview(session.data) && (
            <Button
              variant="secondary"
              loading={publish.isPending}
              onClick={() => {
                publish.mutate(set);
              }}
            >
              Publier
            </Button>
          )}
        </div>
      </Panel>
      {canContributeToCatalogue(session.data) && (
        <Panel className="flex flex-col gap-4">
          <Heading level={3}>Simulateur</Heading>
          <EvaluationForm
            submitLabel="Simuler"
            pending={simulate.isPending}
            onSubmit={(evaluation) => {
              simulate.mutate({ definition: cleaned(definition), ...evaluation });
            }}
          />
          {simulate.error && <Problem error={simulate.error} title="Simulation impossible" />}
          {simulate.data && <CompletenessResultView result={simulate.data} />}
        </Panel>
      )}
    </Page>
  );
}

function Problem({ error, title }: { error: unknown; title: string }) {
  if (!isApiError(error)) {
    return (
      <Notice tone="danger" title={title}>
        Une erreur inattendue est survenue.
      </Notice>
    );
  }
  return (
    <Notice tone="danger" title={title}>
      {error.message}
      {error.fieldErrors.length > 0 && (
        <ul className="mt-2 list-disc ps-5">
          {error.fieldErrors.map((f) => (
            <li key={`${f.field}-${f.code}`}>
              {fieldLabel(f.field)} : {f.code}
            </li>
          ))}
        </ul>
      )}
    </Notice>
  );
}

/** `/requirements/0/anyOf` → « Exigence 1, types acceptés ». */
function fieldLabel(pointer: string): string {
  const names: Record<string, string> = {
    label: "libellé",
    id: "identifiant",
    anyOf: "types acceptés",
    count: "nombre de pièces",
    for: "parties concernées",
    freshness: "fraîcheur",
    minAssurance: "confiance minimale",
    when: "conditions",
  };
  const [, root, index, key] = pointer.split("/");
  if (root === "requirements" && index !== undefined) {
    const n = Number(index) + 1;
    return `Exigence ${String(n)}${key ? `, ${names[key] ?? key}` : ""}`;
  }
  return root ? (names[root] ?? root) : "Définition";
}
