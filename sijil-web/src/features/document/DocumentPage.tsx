import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { LoadingState } from "@sijil/ui-kit";
import { AccessFields, accessProblem } from "@/shared/AccessFields";
import { accessHeaders, type Access } from "@/shared/access";
import { api, callWithETag, isApiError } from "@/shared/api";
import { displayValue, humanize } from "@/shared/metadata";
import {
  formatDate,
  formatSize,
  PARTY_ROLE_LABELS,
  PARTY_TYPE_LABELS,
  SENSITIVITY_LABELS,
  statusLabel,
} from "@/shared/labels";
import { QueryState } from "@/shared/QueryState";
import { canContribute, useSession } from "@/shared/session";
import type { DocumentView } from "@/shared/types";
import { DocumentActions } from "@/features/document/DocumentActions";
import { typeLabel } from "@/features/dossier/dossier";
import { useTypeIndex } from "@/features/dossier/typeIndex";
import { DocumentHistory } from "@/features/document/DocumentHistory";
import { Preview } from "@/features/document/Preview";
import { Button, Heading, Notice, Panel, Table, Tabs, Tag, Td, Th } from "@/shared/ui";
import { KeyValues, Page, Section } from "@/shared/ui/page";
import { CodeIcon, LIFECYCLE_ICONS, SENSITIVITY_ICONS } from "@/shared/ui/icons";

/**
 * Écran « Fiche document » : métadonnées, parties, aperçu, versions, historique et usages. Un
 * document d'un autre parcours demande une finalité ; un document restreint, un motif de bris de
 * glace (refus de `sijil-api`, rendu ici avec le formulaire d'accès).
 */
export function DocumentPage() {
  const { id = "" } = useParams();
  return <DocumentSheet id={id} frame="page" />;
}

/**
 * Fiche d'un document, en pleine page ou dans le volet du dossier client. `title` : libellé du type
 * quand l'écran appelant le connaît (son code à défaut).
 */
export function DocumentSheet({
  id,
  title,
  frame = "drawer",
}: {
  id: string;
  title?: string;
  /** Pleine page (bandeau du poste CRC) ou volet du dossier (en-tête compact). */
  frame?: "page" | "drawer";
}) {
  const [access, setAccess] = useState<Access>({});
  const [draft, setDraft] = useState<Access>({});
  const [accessChecked, setAccessChecked] = useState(false);
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
    const form = (
      <div className="flex max-w-3xl flex-col gap-4">
        <Notice tone="warning" title="Accès à justifier">
          Ce document appartient à un autre parcours, ou il est restreint : indiquez pourquoi vous
          le consultez. Votre réponse est enregistrée.
        </Notice>
        <Panel>
          <form
            aria-label="Motif d'accès"
            className="flex flex-col gap-4"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              setAccessChecked(true);
              if (!accessProblem(draft)) setAccess(draft);
            }}
          >
            <AccessFields
              value={draft}
              onChange={setDraft}
              error={accessChecked ? accessProblem(draft) : undefined}
            />
            <div>
              <Button type="submit">Consulter avec ce motif</Button>
            </div>
          </form>
        </Panel>
      </div>
    );
    return frame === "page" ? (
      <Page title={title ?? "Document"} width="narrow">
        {form}
      </Page>
    ) : (
      <div className="flex flex-col gap-4">
        <Heading>{title ?? "Document"}</Heading>
        {form}
      </div>
    );
  }
  return (
    <QueryState query={document}>
      {({ data, etag }) => (
        <Sheet document={data} etag={etag} access={access} title={title} frame={frame} />
      )}
    </QueryState>
  );
}

function Sheet({
  document,
  etag,
  access,
  title,
  frame,
}: {
  document: DocumentView;
  etag: string;
  access: Access;
  title: string | undefined;
  frame: "page" | "drawer";
}) {
  const session = useSession();
  const types = useTypeIndex();
  if (session.isPending) return <LoadingState />;
  const heading = title ?? typeLabel(document.documentType, types);
  const tags = (
    <>
      <Tag variant="info">
        <CodeIcon icons={LIFECYCLE_ICONS} code={document.status} />
        {statusLabel(document.status)}
      </Tag>
      <Tag>
        <CodeIcon icons={SENSITIVITY_ICONS} code={document.sensitivity} />
        {SENSITIVITY_LABELS[document.sensitivity]}
      </Tag>
      {document.sharedInPortfolio && (
        <Tag variant="success">Partagé dans le portefeuille client</Tag>
      )}
    </>
  );
  const body = (
    <>
      {document.verification && (
        <Notice tone="warning" title="Type à vérifier" role="status">
          Les traitements ont détecté un document de type {document.verification.detectedType}, et
          non {document.documentType}. Le parcours doit vérifier le type, et le corriger s&apos;il
          le faut.
        </Notice>
      )}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <section className="min-w-0 self-start rounded-xl border border-gray-200 bg-white p-6 shadow-xs">
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
        </section>
        <div className="flex min-w-0 flex-col gap-5">
          <Section title="Informations" flush>
            <Table bare aria-label="Métadonnées" className="[&_tr:last-child>*]:border-b-0">
              <tbody>
                {Object.entries(document.metadata).map(([name, value]) => (
                  <tr key={name}>
                    <Th scope="row" className="w-2/5 bg-white font-medium text-gray-600">
                      {humanize(name)}
                    </Th>
                    <Td>{displayValue(value)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Section>
          <Section title="Parties">
            <ul className="flex flex-col gap-2 text-sm text-gray-900">
              {document.parties.map((p) => (
                <li
                  key={`${p.type}-${p.id}-${p.role}`}
                  className="flex items-center justify-between gap-3"
                >
                  <span>
                    {PARTY_TYPE_LABELS[p.type] ?? p.type} {p.id}
                  </span>
                  <Tag>{PARTY_ROLE_LABELS[p.role] ?? p.role}</Tag>
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Conservation et traçabilité">
            <KeyValues
              items={[
                ["Type", `${document.documentType} · version ${String(document.typeVersion)}`],
                ["Parcours", document.parcours],
                ["Déposé le", formatDate(document.createdAt)],
                ["Version du fichier", String(document.currentVersion)],
                ["Format", `${document.content.mediaType}, ${formatSize(document.content.size)}`],
                [
                  "Empreinte",
                  <code key="h" className="text-xs break-all">
                    sha256 {document.content.sha256.slice(0, 12)}…
                  </code>,
                ],
              ]}
            />
          </Section>
          {canContribute(session.data, document.parcours) && (
            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-xs">
              <DocumentActions document={document} etag={etag} />
            </section>
          )}
        </div>
      </div>
    </>
  );
  if (frame === "page") {
    return (
      <Page title={heading} subtitle={tags}>
        {body}
      </Page>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Heading>{heading}</Heading>
        <div className="flex flex-wrap gap-2">{tags}</div>
      </div>
      {body}
    </div>
  );
}
