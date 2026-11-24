import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@sijil/ui-kit";
import { CompletenessPanel } from "@/features/completeness/CompletenessPanel";
import { FullTextSearch } from "@/features/search/FullTextSearch";
import { AccessFields } from "@/shared/AccessFields";
import { accessHeaders, type Access } from "@/shared/access";
import { api, call } from "@/shared/api";
import { formatDate, PARTY_OPTIONS, SENSITIVITY_LABELS } from "@/shared/labels";
import { QueryState } from "@/shared/QueryState";
import { Thumbnail } from "@/shared/Thumbnail";
import type { DocumentPage, PartyType } from "@/shared/types";
import {
  Button,
  Heading,
  Muted,
  Panel,
  SelectField,
  Table,
  Tabs,
  Tag,
  Td,
  TextField,
  TextLink,
  Th,
} from "@/shared/ui";

interface Criteria {
  partyType: PartyType;
  partyId: string;
  documentType: string;
  access: Access;
}

/** Écran « Recherche » : documents Sijil d'un client, d'une personne ou d'un compte. */
export function SearchPage() {
  return (
    <div className="flex flex-col gap-6">
      <Heading>Rechercher des documents</Heading>
      <Tabs
        label="Modes de recherche"
        tabs={[
          { id: "parties", label: "Par partie", content: <PartySearch /> },
          { id: "texte", label: "Plein texte", content: <FullTextSearch /> },
          { id: "completude", label: "Complétude", content: <CompletenessPanel /> },
        ]}
      />
    </div>
  );
}

function PartySearch() {
  const [draft, setDraft] = useState<Criteria>({
    partyType: "CLIENT",
    partyId: "",
    documentType: "",
    access: {},
  });
  const [criteria, setCriteria] = useState<Criteria | null>(null);
  const results = useQuery({
    queryKey: ["documents", criteria],
    enabled: criteria !== null,
    queryFn: () => search(criteria as Criteria),
  });
  return (
    <div className="flex flex-col gap-6">
      <Panel>
        <form
          aria-label="Critères de recherche"
          className="flex max-w-3xl flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (draft.partyId.trim()) setCriteria({ ...draft, partyId: draft.partyId.trim() });
          }}
        >
          <div className="grid gap-4 md:grid-cols-3">
            <SelectField
              label="Partie"
              options={PARTY_OPTIONS}
              value={draft.partyType}
              onChange={(e) => {
                setDraft({ ...draft, partyType: e.currentTarget.value as PartyType });
              }}
            />
            <TextField
              label="Identifiant"
              required
              value={draft.partyId}
              onChange={(e) => {
                setDraft({ ...draft, partyId: e.currentTarget.value });
              }}
            />
            <TextField
              label="Type de document (code)"
              value={draft.documentType}
              onChange={(e) => {
                setDraft({ ...draft, documentType: e.currentTarget.value.toUpperCase() });
              }}
            />
          </div>
          <AccessFields
            value={draft.access}
            onChange={(access) => {
              setDraft({ ...draft, access });
            }}
          />
          <div>
            <Button type="submit">Rechercher</Button>
          </div>
        </form>
      </Panel>
      {criteria === null ? (
        <Muted>Saisissez un client, une personne ou un compte.</Muted>
      ) : (
        <QueryState query={results}>{(page) => <Results page={page} />}</QueryState>
      )}
    </div>
  );
}

function Results({ page }: { page: DocumentPage }) {
  if (page.items.length === 0) {
    return <EmptyState title="Aucun document" description="Aucun document Sijil ne correspond." />;
  }
  return (
    <Table aria-label="Documents trouvés">
      <thead>
        <tr>
          <Th scope="col">Aperçu</Th>
          <Th scope="col">Type</Th>
          <Th scope="col">Déposé le</Th>
          <Th scope="col">Sensibilité</Th>
          <Th scope="col">Parcours</Th>
        </tr>
      </thead>
      <tbody>
        {page.items.map((d) => (
          <tr key={d.id} className="hover:bg-gray-50">
            <Td>
              <Thumbnail id={d.id} label={d.documentType} />
            </Td>
            <Td>
              <TextLink to={`/documents/${d.id}`}>{d.documentType}</TextLink>
            </Td>
            <Td>{formatDate(d.createdAt)}</Td>
            <Td>
              <Tag>{SENSITIVITY_LABELS[d.sensitivity]}</Tag>
            </Td>
            <Td>{d.parcours}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function search(criteria: Criteria): Promise<DocumentPage> {
  return call(
    api.GET("/api/documents", {
      params: {
        query: {
          partyType: criteria.partyType,
          partyId: criteria.partyId,
          ...(criteria.documentType ? { documentType: criteria.documentType } : {}),
        },
        header: accessHeaders(criteria.access),
      },
    }),
  ) as unknown as Promise<DocumentPage>;
}
