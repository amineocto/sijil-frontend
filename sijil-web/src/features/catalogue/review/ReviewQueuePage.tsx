import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@sijil/ui-kit";
import { api, call } from "@/shared/api";
import { Page } from "@/shared/ui/page";
import { QueryState } from "@/shared/QueryState";
import { Muted, Table, Td, TextLink, Th } from "@/shared/ui";

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
            <Table>
              <caption className="sr-only">Versions en revue, par code de type</caption>
              <thead>
                <tr>
                  <Th scope="col">Type</Th>
                  <Th scope="col">Libellé</Th>
                  <Th scope="col">Parcours propriétaire</Th>
                  <Th scope="col">Soumise par</Th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((t) => (
                  <tr key={t.code}>
                    <Td>
                      <TextLink
                        to={`/catalogue/types/${t.code}/versions/${String(t.latest.version)}/revue`}
                      >
                        {t.code} v{t.latest.version}
                      </TextLink>
                    </Td>
                    <Td>{t.label ?? "—"}</Td>
                    <Td>{t.ownerParcours}</Td>
                    <Td>{t.latest.submittedBy ?? "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )
        }
      </QueryState>
      {queue.data?.hasMore && (
        <Muted>D&apos;autres versions attendent : affinez la liste des types.</Muted>
      )}
    </Page>
  );
}
