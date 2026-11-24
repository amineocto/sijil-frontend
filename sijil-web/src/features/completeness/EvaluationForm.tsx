import { useState } from "react";
import {
  parseContext,
  ROLE_LABELS,
  type CompletenessParty,
  type CompletenessRequest,
} from "@/features/completeness/completeness";
import { Button, SelectField, TextAreaField, TextField } from "@/shared/ui";

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
      <div className="flex flex-col gap-4">
        {parties.map((party, index) => (
          <div key={index} className="grid gap-4 md:grid-cols-3">
            <SelectField
              label={`Partie ${String(index + 1)}`}
              options={KINDS}
              value={party.kind}
              onChange={(event) => {
                update(index, { kind: event.currentTarget.value as CompletenessParty["kind"] });
              }}
            />
            <TextField
              label={`Identifiant de la partie ${String(index + 1)}`}
              value={party.externalId}
              maxLength={32}
              onChange={(event) => {
                update(index, { externalId: event.currentTarget.value });
              }}
            />
            <SelectField
              label={`Rôle de la partie ${String(index + 1)}`}
              options={ROLES}
              value={party.role}
              onChange={(event) => {
                update(index, { role: event.currentTarget.value as CompletenessParty["role"] });
              }}
            />
          </div>
        ))}
        <div>
          <Button
            variant="ghost"
            disabled={parties.length >= 10}
            onClick={() => {
              setParties([...parties, { kind: "PERSONNE", externalId: "", role: "CO_TITULAIRE" }]);
            }}
          >
            Ajouter une partie
          </Button>
        </div>
        <TextAreaField
          label="Contexte du dossier"
          description="Une condition par ligne, par exemple segment=SALARIE"
          rows={2}
          value={context}
          onChange={(event) => {
            setContext(event.currentTarget.value);
          }}
        />
        <TextField
          label="Date d'évaluation"
          description="Aujourd'hui par défaut"
          type="date"
          value={date}
          onChange={(event) => {
            setDate(event.currentTarget.value);
          }}
        />
        <div>
          <Button type="submit" loading={pending} disabled={complete.length === 0}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
