import {
  partyLabel,
  STATE_COLORS,
  STATE_LABELS,
  type CompletenessResult,
} from "@/features/completeness/completeness";
import { formatDate } from "@/shared/labels";
import { Heading, Notice, Panel, Table, Tag, Td, Th } from "@/shared/ui";

/** Résultat du calcul : état par exigence et partie, puis pièces à demander. */
export function CompletenessResultView({ result }: { result: CompletenessResult }) {
  return (
    <Panel className="flex flex-col gap-4" aria-live="polite">
      <p className="font-semibold text-gray-900">
        {result.complete ? "Dossier complet" : "Dossier incomplet"} — jeu {result.requirementSet}
        {result.version > 0 ? ` (version ${String(result.version)})` : " (simulation)"}, au{" "}
        {formatDate(result.evaluationDate)}
      </p>
      {result.partial && (
        <Notice tone="warning" title="Résultat partiel">
          Une source n'a pas répondu : le résultat n'est pas complet.
        </Notice>
      )}
      {result.hiddenByAccessPolicy > 0 && (
        <Notice title="Types non consultables">
          {String(result.hiddenByAccessPolicy)} type(s) exigé(s) ne sont pas consultables avec vos
          droits : ils ne comptent pas.
        </Notice>
      )}
      <Table>
        <caption className="sr-only">État des exigences</caption>
        <thead>
          <tr>
            <Th scope="col">Exigence</Th>
            <Th scope="col">Partie</Th>
            <Th scope="col">État</Th>
            <Th scope="col">Documents retenus</Th>
          </tr>
        </thead>
        <tbody>
          {result.requirements.flatMap((r) =>
            r.parties.map((p, i) => (
              <tr key={`${r.id}-${String(i)}`}>
                <Td>{r.label ?? r.id}</Td>
                <Td>{partyLabel(p.party)}</Td>
                <Td>
                  <Tag variant={STATE_COLORS[p.state]}>{STATE_LABELS[p.state]}</Tag>
                </Td>
                <Td>
                  {p.candidates.length === 0
                    ? "—"
                    : p.candidates
                        .map(
                          (c) =>
                            `${c.type} (${c.expiresAt ? formatDate(c.expiresAt) : "sans échéance"})`,
                        )
                        .join(", ")}
                </Td>
              </tr>
            )),
          )}
        </tbody>
      </Table>
      <Heading level={3}>Pièces à demander</Heading>
      {result.toRequest.length === 0 ? (
        <p className="text-sm text-gray-900">Aucune pièce à demander.</p>
      ) : (
        <ul aria-label="Pièces à demander" className="list-disc ps-5 text-sm text-gray-900">
          {result.toRequest.map((t, i) => (
            <li key={`${t.requirementId}-${String(i)}`}>
              {t.anyOf.join(" ou ")} — {partyLabel(t.party)} ({STATE_LABELS[t.state]})
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
