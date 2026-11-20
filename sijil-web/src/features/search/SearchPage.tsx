import { useState } from "react";
import {
  Anchor,
  Badge,
  Button,
  Group,
  Select,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@sijil/ui-kit";
import { Link } from "react-router";
import { FullTextSearch } from "@/features/search/FullTextSearch";
import { AccessFields } from "@/shared/AccessFields";
import { accessHeaders, type Access } from "@/shared/access";
import { api, call } from "@/shared/api";
import { formatDate, PARTY_TYPE_LABELS, SENSITIVITY_LABELS } from "@/shared/labels";
import { QueryState } from "@/shared/QueryState";
import { Thumbnail } from "@/shared/Thumbnail";
import type { DocumentPage, PartyType } from "@/shared/types";

interface Criteria {
  partyType: PartyType;
  partyId: string;
  documentType: string;
  access: Access;
}

/** Écran « Recherche » : documents Sijil d'un client, d'une personne ou d'un compte. */
export function SearchPage() {
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
    <Stack>
      <Title order={2}>Rechercher des documents</Title>
      <Tabs defaultValue="parties" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="parties">Par partie</Tabs.Tab>
          <Tabs.Tab value="texte">Plein texte</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="texte" pt="md">
          <FullTextSearch />
        </Tabs.Panel>
        <Tabs.Panel value="parties" pt="md">
          <form
            aria-label="Critères de recherche"
            onSubmit={(event) => {
              event.preventDefault();
              if (draft.partyId.trim()) setCriteria({ ...draft, partyId: draft.partyId.trim() });
            }}
          >
            <Stack gap="sm" maw={720}>
              <Group grow align="end">
                <Select
                  label="Partie"
                  data={Object.entries(PARTY_TYPE_LABELS).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                  value={draft.partyType}
                  allowDeselect={false}
                  onChange={(value) => {
                    setDraft({ ...draft, partyType: (value ?? "CLIENT") as PartyType });
                  }}
                />
                <TextInput
                  label="Identifiant"
                  required
                  value={draft.partyId}
                  onChange={(e) => {
                    setDraft({ ...draft, partyId: e.currentTarget.value });
                  }}
                />
                <TextInput
                  label="Type de document (code)"
                  value={draft.documentType}
                  onChange={(e) => {
                    setDraft({ ...draft, documentType: e.currentTarget.value.toUpperCase() });
                  }}
                />
              </Group>
              <AccessFields
                value={draft.access}
                onChange={(access) => {
                  setDraft({ ...draft, access });
                }}
              />
              <Group>
                <Button type="submit">Rechercher</Button>
              </Group>
            </Stack>
          </form>
          {criteria === null ? (
            <Text c="dimmed">Saisissez un client, une personne ou un compte.</Text>
          ) : (
            <QueryState query={results}>{(page) => <Results page={page} />}</QueryState>
          )}
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

function Results({ page }: { page: DocumentPage }) {
  if (page.items.length === 0) {
    return <EmptyState title="Aucun document" description="Aucun document Sijil ne correspond." />;
  }
  return (
    <Table striped aria-label="Documents trouvés">
      <Table.Thead>
        <Table.Tr>
          <Table.Th scope="col">Aperçu</Table.Th>
          <Table.Th scope="col">Type</Table.Th>
          <Table.Th scope="col">Déposé le</Table.Th>
          <Table.Th scope="col">Sensibilité</Table.Th>
          <Table.Th scope="col">Parcours</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {page.items.map((d) => (
          <Table.Tr key={d.id}>
            <Table.Td>
              <Thumbnail id={d.id} label={d.documentType} />
            </Table.Td>
            <Table.Td>
              <Anchor component={Link} to={`/documents/${d.id}`}>
                {d.documentType}
              </Anchor>
            </Table.Td>
            <Table.Td>{formatDate(d.createdAt)}</Table.Td>
            <Table.Td>
              <Badge variant="light">{SENSITIVITY_LABELS[d.sensitivity]}</Badge>
            </Table.Td>
            <Table.Td>{d.parcours}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
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
