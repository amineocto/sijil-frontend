import { type SyntheticEvent, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { EmptyState } from "@sijil/ui-kit";
import { api, call, type TypeStatus } from "@/shared/api";
import { STATUS_LABELS } from "@/features/catalogue/shared/labels";
import { DataTable, Page } from "@/shared/ui/page";
import { familyLabel } from "@/features/dossier/dossier";
import { QueryState } from "@/shared/QueryState";
import { canContributeToCatalogue, useSession } from "@/shared/session";
import { StatusBadge } from "@/features/catalogue/shared/StatusBadge";
import { Button, ButtonLink, Panel, SelectField, TextField, TextLink } from "@/shared/ui";
import { FAMILY_ICONS, Labelled } from "@/shared/ui/icons";

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

  const [queryProblem, setQueryProblem] = useState<string | undefined>();

  function applyFilters(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    for (const key of ["q", "parcours", "status"]) {
      const raw = form.get(key);
      const value = typeof raw === "string" ? raw.trim() : "";
      if (value) next.set(key, value);
    }
    // Le serveur ignore une recherche d'un seul caractère : on le dit au lieu de l'ignorer.
    const tooShort = (next.get("q") ?? "").length === 1;
    setQueryProblem(tooShort ? "Deux caractères au moins" : undefined);
    if (!tooShort) setParams(next);
  }

  return (
    <Page
      title="Catalogue des types"
      subtitle="Chaque type décrit ses métadonnées, sa conservation, sa sensibilité et son stockage."
      actions={
        canContributeToCatalogue(session.data) && (
          <ButtonLink to="/catalogue/types/nouveau">Nouveau type</ButtonLink>
        )
      }
    >
      <Panel className="p-4">
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
            maxLength={100}
            error={queryProblem}
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
          <div className="md:mt-[1.625rem]">
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
              <DataTable
                label={`${String(items.length)} type${items.length > 1 ? "s" : ""} affiché${items.length > 1 ? "s" : ""}`}
                rows={items}
                rowKey={(type) => type.code}
                columns={[
                  {
                    header: "Type",
                    cell: (type) => (
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-gray-900">
                          {type.label ?? type.code}
                        </span>
                        <TextLink
                          to={`/catalogue/types/${type.code}`}
                          className="font-mono text-xs"
                        >
                          {type.code}
                        </TextLink>
                      </div>
                    ),
                  },
                  {
                    header: "Famille",
                    cell: (type) =>
                      type.family ? (
                        <Labelled icons={FAMILY_ICONS} code={type.family}>
                          {familyLabel(type.family)}
                        </Labelled>
                      ) : (
                        "—"
                      ),
                  },
                  { header: "Parcours", cell: (type) => type.ownerParcours },
                  {
                    header: "Dernière version",
                    cell: (type) => (
                      <span className="flex items-center gap-2">
                        <span className="text-gray-700">v{type.latest.version}</span>
                        <StatusBadge status={type.latest.status} />
                      </span>
                    ),
                  },
                ]}
                mobile={(type) => (
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-semibold text-gray-900">{type.label ?? type.code}</span>
                      <TextLink to={`/catalogue/types/${type.code}`} className="font-mono text-xs">
                        {type.code}
                      </TextLink>
                      <span className="text-sm text-gray-600">
                        {type.family ? familyLabel(type.family) : "—"} · {type.ownerParcours}
                      </span>
                    </div>
                    <span className="flex shrink-0 items-center gap-2">
                      v{type.latest.version}
                      <StatusBadge status={type.latest.status} />
                    </span>
                  </div>
                )}
              />
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
    </Page>
  );
}
