import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@sijil/ui-kit";
import { api, call } from "@/shared/api";
import { DataTable, Page } from "@/shared/ui/page";
import { QueryState } from "@/shared/QueryState";
import { canContributeToCatalogue, useSession } from "@/shared/session";
import { ButtonLink, Tag, TextLink } from "@/shared/ui";

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
    <Page
      title="Exigences documentaires"
      subtitle="Les pièces attendues pour un dossier, par parcours ; un simulateur montre ce qui manquerait à un client."
      actions={
        canContributeToCatalogue(session.data) && (
          <ButtonLink to="/catalogue/exigences/nouveau">Nouveau jeu d&apos;exigences</ButtonLink>
        )
      }
    >
      <QueryState query={sets}>
        {(items) =>
          items.length === 0 ? (
            <EmptyState title="Aucun jeu d'exigences" />
          ) : (
            <DataTable
              label="Dernière version de chaque jeu"
              rows={items}
              rowKey={(s) => s.code}
              columns={[
                {
                  header: "Jeu",
                  cell: (s) => (
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold">{s.definition.label}</span>
                      <TextLink
                        to={`/catalogue/exigences/${s.code}/versions/${String(s.version)}`}
                        className="font-mono text-xs"
                      >
                        {s.code}
                      </TextLink>
                    </div>
                  ),
                },
                { header: "Parcours", cell: (s) => s.parcours },
                {
                  header: "Version",
                  cell: (s) => (
                    <span className="flex items-center gap-2">
                      v{s.version}
                      <Tag>{SET_STATUS_LABELS[s.status] ?? s.status}</Tag>
                    </span>
                  ),
                },
              ]}
              mobile={(s) => (
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-semibold">{s.definition.label}</span>
                    <TextLink
                      to={`/catalogue/exigences/${s.code}/versions/${String(s.version)}`}
                      className="font-mono text-xs"
                    >
                      {s.code}
                    </TextLink>
                    <span className="text-sm text-gray-600">{s.parcours}</span>
                  </div>
                  <span className="flex shrink-0 items-center gap-2">
                    v{s.version}
                    <Tag>{SET_STATUS_LABELS[s.status] ?? s.status}</Tag>
                  </span>
                </div>
              )}
            />
          )
        }
      </QueryState>
    </Page>
  );
}
