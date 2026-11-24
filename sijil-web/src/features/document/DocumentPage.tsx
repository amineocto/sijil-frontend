import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { LoadingState } from "@sijil/ui-kit";
import { AccessFields } from "@/shared/AccessFields";
import { accessHeaders, type Access } from "@/shared/access";
import { api, callWithETag, isApiError } from "@/shared/api";
import { formatValue } from "@/shared/metadata";
import { formatDate, formatSize, SENSITIVITY_LABELS, statusLabel } from "@/shared/labels";
import { QueryState } from "@/shared/QueryState";
import { canContribute, useSession } from "@/shared/session";
import type { DocumentView } from "@/shared/types";
import { DocumentActions } from "@/features/document/DocumentActions";
import { DocumentHistory } from "@/features/document/DocumentHistory";
import { Preview } from "@/features/document/Preview";
import { Button, Heading, Muted, Notice, Panel, Table, Tabs, Tag, Td, Th } from "@/shared/ui";

/**
 * Écran « Fiche document » : métadonnées, parties, aperçu, versions, historique et usages. Un
 * document d'un autre parcours demande une finalité ; un document restreint, un motif de bris de
 * glace (refus de `sijil-api`, rendu ici avec le formulaire d'accès).
 */
export function DocumentPage() {
  const { id = "" } = useParams();
  const [access, setAccess] = useState<Access>({});
  const [draft, setDraft] = useState<Access>({});
  const document = useQuery({
    queryKey: ["document", id, access],
    queryFn: () =>
      callWithETag(
        api.GET("/api/documents/{id}", {
          params: { path: { id }, header: accessHeaders(access) },
        }),
      ) as unknown as Promise<{ data: DocumentView; etag: string }>,
  });

  if (document.error && isApiError(document.error) && [403, 404].includes(document.error.status)) {
    return (
      <div className="flex max-w-3xl flex-col gap-4">
        <Heading>Document</Heading>
        <Notice tone="warning" title="Accès à justifier">
          {document.error.message} Ce document est peut-être celui d&apos;un autre parcours, ou
          restreint : indiquez pourquoi vous le consultez.
        </Notice>
        <Panel>
          <form
            aria-label="Motif d'accès"
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              setAccess(draft);
            }}
          >
            <AccessFields value={draft} onChange={setDraft} />
            <div>
              <Button type="submit">Consulter avec ce motif</Button>
            </div>
          </form>
        </Panel>
      </div>
    );
  }
  return (
    <QueryState query={document}>
      {({ data, etag }) => <Sheet document={data} etag={etag} access={access} />}
    </QueryState>
  );
}

function Sheet({
  document,
  etag,
  access,
}: {
  document: DocumentView;
  etag: string;
  access: Access;
}) {
  const session = useSession();
  if (session.isPending) return <LoadingState />;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Heading>{document.documentType}</Heading>
        <div className="flex gap-2">
          <Tag variant="info">{statusLabel(document.status)}</Tag>
          <Tag>{SENSITIVITY_LABELS[document.sensitivity]}</Tag>
        </div>
      </div>
      {document.verification && (
        <Notice tone="warning" title="Type à vérifier" role="status">
          Les traitements ont détecté un document de type {document.verification.detectedType}, et
          non {document.documentType}. Le parcours doit vérifier le type, et le corriger s&apos;il
          le faut.
        </Notice>
      )}
      <Muted>
        Parcours {document.parcours} · déposé le {formatDate(document.createdAt)} · version{" "}
        {document.currentVersion} · {document.content.mediaType},{" "}
        {formatSize(document.content.size)}
      </Muted>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel className="flex flex-col gap-3">
          <Heading level={3}>Métadonnées</Heading>
          <Table aria-label="Métadonnées">
            <tbody>
              {Object.entries(document.metadata).map(([name, value]) => (
                <tr key={name}>
                  <Th scope="row" className="w-1/3">
                    {name}
                  </Th>
                  <Td>{formatValue(value)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
        <Panel className="flex flex-col gap-3">
          <Heading level={3}>Parties</Heading>
          <ul className="list-disc ps-5 text-sm text-gray-900">
            {document.parties.map((p) => (
              <li key={`${p.type}-${p.id}-${p.role}`}>
                {p.type} {p.id} ({p.role})
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      {canContribute(session.data, document.parcours) && (
        <Panel>
          <DocumentActions document={document} etag={etag} />
        </Panel>
      )}
      <Panel>
        <Tabs
          label="Contenu du document"
          tabs={[
            {
              id: "apercu",
              label: "Aperçu",
              content: <Preview document={document} access={access} />,
            },
            {
              id: "historique",
              label: "Versions et historique",
              content: <DocumentHistory id={document.id} access={access} />,
            },
          ]}
        />
      </Panel>
    </div>
  );
}
