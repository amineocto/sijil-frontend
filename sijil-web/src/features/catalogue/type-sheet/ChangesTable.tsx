import { fieldChanges } from "@/features/catalogue/type-sheet/readable";
import { Table, Td, Th } from "@/shared/ui";

/** Différences entre deux définitions, champ par champ, avec les libellés de l'éditeur. */
export function ChangesTable({
  before,
  after,
  empty,
}: {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  empty: string;
}) {
  const changes = fieldChanges(before, after);
  if (changes.length === 0) return <p className="text-sm text-gray-900">{empty}</p>;
  return (
    <Table aria-label="Champs modifiés">
      <thead>
        <tr>
          <Th scope="col">Rubrique</Th>
          <Th scope="col">Champ</Th>
          <Th scope="col">Avant</Th>
          <Th scope="col">Après</Th>
        </tr>
      </thead>
      <tbody>
        {changes.map((c) => (
          <tr key={`${c.rubric}-${c.field}`}>
            <Td>{c.rubric}</Td>
            <Td>{c.field}</Td>
            <Td className="text-gray-600">{c.before}</Td>
            <Td className="font-semibold">{c.after}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
