import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@sijil/ui-kit";
import { api, call } from "@/shared/api";
import { DataTable, Page } from "@/shared/ui/page";
import { QueryState } from "@/shared/QueryState";
import { Muted, TextLink } from "@/shared/ui";

/** Écran « File de revue » : versions soumises qui attendent un réviseur. */
export function ReviewQueuePage() {
  const queue = useQuery({
    queryKey: ["reviews"],
    queryFn: () => call(api.GET("/api/reviews")),
  });
  return (
    <Page
      title="File de revue"
      subtitle="Approuver avec une date d'effet, ou demander des modifications avec un motif."
    >
      <QueryState query={queue}>
        {(page) =>
          page.items.length === 0 ? (
            <EmptyState title="Aucune version en attente de revue" />
          ) : (
            <DataTable
              label="Versions en revue, par code de type"
              rows={page.items}
              rowKey={(t) => t.code}
              columns={[
                {
                  header: "Version",
                  cell: (t) => (
                    <div className="flex flex-col gap-0.5">
                      <TextLink
                        to={`/catalogue/types/${t.code}/versions/${String(t.latest.version)}/revue`}
                      >
                        {t.code} v{t.latest.version}
                      </TextLink>
                      <span className="text-xs text-gray-600">{t.label ?? "—"}</span>
                    </div>
                  ),
                },
                { header: "Parcours propriétaire", cell: (t) => t.ownerParcours },
                { header: "Soumise par", cell: (t) => t.latest.submittedBy ?? "—" },
              ]}
              mobile={(t) => (
                <div className="flex flex-col gap-1">
                  <TextLink
                    to={`/catalogue/types/${t.code}/versions/${String(t.latest.version)}/revue`}
                  >
                    {t.code} v{t.latest.version}
                  </TextLink>
                  <span className="text-sm text-gray-700">{t.label ?? "—"}</span>
                  <span className="text-sm text-gray-600">
                    {t.ownerParcours} · soumise par {t.latest.submittedBy ?? "—"}
                  </span>
                </div>
              )}
            />
          )
        }
      </QueryState>
      {queue.data?.hasMore && (
        <Muted>D&apos;autres versions attendent : affinez la liste des types.</Muted>
      )}
    </Page>
  );
}
