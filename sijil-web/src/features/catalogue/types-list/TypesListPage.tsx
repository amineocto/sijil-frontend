import { type SyntheticEvent } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { EmptyState } from "@sijil/ui-kit";
import { api, call, type TypeStatus } from "@/shared/api";
import { STATUS_LABELS } from "@/features/catalogue/shared/labels";
import { QueryState } from "@/shared/QueryState";
import { canContributeToCatalogue, useSession } from "@/shared/session";
import { StatusBadge } from "@/features/catalogue/shared/StatusBadge";
import {
  Button,
  ButtonLink,
  Heading,
  Panel,
  SelectField,
  Table,
  Td,
  TextField,
  TextLink,
  Th,
} from "@/shared/ui";

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
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Heading>Types de documents</Heading>
        {canContributeToCatalogue(session.data) && (
          <ButtonLink to="/catalogue/types/nouveau">Nouveau type</ButtonLink>
        )}
      </div>
      <Panel>
        <form
          onSubmit={applyFilters}
          aria-label="Filtres"
          key={params.toString()}
          className="grid items-start gap-4 md:grid-cols-[2fr_1fr_1fr_auto]"
        >
          <TextField
            name="q"
            label="Recherche (code ou libellé)"
            description="Deux caractères au moins"
            defaultValue={filters.q}
          />
          <SelectField
            name="parcours"
            label="Parcours"
            defaultValue={filters.parcours}
            options={[
              { value: "", label: "Tous" },
              ...(parcours.data ?? []).map((p) => ({
                value: p.code,
                label: p.label,
              })),
            ]}
          />
          <SelectField
            name="status"
            label="Statut"
            defaultValue={filters.status}
            options={[
              { value: "", label: "Tous" },
              ...STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
            ]}
          />
          <div className="md:mt-7">
            <Button type="submit" variant="secondary">
              Filtrer
            </Button>
          </div>
        </form>
      </Panel>
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
              <Table>
                <caption className="sr-only">
                  {items.length} type{items.length > 1 ? "s" : ""} affiché
                  {items.length > 1 ? "s" : ""}
                </caption>
                <thead>
                  <tr>
                    <Th scope="col">Code</Th>
                    <Th scope="col">Libellé</Th>
                    <Th scope="col">Famille</Th>
                    <Th scope="col">Parcours</Th>
                    <Th scope="col">Dernière version</Th>
                    <Th scope="col">Statut</Th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((type) => (
                    <tr key={type.code}>
                      <Td>
                        <TextLink to={`/catalogue/types/${type.code}`}>{type.code}</TextLink>
                      </Td>
                      <Td>{type.label ?? "—"}</Td>
                      <Td>{type.family ?? "—"}</Td>
                      <Td>{type.ownerParcours}</Td>
                      <Td>v{type.latest.version}</Td>
                      <Td>
                        <StatusBadge status={type.latest.status} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              {types.hasNextPage && (
                <Button
                  variant="secondary"
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
    </div>
  );
}
