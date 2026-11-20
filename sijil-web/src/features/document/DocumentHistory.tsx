import { Badge, Stack, Table, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@sijil/ui-kit";
import { accessHeaders, type Access } from "@/shared/access";
import { api, call } from "@/shared/api";
import { formatDate, formatSize, statusLabel } from "@/shared/labels";
import { QueryState } from "@/shared/QueryState";
import type { Items, MetadataRevision, Usage, Version } from "@/shared/types";

type Part = "versions" | "metadata-revisions" | "usages";

function usePart<T>(id: string, part: Part, access: Access) {
  return useQuery({
    queryKey: ["document", id, part, access],
    queryFn: () =>
      call(
        api.GET(`/api/documents/{id}/${part}` as "/api/documents/{id}/versions", {
          params: { path: { id }, header: accessHeaders(access) },
        }),
      ) as unknown as Promise<Items<T>>,
  });
}

/** Versions, révisions des métadonnées et usages par parcours. */
export function DocumentHistory({ id, access }: { id: string; access: Access }) {
  const versions = usePart<Version>(id, "versions", access);
  const revisions = usePart<MetadataRevision>(id, "metadata-revisions", access);
  const usages = usePart<Usage>(id, "usages", access);
  return (
    <Stack>
      <Title order={3}>Versions</Title>
      <QueryState query={versions}>
        {({ items }) => (
          <Table aria-label="Versions">
            <Table.Thead>
              <Table.Tr>
                <Table.Th scope="col">Version</Table.Th>
                <Table.Th scope="col">Reçue le</Table.Th>
                <Table.Th scope="col">État</Table.Th>
                <Table.Th scope="col">Contenu</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((v) => (
                <Table.Tr key={v.number}>
                  <Table.Td>
                    {v.number} {v.current && <Badge variant="light">courante</Badge>}
                  </Table.Td>
                  <Table.Td>{formatDate(v.receivedAt)}</Table.Td>
                  <Table.Td>{statusLabel(v.status)}</Table.Td>
                  <Table.Td>
                    {v.mediaType}, {formatSize(v.size)}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </QueryState>
      <Title order={3}>Historique des métadonnées</Title>
      <QueryState query={revisions}>
        {({ items }) => (
          <Table aria-label="Historique des métadonnées">
            <Table.Thead>
              <Table.Tr>
                <Table.Th scope="col">Révision</Table.Th>
                <Table.Th scope="col">Le</Table.Th>
                <Table.Th scope="col">Par</Table.Th>
                <Table.Th scope="col">Motif</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((r) => (
                <Table.Tr key={r.number}>
                  <Table.Td>{r.number}</Table.Td>
                  <Table.Td>{formatDate(r.revisedAt)}</Table.Td>
                  <Table.Td>{r.author}</Table.Td>
                  <Table.Td>{r.reason ?? "Dépôt"}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </QueryState>
      <Title order={3}>Usages par d&apos;autres parcours</Title>
      <QueryState query={usages}>
        {({ items }) =>
          items.length === 0 ? (
            <EmptyState
              title="Aucun usage"
              description="Aucun autre parcours n'a consulté ce document."
              headingLevel={4}
            />
          ) : (
            <Table aria-label="Usages">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th scope="col">Parcours</Table.Th>
                  <Table.Th scope="col">Jour</Table.Th>
                  <Table.Th scope="col">Finalité</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {items.map((u) => (
                  <Table.Tr key={`${u.parcours}-${u.day}-${u.clientId}`}>
                    <Table.Td>{u.parcours}</Table.Td>
                    <Table.Td>{formatDate(u.day)}</Table.Td>
                    <Table.Td>{u.purpose}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )
        }
      </QueryState>
    </Stack>
  );
}
