import { Anchor, Stack, Table, Text, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { EmptyState } from "@sijil/ui-kit";
import { api, call } from "@/shared/api";
import { QueryState } from "@/shared/QueryState";

/** Écran « File de revue » : versions soumises qui attendent un réviseur. */
export function ReviewQueuePage() {
  const queue = useQuery({
    queryKey: ["reviews"],
    queryFn: () => call(api.GET("/api/reviews")),
  });
  return (
    <Stack>
      <Title order={2}>File de revue</Title>
      <QueryState query={queue}>
        {(page) =>
          page.items.length === 0 ? (
            <EmptyState title="Aucune version en attente de revue" />
          ) : (
            <Table>
              <Table.Caption>Versions en revue, par code de type</Table.Caption>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th scope="col">Type</Table.Th>
                  <Table.Th scope="col">Libellé</Table.Th>
                  <Table.Th scope="col">Parcours propriétaire</Table.Th>
                  <Table.Th scope="col">Soumise par</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {page.items.map((t) => (
                  <Table.Tr key={t.code}>
                    <Table.Td>
                      <Anchor
                        component={Link}
                        to={`/catalogue/types/${t.code}/versions/${String(t.latest.version)}/revue`}
                      >
                        {t.code} v{t.latest.version}
                      </Anchor>
                    </Table.Td>
                    <Table.Td>{t.label ?? "—"}</Table.Td>
                    <Table.Td>{t.ownerParcours}</Table.Td>
                    <Table.Td>{t.latest.submittedBy ?? "—"}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )
        }
      </QueryState>
      {queue.data?.hasMore && (
        <Text size="sm">D&apos;autres versions attendent : affinez la liste des types.</Text>
      )}
    </Stack>
  );
}
