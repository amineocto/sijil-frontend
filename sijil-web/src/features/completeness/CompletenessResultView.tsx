import { Alert, Badge, List, Stack, Table, Text, Title } from "@mantine/core";
import {
  partyLabel,
  STATE_COLORS,
  STATE_LABELS,
  type CompletenessResult,
} from "@/features/completeness/completeness";
import { formatDate } from "@/shared/labels";

/** Résultat du calcul : état par exigence et partie, puis pièces à demander. */
export function CompletenessResultView({ result }: { result: CompletenessResult }) {
  return (
    <Stack gap="sm" aria-live="polite">
      <Text fw={600}>
        {result.complete ? "Dossier complet" : "Dossier incomplet"} — jeu {result.requirementSet}
        {result.version > 0 ? ` (version ${String(result.version)})` : " (simulation)"}, au{" "}
        {formatDate(result.evaluationDate)}
      </Text>
      {result.partial && (
        <Alert color="orange" title="Résultat partiel">
          Une source n'a pas répondu : le résultat n'est pas complet.
        </Alert>
      )}
      {result.hiddenByAccessPolicy > 0 && (
        <Alert color="gray" title="Types non consultables">
          {String(result.hiddenByAccessPolicy)} type(s) exigé(s) ne sont pas consultables avec vos
          droits : ils ne comptent pas.
        </Alert>
      )}
      <Table>
        <Table.Caption>État des exigences</Table.Caption>
        <Table.Thead>
          <Table.Tr>
            <Table.Th scope="col">Exigence</Table.Th>
            <Table.Th scope="col">Partie</Table.Th>
            <Table.Th scope="col">État</Table.Th>
            <Table.Th scope="col">Documents retenus</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {result.requirements.flatMap((r) =>
            r.parties.map((p, i) => (
              <Table.Tr key={`${r.id}-${String(i)}`}>
                <Table.Td>{r.label ?? r.id}</Table.Td>
                <Table.Td>{partyLabel(p.party)}</Table.Td>
                <Table.Td>
                  <Badge color={STATE_COLORS[p.state]} variant="light">
                    {STATE_LABELS[p.state]}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {p.candidates.length === 0
                    ? "—"
                    : p.candidates
                        .map(
                          (c) =>
                            `${c.type} (${c.expiresAt ? formatDate(c.expiresAt) : "sans échéance"})`,
                        )
                        .join(", ")}
                </Table.Td>
              </Table.Tr>
            )),
          )}
        </Table.Tbody>
      </Table>
      <Title order={3} size="h4">
        Pièces à demander
      </Title>
      {result.toRequest.length === 0 ? (
        <Text>Aucune pièce à demander.</Text>
      ) : (
        <List aria-label="Pièces à demander">
          {result.toRequest.map((t, i) => (
            <List.Item key={`${t.requirementId}-${String(i)}`}>
              {t.anyOf.join(" ou ")} — {partyLabel(t.party)} ({STATE_LABELS[t.state]})
            </List.Item>
          ))}
        </List>
      )}
    </Stack>
  );
}
