import { useState } from "react";
import { Alert, Badge, Button, Group, Stack, Table, Tabs, Text, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { LoadingState } from "@sijil/ui-kit";
import { AccessFields } from "@/shared/AccessFields";
import { accessHeaders, type Access } from "@/shared/access";
import { api, callWithETag, isApiError } from "@/shared/api";
import { formatValue } from "@/shared/metadata";
import { formatDate, formatSize, SENSITIVITY_LABELS, statusLabel } from "@/shared/labels";
import { QueryState } from "@/shared/QueryState";
import { canContribute, useSession } from "@/shared/session";
import type { DocumentView } from "@/shared/types";
import { DocumentActions } from "@/features/document/DocumentActions";
import { DocumentHistory } from "@/features/document/DocumentHistory";
import { Preview } from "@/features/document/Preview";

/**
 * Écran « Fiche document » : métadonnées, parties, aperçu, versions, historique et usages. Un
 * document d'un autre parcours demande une finalité ; un document restreint, un motif de bris de
 * glace (refus de `sijil-api`, rendu ici avec le formulaire d'accès).
 */
export function DocumentPage() {
  const { id = "" } = useParams();
  const [access, setAccess] = useState<Access>({});
  const [draft, setDraft] = useState<Access>({});
  const document = useQuery({
    queryKey: ["document", id, access],
    queryFn: () =>
      callWithETag(
        api.GET("/api/documents/{id}", {
          params: { path: { id }, header: accessHeaders(access) },
        }),
      ) as unknown as Promise<{ data: DocumentView; etag: string }>,
  });

  if (document.error && isApiError(document.error) && [403, 404].includes(document.error.status)) {
    return (
      <Stack maw={720}>
        <Title order={2}>Document</Title>
        <Alert color="orange" title="Accès à justifier">
          {document.error.message} Ce document est peut-être celui d&apos;un autre parcours, ou
          restreint : indiquez pourquoi vous le consultez.
        </Alert>
        <form
          aria-label="Motif d'accès"
          onSubmit={(event) => {
            event.preventDefault();
            setAccess(draft);
          }}
        >
          <Stack gap="sm">
            <AccessFields value={draft} onChange={setDraft} />
            <Group>
              <Button type="submit">Consulter avec ce motif</Button>
            </Group>
          </Stack>
        </form>
      </Stack>
    );
  }
  return (
    <QueryState query={document}>
      {({ data, etag }) => <Sheet document={data} etag={etag} access={access} />}
    </QueryState>
  );
}

function Sheet({
  document,
  etag,
  access,
}: {
  document: DocumentView;
  etag: string;
  access: Access;
}) {
  const session = useSession();
  if (session.isPending) return <LoadingState />;
  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>{document.documentType}</Title>
        <Group gap="xs">
          <Badge variant="light">{statusLabel(document.status)}</Badge>
          <Badge variant="light">{SENSITIVITY_LABELS[document.sensitivity]}</Badge>
        </Group>
      </Group>
      <Text size="sm" c="dimmed">
        Parcours {document.parcours} · déposé le {formatDate(document.createdAt)} · version{" "}
        {document.currentVersion} · {document.content.mediaType},{" "}
        {formatSize(document.content.size)}
      </Text>
      <Title order={3}>Métadonnées</Title>
      <Table aria-label="Métadonnées" maw={720}>
        <Table.Tbody>
          {Object.entries(document.metadata).map(([name, value]) => (
            <Table.Tr key={name}>
              <Table.Th scope="row">{name}</Table.Th>
              <Table.Td>{formatValue(value)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      <Title order={3}>Parties</Title>
      <ul>
        {document.parties.map((p) => (
          <li key={`${p.type}-${p.id}-${p.role}`}>
            {p.type} {p.id} ({p.role})
          </li>
        ))}
      </ul>
      {canContribute(session.data, document.parcours) && (
        <DocumentActions document={document} etag={etag} />
      )}
      <Tabs defaultValue="apercu" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="apercu">Aperçu</Tabs.Tab>
          <Tabs.Tab value="historique">Versions et historique</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="apercu" pt="md">
          <Preview document={document} access={access} />
        </Tabs.Panel>
        <Tabs.Panel value="historique" pt="md">
          <DocumentHistory id={document.id} access={access} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
