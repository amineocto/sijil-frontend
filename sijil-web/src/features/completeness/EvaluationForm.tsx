import { useState } from "react";
import { Button, Group, Select, Stack, Textarea, TextInput } from "@mantine/core";
import {
  parseContext,
  ROLE_LABELS,
  type CompletenessParty,
  type CompletenessRequest,
} from "@/features/completeness/completeness";

const KINDS = [
  { value: "CLIENT", label: "Client" },
  { value: "PERSONNE", label: "Personne" },
  { value: "COMPTE", label: "Compte" },
];
const ROLES = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }));

type Evaluation = Pick<CompletenessRequest, "parties" | "context" | "evaluationDate">;

interface EvaluationFormProps {
  submitLabel: string;
  pending: boolean;
  onSubmit: (evaluation: Evaluation) => void;
}

/** Parties du dossier, contexte (« clé=valeur ») et date d'évaluation. */
export function EvaluationForm({ submitLabel, pending, onSubmit }: EvaluationFormProps) {
  const [parties, setParties] = useState<CompletenessParty[]>([
    { kind: "PERSONNE", externalId: "", role: "TITULAIRE" },
  ]);
  const [context, setContext] = useState("");
  const [date, setDate] = useState("");
  const update = (index: number, change: Partial<CompletenessParty>) => {
    setParties(parties.map((p, i) => (i === index ? { ...p, ...change } : p)));
  };
  const complete = parties.filter((p) => p.externalId.trim() !== "");

  return (
    <form
      aria-label="Dossier à évaluer"
      onSubmit={(event) => {
        event.preventDefault();
        if (complete.length === 0) return;
        onSubmit({
          parties: complete.map((p) => ({ ...p, externalId: p.externalId.trim() })),
          context: parseContext(context),
          ...(date ? { evaluationDate: date } : {}),
        });
      }}
    >
      <Stack gap="sm">
        {parties.map((party, index) => (
          <Group key={index} grow align="end">
            <Select
              label={`Partie ${String(index + 1)}`}
              data={KINDS}
              value={party.kind}
              allowDeselect={false}
              onChange={(value) => {
                update(index, { kind: (value ?? "PERSONNE") as CompletenessParty["kind"] });
              }}
            />
            <TextInput
              label={`Identifiant de la partie ${String(index + 1)}`}
              value={party.externalId}
              maxLength={32}
              onChange={(event) => {
                update(index, { externalId: event.currentTarget.value });
              }}
            />
            <Select
              label={`Rôle de la partie ${String(index + 1)}`}
              data={ROLES}
              value={party.role}
              allowDeselect={false}
              onChange={(value) => {
                update(index, { role: (value ?? "TITULAIRE") as CompletenessParty["role"] });
              }}
            />
          </Group>
        ))}
        <Group>
          <Button
            variant="subtle"
            disabled={parties.length >= 10}
            onClick={() => {
              setParties([...parties, { kind: "PERSONNE", externalId: "", role: "CO_TITULAIRE" }]);
            }}
          >
            Ajouter une partie
          </Button>
        </Group>
        <Textarea
          label="Contexte du dossier"
          description="Une condition par ligne, par exemple segment=SALARIE"
          autosize
          minRows={2}
          value={context}
          onChange={(event) => {
            setContext(event.currentTarget.value);
          }}
        />
        <TextInput
          label="Date d'évaluation"
          description="Aujourd'hui par défaut"
          type="date"
          value={date}
          onChange={(event) => {
            setDate(event.currentTarget.value);
          }}
        />
        <Group>
          <Button type="submit" loading={pending} disabled={complete.length === 0}>
            {submitLabel}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
