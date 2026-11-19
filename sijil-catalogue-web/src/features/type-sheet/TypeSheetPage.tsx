import { useState } from "react";
import {
  Alert,
  Button,
  Code,
  Group,
  NativeSelect,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router";
import { ErrorState } from "@sijil/ui-kit";
import { api, call, isApiError, type Schemas } from "@/shared/api";
import { QueryState } from "@/shared/QueryState";
import { StatusBadge } from "@/shared/StatusBadge";
import { diffDefinitions } from "@/features/type-sheet/diff";

type Version = Schemas["TypeVersion"];

/** Écran « Fiche d'un type » : versions, différences entre deux versions, motif de revue. */
export function TypeSheetPage() {
  const code = useParams()["code"] ?? "";
  const sheet = useQuery({
    queryKey: ["type", code],
    queryFn: () => call(api.GET("/api/types/{code}", { params: { path: { code } } })),
  });
  return (
    <Stack>
      <Title order={2}>Type {code}</Title>
      <QueryState query={sheet}>{(data) => <Sheet sheet={data} />}</QueryState>
    </Stack>
  );
}

function Sheet({ sheet }: { sheet: Schemas["TypeSheet"] }) {
  const navigate = useNavigate();
  const latest = sheet.versions[0];
  const newVersion = useMutation({
    mutationFn: () =>
      call(
        api.POST("/api/types/{code}/new-version", {
          params: { path: { code: sheet.code } },
        }),
      ),
    onSuccess: () => void navigate(`/types/${sheet.code}/brouillon`),
  });
  const draftInProgress = latest?.status === "BROUILLON";
  return (
    <Stack>
      <Text>
        Parcours propriétaire : <strong>{sheet.ownerParcours}</strong> — référent :{" "}
        <strong>{sheet.referentParcours}</strong> — famille : {sheet.family ?? "non renseignée"}
      </Text>
      {latest?.reviewReason && (
        <Alert color="orange" title="Modifications demandées par la revue" role="note">
          {latest.reviewReason}
        </Alert>
      )}
      {sheet.canEdit && (
        <Group>
          {draftInProgress ? (
            <Button component={Link} to={`/types/${sheet.code}/brouillon`}>
              Modifier le brouillon
            </Button>
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
        </Group>
      )}
      {isApiError(newVersion.error) && <ErrorState error={newVersion.error} headingLevel={3} />}
      <Title order={3}>Versions</Title>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th scope="col">Version</Table.Th>
            <Table.Th scope="col">Statut</Table.Th>
            <Table.Th scope="col">Date d&apos;effet</Table.Th>
            <Table.Th scope="col">Soumise par</Table.Th>
            <Table.Th scope="col">Revue par</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {sheet.versions.map((v) => (
            <Table.Tr key={v.version}>
              <Table.Td>v{v.version}</Table.Td>
              <Table.Td>
                <StatusBadge status={v.status} />
              </Table.Td>
              <Table.Td>{v.effectiveFrom ?? "—"}</Table.Td>
              <Table.Td>{v.submittedBy ?? "—"}</Table.Td>
              <Table.Td>{v.reviewedBy ?? "—"}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {sheet.versions.length > 1 && <VersionDiff versions={sheet.versions} />}
    </Stack>
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
    <Stack>
      <Title order={3}>Différences entre deux versions</Title>
      <Group>
        <NativeSelect
          label="Version de départ"
          data={options}
          value={left}
          onChange={(e) => {
            setLeft(e.currentTarget.value);
          }}
        />
        <NativeSelect
          label="Version comparée"
          data={options}
          value={right}
          onChange={(e) => {
            setRight(e.currentTarget.value);
          }}
        />
      </Group>
      {changes.length === 0 ? (
        <Text>Aucune différence entre ces deux versions.</Text>
      ) : (
        <Stack aria-label="Rubriques modifiées">
          {changes.map((change) => (
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
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function shown(value: unknown): string {
  return value === undefined ? "(absente)" : JSON.stringify(value, null, 2);
}
