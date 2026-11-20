import { useState } from "react";
import {
  Alert,
  Anchor,
  Button,
  Code,
  Radio,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { ErrorState } from "@sijil/ui-kit";
import { api, call, isApiError, type Schemas } from "@/shared/api";
import { STATUS_LABELS } from "@/shared/labels";
import { QueryState } from "@/shared/QueryState";
import { diffDefinitions } from "@/features/type-sheet/diff";
import { reviewSchema, today, type ReviewForm } from "@/features/review/form";

/** Écran « Revue » : différences avec la version publiée, puis approbation ou demande de modifications. */
export function ReviewPage() {
  const params = useParams();
  const code = params["code"] ?? "";
  const version = Number(params["version"]);
  const reviewed = useQuery({
    queryKey: ["version", code, version],
    queryFn: () =>
      call(
        api.GET("/api/types/{code}/versions/{version}", {
          params: { path: { code, version } },
        }),
      ),
  });
  const sheet = useQuery({
    queryKey: ["type", code],
    queryFn: () => call(api.GET("/api/types/{code}", { params: { path: { code } } })),
  });
  return (
    <Stack>
      <Title order={2}>
        Revue du type {code}, version {version}
      </Title>
      <QueryState query={reviewed}>
        {(data) => (
          <QueryState query={sheet}>{(type) => <Review reviewed={data} sheet={type} />}</QueryState>
        )}
      </QueryState>
    </Stack>
  );
}

function Review({ reviewed, sheet }: { reviewed: Schemas["Editor"]; sheet: Schemas["TypeSheet"] }) {
  const [done, setDone] = useState<Schemas["Editor"]>();
  const previous = sheet.versions.find(
    (v) => v.version < reviewed.version && ["PUBLIE", "DEPRECIE"].includes(v.status),
  );
  return (
    <Stack>
      <Text>
        Parcours propriétaire : <strong>{sheet.ownerParcours}</strong> — soumise par{" "}
        {sheet.versions.find((v) => v.version === reviewed.version)?.submittedBy ?? "—"}
      </Text>
      <Changes
        before={previous?.definition ?? {}}
        after={reviewed.definition}
        since={previous?.version}
      />
      {done ? (
        <Alert color="green" role="status" title="Revue enregistrée">
          La version {done.version} est à l&apos;état « {STATUS_LABELS[done.status]} ».{" "}
          <Anchor component={Link} to="/revues">
            Retour à la file de revue
          </Anchor>
        </Alert>
      ) : reviewed.status === "EN_REVUE" ? (
        <Decision reviewed={reviewed} onDone={setDone} />
      ) : (
        <Alert color="blue" title="Rien à revoir" role="note">
          La version {reviewed.version} est à l&apos;état « {STATUS_LABELS[reviewed.status]} ».
        </Alert>
      )}
    </Stack>
  );
}

function Changes({
  before,
  after,
  since,
}: {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  since: number | undefined;
}) {
  const changes = diffDefinitions(before, after);
  return (
    <Stack>
      <Title order={3}>
        {since === undefined
          ? "Définition proposée (première version)"
          : `Différences avec la version publiée v${String(since)}`}
      </Title>
      {changes.length === 0 ? (
        <Text>Aucune rubrique modifiée.</Text>
      ) : (
        changes.map((change) => (
          <section key={change.key} aria-label={`Rubrique ${change.key}`}>
            <Title order={4}>{change.key}</Title>
            <SimpleGrid cols={2}>
              <Code block aria-label={`${change.key} avant`}>
                {shown(change.before)}
              </Code>
              <Code block aria-label={`${change.key} après`}>
                {shown(change.after)}
              </Code>
            </SimpleGrid>
          </section>
        ))
      )}
    </Stack>
  );
}

function Decision({
  reviewed,
  onDone,
}: {
  reviewed: Schemas["Editor"];
  onDone: (done: Schemas["Editor"]) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ReviewForm>({
    decision: "APPROVE",
    effectiveFrom: today(),
    reason: "",
    comment: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const review = useMutation({
    mutationFn: (body: Schemas["Review"]) =>
      call(
        api.POST("/api/types/{code}/versions/{version}/review", {
          params: {
            path: { code: reviewed.code, version: reviewed.version },
            header: { "If-Match": reviewed.etag },
          },
          body,
        }),
      ),
    onSuccess: (done) => {
      onDone(done);
      void queryClient.invalidateQueries({ queryKey: ["version", reviewed.code] });
      void queryClient.invalidateQueries({ queryKey: ["type", reviewed.code] });
      void queryClient.invalidateQueries({ queryKey: ["reviews"] });
    },
  });
  const submit = () => {
    const parsed = reviewSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    review.mutate(parsed.data);
  };
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Stack maw={560}>
        <Title order={3}>Décision</Title>
        <Radio.Group
          label="Décision"
          value={form.decision}
          onChange={(value) => {
            setForm({ ...form, decision: value });
          }}
        >
          <Stack gap="xs" mt="xs">
            <Radio value="APPROVE" label="Approuver et publier" />
            <Radio value="REQUEST_CHANGES" label="Demander des modifications" />
          </Stack>
        </Radio.Group>
        {form.decision === "APPROVE" ? (
          <TextInput
            type="date"
            label="Date d'effet"
            description="Aujourd'hui ou plus tard"
            required
            value={form.effectiveFrom}
            error={errors["effectiveFrom"]}
            onChange={(e) => {
              setForm({ ...form, effectiveFrom: e.currentTarget.value });
            }}
          />
        ) : (
          <Textarea
            label="Motif"
            description="Visible du contributeur sur la fiche du type"
            required
            value={form.reason}
            error={errors["reason"]}
            onChange={(e) => {
              setForm({ ...form, reason: e.currentTarget.value });
            }}
          />
        )}
        <Textarea
          label="Commentaire (facultatif)"
          value={form.comment}
          error={errors["comment"]}
          onChange={(e) => {
            setForm({ ...form, comment: e.currentTarget.value });
          }}
        />
        <Button type="submit" loading={review.isPending} w="fit-content">
          Enregistrer la revue
        </Button>
        {isApiError(review.error) && review.error.status === 412 && (
          <Alert color="red" title="La version a changé depuis votre lecture">
            Rechargez la page avant de revoir.
          </Alert>
        )}
        {isApiError(review.error) && review.error.status !== 412 && (
          <ErrorState error={review.error} headingLevel={4} />
        )}
      </Stack>
    </form>
  );
}

function shown(value: unknown): string {
  return value === undefined ? "(absente)" : JSON.stringify(value, null, 2);
}
