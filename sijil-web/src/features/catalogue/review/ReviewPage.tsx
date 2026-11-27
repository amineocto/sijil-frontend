import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router";
import { ErrorState } from "@sijil/ui-kit";
import { api, call, isApiError, type Schemas } from "@/shared/api";
import { STATUS_LABELS } from "@/features/catalogue/shared/labels";
import { Page } from "@/shared/ui/page";
import { QueryState } from "@/shared/QueryState";
import { ChangesTable } from "@/features/catalogue/type-sheet/ChangesTable";
import { DefinitionView } from "@/features/catalogue/draft-editor/EditorPage";
import { reviewSchema, today, type ReviewForm } from "@/features/catalogue/review/form";
import {
  Button,
  Heading,
  Notice,
  Panel,
  RadioGroup,
  TextAreaField,
  TextField,
  TextLink,
} from "@/shared/ui";

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
    <Page
      title={
        <>
          Revue du type {code}, version {version}
        </>
      }
      subtitle="Différences avec la version publiée, puis votre décision."
      width="wide"
    >
      <QueryState query={reviewed}>
        {(data) => (
          <QueryState query={sheet}>{(type) => <Review reviewed={data} sheet={type} />}</QueryState>
        )}
      </QueryState>
    </Page>
  );
}

function Review({ reviewed, sheet }: { reviewed: Schemas["Editor"]; sheet: Schemas["TypeSheet"] }) {
  const [done, setDone] = useState<Schemas["Editor"]>();
  const previous = sheet.versions.find(
    (v) => v.version < reviewed.version && ["PUBLIE", "DEPRECIE"].includes(v.status),
  );
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-gray-900">
        Parcours propriétaire : <strong>{sheet.ownerParcours}</strong> — soumise par{" "}
        {sheet.versions.find((v) => v.version === reviewed.version)?.submittedBy ?? "—"}
      </p>
      <Changes
        before={previous?.definition ?? {}}
        after={reviewed.definition}
        since={previous?.version}
      />
      {done ? (
        <Notice tone="success" role="status" title="Revue enregistrée">
          La version {done.version} est à l&apos;état « {STATUS_LABELS[done.status]} ».{" "}
          <TextLink to="/catalogue/revues">Retour à la file de revue</TextLink>
        </Notice>
      ) : reviewed.status === "EN_REVUE" ? (
        <Decision reviewed={reviewed} onDone={setDone} />
      ) : (
        <Notice tone="info" title="Rien à revoir" role="note">
          La version {reviewed.version} est à l&apos;état « {STATUS_LABELS[reviewed.status]} ».
        </Notice>
      )}
    </div>
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
  return (
    <Panel className="flex flex-col gap-4">
      <Heading level={3}>
        {since === undefined
          ? "Définition proposée (première version)"
          : `Différences avec la version publiée v${String(since)}`}
      </Heading>
      {since === undefined ? (
        <DefinitionView definition={after} />
      ) : (
        <ChangesTable before={before} after={after} empty="Aucune rubrique modifiée." />
      )}
    </Panel>
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
    <Panel className="max-w-xl">
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Heading level={3}>Décision</Heading>
        <RadioGroup
          legend="Décision"
          name="decision"
          value={form.decision}
          options={[
            { value: "APPROVE", label: "Approuver et publier" },
            { value: "REQUEST_CHANGES", label: "Demander des modifications" },
          ]}
          onChange={(value) => {
            setForm({ ...form, decision: value as ReviewForm["decision"] });
          }}
        />
        {form.decision === "APPROVE" ? (
          <TextField
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
          <TextAreaField
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
        <TextAreaField
          label="Commentaire (facultatif)"
          value={form.comment}
          error={errors["comment"]}
          onChange={(e) => {
            setForm({ ...form, comment: e.currentTarget.value });
          }}
        />
        <div>
          <Button type="submit" loading={review.isPending}>
            Enregistrer la revue
          </Button>
        </div>
        {isApiError(review.error) && review.error.status === 412 && (
          <Notice tone="danger" title="La version a changé depuis votre lecture">
            Rechargez la page avant de revoir.
          </Notice>
        )}
        {isApiError(review.error) && review.error.status !== 412 && (
          <ErrorState error={review.error} headingLevel={4} />
        )}
      </form>
    </Panel>
  );
}
