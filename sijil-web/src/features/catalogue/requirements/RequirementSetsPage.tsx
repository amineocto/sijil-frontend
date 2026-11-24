import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@sijil/ui-kit";
import { api, call } from "@/shared/api";
import { Page } from "@/shared/ui/page";
import { QueryState } from "@/shared/QueryState";
import { canContributeToCatalogue, useSession } from "@/shared/session";
import { ButtonLink, Table, Tag, Td, TextLink, Th } from "@/shared/ui";

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
            <Table>
              <caption className="sr-only">Dernière version de chaque jeu</caption>
              <thead>
                <tr>
                  <Th scope="col">Jeu</Th>
                  <Th scope="col">Libellé</Th>
                  <Th scope="col">Parcours</Th>
                  <Th scope="col">Version</Th>
                  <Th scope="col">Statut</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.code}>
                    <Td>
                      <TextLink to={`/catalogue/exigences/${s.code}/versions/${String(s.version)}`}>
                        {s.code}
                      </TextLink>
                    </Td>
                    <Td>{s.definition.label}</Td>
                    <Td>{s.parcours}</Td>
                    <Td>{s.version}</Td>
                    <Td>
                      <Tag>{SET_STATUS_LABELS[s.status] ?? s.status}</Tag>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )
        }
      </QueryState>
    </Page>
  );
}
