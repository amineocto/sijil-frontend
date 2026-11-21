import { useState } from "react";
import { Alert, Anchor, Button, Group, Select, Stack, Table, Text, TextInput } from "@mantine/core";
import { useInfiniteQuery } from "@tanstack/react-query";
import { EmptyState } from "@sijil/ui-kit";
import { Link } from "react-router";
import { api, call } from "@/shared/api";
import { formatDate, PARTY_TYPE_LABELS } from "@/shared/labels";
import { QueryState } from "@/shared/QueryState";
import { Thumbnail } from "@/shared/Thumbnail";
import type { FullTextItem, FullTextPage, PartyType } from "@/shared/types";

interface Criteria {
  q: string;
  partyType: PartyType;
  partyId: string;
}

/**
 * Recherche plein texte (lot 5, L5-08) dans le texte OCR et les métadonnées des documents Sijil
 * d'une partie ; la façade n'interroge que les types que l'utilisateur a le droit de voir. Les
 * résultats arrivent par pages de 20, « Résultats suivants » charge la page d'après
 * (AUD-20261120-374).
 */
export function FullTextSearch() {
  const [draft, setDraft] = useState<Criteria>({ q: "", partyType: "CLIENT", partyId: "" });
  const [criteria, setCriteria] = useState<Criteria | null>(null);
  const results = useInfiniteQuery({
    queryKey: ["fulltext", criteria],
    enabled: criteria !== null,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => search(criteria as Criteria, pageParam),
    getNextPageParam: (last: FullTextPage) =>
      last.page.hasMore && last.page.nextCursor ? last.page.nextCursor : undefined,
  });
  return (
    <Stack>
      <form
        aria-label="Recherche plein texte"
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.q.trim().length >= 2 && draft.partyId.trim()) {
            setCriteria({ ...draft, q: draft.q.trim(), partyId: draft.partyId.trim() });
          }
        }}
      >
        <Stack gap="sm" maw={720}>
          <TextInput
            label="Texte cherché"
            description="Dans le texte des documents et leurs métadonnées (2 caractères au moins)."
            required
            minLength={2}
            maxLength={200}
            value={draft.q}
            onChange={(e) => {
              setDraft({ ...draft, q: e.currentTarget.value });
            }}
          />
          <Group grow align="end">
            <Select
              label="Partie"
              data={Object.entries(PARTY_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
              value={draft.partyType}
              allowDeselect={false}
              onChange={(value) => {
                setDraft({ ...draft, partyType: (value ?? "CLIENT") as PartyType });
              }}
            />
            <TextInput
              label="Identifiant de la partie"
              required
              value={draft.partyId}
              onChange={(e) => {
                setDraft({ ...draft, partyId: e.currentTarget.value });
              }}
            />
          </Group>
          <Group>
            <Button type="submit">Chercher</Button>
          </Group>
        </Stack>
      </form>
      {criteria === null ? (
        <Text c="dimmed">Saisissez un texte et une partie.</Text>
      ) : // Une page suivante en échec garde les résultats déjà affichés (AUD-20261120-399).
      results.data && results.isFetchNextPageError ? (
        <Results
          items={results.data.pages.flatMap((page) => page.items)}
          hasMore={results.hasNextPage}
          loadingMore={results.isFetchingNextPage}
          moreFailed
          onMore={() => void results.fetchNextPage()}
        />
      ) : (
        <QueryState query={results}>
          {(data) => (
            <Results
              items={data.pages.flatMap((page) => page.items)}
              hasMore={results.hasNextPage}
              loadingMore={results.isFetchingNextPage}
              moreFailed={false}
              onMore={() => void results.fetchNextPage()}
            />
          )}
        </QueryState>
      )}
    </Stack>
  );
}

interface ResultsProps {
  items: FullTextItem[];
  hasMore: boolean;
  loadingMore: boolean;
  moreFailed: boolean;
  onMore: () => void;
}

function Results({ items, hasMore, loadingMore, moreFailed, onMore }: ResultsProps) {
  if (items.length === 0) {
    return <EmptyState title="Aucun document" description="Aucun document ne contient ce texte." />;
  }
  return (
    <Stack>
      <Table striped aria-label="Documents trouvés en plein texte">
        <Table.Thead>
          <Table.Tr>
            <Table.Th scope="col">Aperçu</Table.Th>
            <Table.Th scope="col">Type</Table.Th>
            <Table.Th scope="col">Déposé le</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((d) => (
            <Table.Tr key={d.id}>
              <Table.Td>
                {d.source.sijilId && <Thumbnail id={d.source.sijilId} label={d.type.label} />}
              </Table.Td>
              <Table.Td>
                {d.source.sijilId ? (
                  <Anchor component={Link} to={`/documents/${d.source.sijilId}`}>
                    {d.type.label}
                  </Anchor>
                ) : (
                  d.type.label
                )}
              </Table.Td>
              <Table.Td>{formatDate(d.createdAt)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {moreFailed && (
        <Alert color="red" role="alert" title="Résultats suivants indisponibles">
          Les résultats suivants n&apos;ont pas pu être chargés ; ceux affichés restent valables.
        </Alert>
      )}
      {hasMore && (
        <Group>
          <Button variant="default" loading={loadingMore} onClick={onMore}>
            {moreFailed ? "Réessayer" : "Résultats suivants"}
          </Button>
        </Group>
      )}
    </Stack>
  );
}

function search(criteria: Criteria, cursor: string | undefined): Promise<FullTextPage> {
  return call(
    api.GET("/api/search", {
      params: {
        query: {
          q: criteria.q,
          partyType: criteria.partyType,
          partyId: criteria.partyId,
          ...(cursor ? { cursor } : {}),
        },
      },
    }),
  ) as unknown as Promise<FullTextPage>;
}
