import { Anchor, Badge, Button, Group, Stack, Table, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@sijil/ui-kit";
import { Link } from "react-router";
import { api, call } from "@/shared/api";
import { QueryState } from "@/shared/QueryState";
import { canContributeToCatalogue, useSession } from "@/shared/session";

export const SET_STATUS_LABELS: Record<string, string> = {
  BROUILLON: "Brouillon",
  PUBLIE: "Publié",
  REMPLACE: "Remplacé",
};

/** Écran « Exigences » (L7-04) : jeux d'exigences documentaires des parcours. */
export function RequirementSetsPage() {
  const session = useSession();
  const sets = useQuery({
    queryKey: ["requirement-sets"],
    queryFn: () => call(api.GET("/api/requirement-sets", {})),
  });
  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Exigences documentaires</Title>
        {canContributeToCatalogue(session.data) && (
          <Button component={Link} to="/catalogue/exigences/nouveau">
            Nouveau jeu d'exigences
          </Button>
        )}
      </Group>
      <QueryState query={sets}>
        {(items) =>
          items.length === 0 ? (
            <EmptyState title="Aucun jeu d'exigences" />
          ) : (
            <Table>
              <Table.Caption>Dernière version de chaque jeu</Table.Caption>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th scope="col">Jeu</Table.Th>
                  <Table.Th scope="col">Libellé</Table.Th>
                  <Table.Th scope="col">Parcours</Table.Th>
                  <Table.Th scope="col">Version</Table.Th>
                  <Table.Th scope="col">Statut</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {items.map((s) => (
                  <Table.Tr key={s.code}>
                    <Table.Td>
                      <Anchor
                        component={Link}
                        to={`/catalogue/exigences/${s.code}/versions/${String(s.version)}`}
                      >
                        {s.code}
                      </Anchor>
                    </Table.Td>
                    <Table.Td>{s.definition.label}</Table.Td>
                    <Table.Td>{s.parcours}</Table.Td>
                    <Table.Td>{s.version}</Table.Td>
                    <Table.Td>
                      <Badge variant="light">{SET_STATUS_LABELS[s.status] ?? s.status}</Badge>
                    </Table.Td>
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
