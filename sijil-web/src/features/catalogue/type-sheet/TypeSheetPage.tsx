import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { ErrorState } from "@sijil/ui-kit";
import { api, call, isApiError, type Schemas } from "@/shared/api";
import { Page, Section } from "@/shared/ui/page";
import { familyLabel } from "@/features/dossier/dossier";
import { QueryState } from "@/shared/QueryState";
import { StatusBadge } from "@/features/catalogue/shared/StatusBadge";
import { ChangesTable } from "@/features/catalogue/type-sheet/ChangesTable";
import { DefinitionView } from "@/features/catalogue/draft-editor/EditorPage";
import { ReuseSection } from "@/features/catalogue/type-sheet/ReuseSection";
import {
  Button,
  ButtonLink,
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
  const definition = latest?.definition as
    { labels?: { fr?: string }; description?: string } | undefined;
  const label = definition?.labels?.fr;
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
      {definition?.description && (
        <Section title="Description">
          <p className="text-sm whitespace-pre-line text-gray-700">{definition.description}</p>
        </Section>
      )}
      <DefinitionSection versions={sheet.versions} />
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
      {before && after && (
        <ChangesTable
          before={before.definition}
          after={after.definition}
          empty="Aucune différence entre ces deux versions."
        />
      )}
    </Panel>
  );
}

/**
 * Plan de classement d'une version, en formulaires de lecture : la version en vigueur par défaut
 * (la plus récente publiée), ou toute autre version choisie.
 */
function DefinitionSection({ versions }: { versions: Version[] }) {
  const current = versions.find((v) => v.status === "PUBLIE") ?? versions[0];
  const [chosen, setChosen] = useState(String(current?.version ?? ""));
  const shownVersion = versions.find((v) => String(v.version) === chosen);
  if (!shownVersion) return null;
  return (
    <Panel className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Heading level={3}>Définition du type</Heading>
        {versions.length > 1 && (
          <div className="w-48">
            <SelectField
              label="Version affichée"
              options={versions.map((v) => ({
                value: String(v.version),
                label: `v${String(v.version)}`,
              }))}
              value={chosen}
              onChange={(e) => {
                setChosen(e.currentTarget.value);
              }}
            />
          </div>
        )}
      </div>
      <DefinitionView key={chosen} definition={shownVersion.definition} />
    </Panel>
  );
}
