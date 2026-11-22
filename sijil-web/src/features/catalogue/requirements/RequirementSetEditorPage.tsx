import { useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Group,
  List,
  Stack,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { CompletenessResultView } from "@/features/completeness/CompletenessResultView";
import { EvaluationForm } from "@/features/completeness/EvaluationForm";
import { evaluate } from "@/features/completeness/completeness";
import { SET_STATUS_LABELS } from "@/features/catalogue/requirements/RequirementSetsPage";
import { api, call, isApiError, type Schemas } from "@/shared/api";
import { QueryState } from "@/shared/QueryState";
import { canContributeToCatalogue, canReview, useSession } from "@/shared/session";

type RequirementSet = Schemas["RequirementSet"];
type Definition = Schemas["RequirementSetDefinition"];

const TEMPLATE: Definition = {
  label: "Nouveau jeu",
  requirements: [
    {
      id: "identite",
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
  const [text, setText] = useState(JSON.stringify(set?.definition ?? TEMPLATE, null, 2));
  const [key] = useState(() => crypto.randomUUID());
  const draft = set === undefined || set.status === "BROUILLON";
  const editable = draft && canContributeToCatalogue(session.data, set?.parcours);
  const definition = parse(text);

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
    <Stack maw={960}>
      <Group>
        <Title order={2}>
          {set ? `Jeu ${set.code}, version ${String(set.version)}` : "Nouveau jeu d'exigences"}
        </Title>
        {set && <Badge variant="light">{SET_STATUS_LABELS[set.status] ?? set.status}</Badge>}
      </Group>
      {set === undefined && (
        <TextInput
          label="Code du jeu"
          description="Majuscules, chiffres et _ ; par exemple CREDIT_IMMO_PARTICULIER"
          required
          value={code}
          onChange={(event) => {
            setCode(event.currentTarget.value.toUpperCase());
          }}
        />
      )}
      <Textarea
        label="Définition (JSON)"
        description="Exigences : types acceptés, parties visées, fraîcheur, confiance, conditions"
        autosize
        minRows={12}
        readOnly={!editable}
        error={definition === undefined ? "JSON invalide" : undefined}
        styles={{ input: { fontFamily: "monospace" } }}
        value={text}
        onChange={(event) => {
          setText(event.currentTarget.value);
        }}
      />
      {save.error && <Problem error={save.error} title="Enregistrement refusé" />}
      {publish.error && <Problem error={publish.error} title="Publication refusée" />}
      <Group>
        {editable && (
          <Button
            disabled={definition === undefined || (set === undefined && !code)}
            loading={save.isPending}
            onClick={() => {
              if (definition) save.mutate(definition);
            }}
          >
            Enregistrer le brouillon
          </Button>
        )}
        {set?.status === "BROUILLON" && canReview(session.data) && (
          <Button
            variant="light"
            loading={publish.isPending}
            onClick={() => {
              publish.mutate(set);
            }}
          >
            Publier
          </Button>
        )}
      </Group>
      {canContributeToCatalogue(session.data) && (
        <Stack gap="sm">
          <Title order={3} size="h4">
            Simulateur
          </Title>
          <EvaluationForm
            submitLabel="Simuler"
            pending={simulate.isPending}
            onSubmit={(evaluation) => {
              if (definition) simulate.mutate({ definition, ...evaluation });
            }}
          />
          {simulate.error && <Problem error={simulate.error} title="Simulation impossible" />}
          {simulate.data && <CompletenessResultView result={simulate.data} />}
        </Stack>
      )}
    </Stack>
  );
}

function Problem({ error, title }: { error: unknown; title: string }) {
  if (!isApiError(error)) {
    return (
      <Alert color="red" title={title}>
        Une erreur inattendue est survenue.
      </Alert>
    );
  }
  return (
    <Alert color="red" title={title}>
      {error.message}
      {error.fieldErrors.length > 0 && (
        <List size="sm">
          {error.fieldErrors.map((f) => (
            <List.Item key={`${f.field}-${f.code}`}>
              {f.field || "définition"} : {f.code}
            </List.Item>
          ))}
        </List>
      )}
    </Alert>
  );
}

function parse(text: string): Definition | undefined {
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === "object" && value !== null ? (value as Definition) : undefined;
  } catch {
    return undefined;
  }
}
