import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { ErrorState } from "@sijil/ui-kit";
import { api, call, isApiError, type Schemas } from "@/shared/api";
import { Page, Section } from "@/shared/ui/page";
import { familyLabel } from "@/features/dossier/dossier";
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
  if (sheet.data) return <Sheet sheet={sheet.data} />;
  return (
    <Page title={`Type ${code}`}>
      <QueryState query={sheet}>{() => null}</QueryState>
    </Page>
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
  const label = (latest?.definition as { labels?: { fr?: string } } | undefined)?.labels?.fr;
  return (
    <Page
      title={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {label ?? `Type ${sheet.code}`}
          <code className="rounded-md bg-gray-100 px-2 py-0.5 text-sm font-semibold text-gray-700">
            {sheet.code}
          </code>
        </span>
      }
      subtitle={
        <>
          <span>
            {sheet.family ? familyLabel(sheet.family) : "Famille non renseignée"} · parcours{" "}
            {sheet.ownerParcours} · référent {sheet.referentParcours}
          </span>
          {latest && <StatusBadge status={latest.status} />}
        </>
      }
      actions={
        sheet.canEdit &&
        (draftInProgress ? (
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
        ))
      }
    >
      {latest?.reviewReason && (
        <Notice tone="warning" title="Modifications demandées par la revue" role="note">
          {latest.reviewReason}
        </Notice>
      )}
      {isApiError(newVersion.error) && <ErrorState error={newVersion.error} headingLevel={3} />}
      <Section title="Versions" flush>
        <Table bare aria-label="Versions" className="[&_tr:last-child>td]:border-b-0">
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
      </Section>
      {sheet.versions.length > 1 && <VersionDiff versions={sheet.versions} />}
      <ReuseSection sheet={sheet} />
    </Page>
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
