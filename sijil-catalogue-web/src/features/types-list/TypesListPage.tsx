import { type SyntheticEvent } from "react";
import { Anchor, Button, Group, NativeSelect, Stack, Table, TextInput, Title } from "@mantine/core";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router";
import { EmptyState } from "@sijil/ui-kit";
import { api, call, type TypeStatus } from "@/shared/api";
import { STATUS_LABELS } from "@/shared/labels";
import { QueryState } from "@/shared/QueryState";
import { canContribute, useSession } from "@/shared/session";
import { StatusBadge } from "@/shared/StatusBadge";

const STATUSES = Object.keys(STATUS_LABELS) as TypeStatus[];

/** Écran « Liste des types » : filtres reflétés dans l'URL, pagination par curseur. */
export function TypesListPage() {
  const [params, setParams] = useSearchParams();
  const filters = {
    parcours: params.get("parcours") ?? "",
    status: (params.get("status") ?? "") as TypeStatus | "",
    q: params.get("q") ?? "",
  };
  const session = useSession();
  const parcours = useQuery({
    queryKey: ["parcours"],
    queryFn: () => call(api.GET("/api/parcours")),
    staleTime: 300_000,
  });
  const types = useInfiniteQuery({
    queryKey: ["types", filters],
    queryFn: ({ pageParam }) =>
      call(
        api.GET("/api/types", {
          params: {
            query: {
              ...(filters.parcours && { parcours: filters.parcours }),
              ...(filters.status && { status: filters.status }),
              ...(filters.q.length >= 2 && { q: filters.q }),
              ...(pageParam && { cursor: pageParam }),
            },
          },
        }),
      ),
    initialPageParam: "",
    getNextPageParam: (last) => (last.hasMore ? (last.nextCursor ?? undefined) : undefined),
  });

  function applyFilters(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    for (const key of ["q", "parcours", "status"]) {
      const raw = form.get(key);
      const value = typeof raw === "string" ? raw.trim() : "";
      if (value) next.set(key, value);
    }
    setParams(next);
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Types de documents</Title>
        {canContribute(session.data) && (
          <Button component={Link} to="/types/nouveau">
            Nouveau type
          </Button>
        )}
      </Group>
      <form onSubmit={applyFilters} aria-label="Filtres" key={params.toString()}>
        <Group align="end">
          <TextInput
            name="q"
            label="Recherche (code ou libellé)"
            description="Deux caractères au moins"
            defaultValue={filters.q}
          />
          <NativeSelect
            name="parcours"
            label="Parcours"
            defaultValue={filters.parcours}
            data={[
              { value: "", label: "Tous" },
              ...(parcours.data ?? []).map((p) => ({
                value: p.code,
                label: p.label,
              })),
            ]}
          />
          <NativeSelect
            name="status"
            label="Statut"
            defaultValue={filters.status}
            data={[
              { value: "", label: "Tous" },
              ...STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
            ]}
          />
          <Button type="submit" variant="light">
            Filtrer
          </Button>
        </Group>
      </form>
      <QueryState query={types}>
        {(data) => {
          const items = data.pages.flatMap((page) => page.items);
          if (items.length === 0) {
            return (
              <EmptyState
                title="Aucun type de document"
                description="Aucun type ne correspond à ces filtres."
              />
            );
          }
          return (
            <>
              <Table striped>
                <Table.Caption>
                  {items.length} type{items.length > 1 ? "s" : ""} affiché
                  {items.length > 1 ? "s" : ""}
                </Table.Caption>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th scope="col">Code</Table.Th>
                    <Table.Th scope="col">Libellé</Table.Th>
                    <Table.Th scope="col">Famille</Table.Th>
                    <Table.Th scope="col">Parcours</Table.Th>
                    <Table.Th scope="col">Dernière version</Table.Th>
                    <Table.Th scope="col">Statut</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {items.map((type) => (
                    <Table.Tr key={type.code}>
                      <Table.Td>
                        <Anchor component={Link} to={`/types/${type.code}`}>
                          {type.code}
                        </Anchor>
                      </Table.Td>
                      <Table.Td>{type.label ?? "—"}</Table.Td>
                      <Table.Td>{type.family ?? "—"}</Table.Td>
                      <Table.Td>{type.ownerParcours}</Table.Td>
                      <Table.Td>v{type.latest.version}</Table.Td>
                      <Table.Td>
                        <StatusBadge status={type.latest.status} />
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
              {types.hasNextPage && (
                <Button
                  variant="default"
                  onClick={() => void types.fetchNextPage()}
                  loading={types.isFetchingNextPage}
                >
                  Charger plus
                </Button>
              )}
            </>
          );
        }}
      </QueryState>
    </Stack>
  );
}
