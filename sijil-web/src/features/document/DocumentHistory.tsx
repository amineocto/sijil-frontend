import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@sijil/ui-kit";
import { accessHeaders, type Access } from "@/shared/access";
import { api, call } from "@/shared/api";
import { formatDate, formatSize, statusLabel } from "@/shared/labels";
import { QueryState } from "@/shared/QueryState";
import type { Items, MetadataRevision, Usage, Version } from "@/shared/types";
import { Heading, Table, Tag, Td, Th } from "@/shared/ui";

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
    <div className="flex flex-col gap-4">
      <Heading level={3}>Versions</Heading>
      <QueryState query={versions}>
        {({ items }) => (
          <Table aria-label="Versions">
            <thead>
              <tr>
                <Th scope="col">Version</Th>
                <Th scope="col">Reçue le</Th>
                <Th scope="col">État</Th>
                <Th scope="col">Contenu</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((v) => (
                <tr key={v.number}>
                  <Td>
                    {v.number} {v.current && <Tag variant="primary">courante</Tag>}
                  </Td>
                  <Td>{formatDate(v.receivedAt)}</Td>
                  <Td>{statusLabel(v.status)}</Td>
                  <Td>
                    {v.mediaType}, {formatSize(v.size)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </QueryState>
      <Heading level={3}>Historique des métadonnées</Heading>
      <QueryState query={revisions}>
        {({ items }) => (
          <Table aria-label="Historique des métadonnées">
            <thead>
              <tr>
                <Th scope="col">Révision</Th>
                <Th scope="col">Le</Th>
                <Th scope="col">Par</Th>
                <Th scope="col">Motif</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.number}>
                  <Td>{r.number}</Td>
                  <Td>{formatDate(r.revisedAt)}</Td>
                  <Td>{r.author}</Td>
                  <Td>{r.reason ?? "Dépôt"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </QueryState>
      <Heading level={3}>Usages par d&apos;autres parcours</Heading>
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
              <thead>
                <tr>
                  <Th scope="col">Parcours</Th>
                  <Th scope="col">Jour</Th>
                  <Th scope="col">Finalité</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((u) => (
                  <tr key={`${u.parcours}-${u.day}-${u.clientId}`}>
                    <Td>{u.parcours}</Td>
                    <Td>{formatDate(u.day)}</Td>
                    <Td>{u.purpose}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )
        }
      </QueryState>
    </div>
  );
}
