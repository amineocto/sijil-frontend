import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { ErrorState } from "@sijil/ui-kit";
import { api, call, isApiError, type Schemas } from "@/shared/api";
import { QueryState } from "@/shared/QueryState";
import { StatusBadge } from "@/features/catalogue/shared/StatusBadge";
import { diffDefinitions } from "@/features/catalogue/type-sheet/diff";
import { ReuseSection } from "@/features/catalogue/type-sheet/ReuseSection";
import {
  Button,
  ButtonLink,
  CodeBlock,
  Heading,
  Notice,
  Panel,
  SelectField,
  Table,
  Td,
  Th,
} from "@/shared/ui";

type Version = Schemas["TypeVersion"];

/** Écran « Fiche d'un type » : versions, différences entre deux versions, motif de revue. */
export function TypeSheetPage() {
  const code = useParams()["code"] ?? "";
  const sheet = useQuery({
    queryKey: ["type", code],
    queryFn: () => call(api.GET("/api/types/{code}", { params: { path: { code } } })),
  });
  return (
    <div className="flex flex-col gap-6">
      <Heading>Type {code}</Heading>
      <QueryState query={sheet}>{(data) => <Sheet sheet={data} />}</QueryState>
    </div>
  );
}

function Sheet({ sheet }: { sheet: Schemas["TypeSheet"] }) {
  const navigate = useNavigate();
  const latest = sheet.versions[0];
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const newVersion = useMutation({
    mutationFn: () =>
      call(
        api.POST("/api/types/{code}/new-version", {
          params: { path: { code: sheet.code }, header: { "Idempotency-Key": idempotencyKey } },
        }),
      ),
    onSuccess: () => void navigate(`/catalogue/types/${sheet.code}/brouillon`),
  });
  const draftInProgress = latest?.status === "BROUILLON";
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-gray-900">
        Parcours propriétaire : <strong>{sheet.ownerParcours}</strong> — référent :{" "}
        <strong>{sheet.referentParcours}</strong> — famille : {sheet.family ?? "non renseignée"}
      </p>
      {latest?.reviewReason && (
        <Notice tone="warning" title="Modifications demandées par la revue" role="note">
          {latest.reviewReason}
        </Notice>
      )}
      {sheet.canEdit && (
        <div>
          {draftInProgress ? (
            <ButtonLink to={`/catalogue/types/${sheet.code}/brouillon`}>
              Modifier le brouillon
            </ButtonLink>
          ) : (
            <Button
              onClick={() => {
                newVersion.mutate();
              }}
              loading={newVersion.isPending}
            >
              Nouvelle version
            </Button>
          )}
        </div>
      )}
      {isApiError(newVersion.error) && <ErrorState error={newVersion.error} headingLevel={3} />}
      <Panel className="flex flex-col gap-4">
        <Heading level={3}>Versions</Heading>
        <Table>
          <thead>
            <tr>
              <Th scope="col">Version</Th>
              <Th scope="col">Statut</Th>
              <Th scope="col">Date d&apos;effet</Th>
              <Th scope="col">Soumise par</Th>
              <Th scope="col">Revue par</Th>
            </tr>
          </thead>
          <tbody>
            {sheet.versions.map((v) => (
              <tr key={v.version}>
                <Td>v{v.version}</Td>
                <Td>
                  <StatusBadge status={v.status} />
                </Td>
                <Td>{v.effectiveFrom ?? "—"}</Td>
                <Td>{v.submittedBy ?? "—"}</Td>
                <Td>{v.reviewedBy ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>
      {sheet.versions.length > 1 && <VersionDiff versions={sheet.versions} />}
      <ReuseSection sheet={sheet} />
    </div>
  );
}

function VersionDiff({ versions }: { versions: Version[] }) {
  const [left, setLeft] = useState(String(versions[1]?.version));
  const [right, setRight] = useState(String(versions[0]?.version));
  const options = versions.map((v) => ({
    value: String(v.version),
    label: `v${String(v.version)}`,
  }));
  const before = versions.find((v) => String(v.version) === left);
  const after = versions.find((v) => String(v.version) === right);
  const changes = before && after ? diffDefinitions(before.definition, after.definition) : [];
  return (
    <Panel className="flex flex-col gap-4">
      <Heading level={3}>Différences entre deux versions</Heading>
      <div className="grid max-w-xl gap-4 md:grid-cols-2">
        <SelectField
          label="Version de départ"
          options={options}
          value={left}
          onChange={(e) => {
            setLeft(e.currentTarget.value);
          }}
        />
        <SelectField
          label="Version comparée"
          options={options}
          value={right}
          onChange={(e) => {
            setRight(e.currentTarget.value);
          }}
        />
      </div>
      {changes.length === 0 ? (
        <p className="text-sm text-gray-900">Aucune différence entre ces deux versions.</p>
      ) : (
        <div className="flex flex-col gap-4" role="group" aria-label="Rubriques modifiées">
          {changes.map((change) => (
            <section key={change.key} aria-label={`Rubrique ${change.key}`}>
              <Heading level={4}>{change.key}</Heading>
              <div className="grid gap-3 md:grid-cols-2">
                <CodeBlock aria-label={`${change.key} avant`}>{shown(change.before)}</CodeBlock>
                <CodeBlock aria-label={`${change.key} après`}>{shown(change.after)}</CodeBlock>
              </div>
            </section>
          ))}
        </div>
      )}
    </Panel>
  );
}

function shown(value: unknown): string {
  return value === undefined ? "(absente)" : JSON.stringify(value, null, 2);
}
