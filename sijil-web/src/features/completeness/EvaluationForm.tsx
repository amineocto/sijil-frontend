import { useState } from "react";
import {
  contextProblem,
  parseContext,
  ROLE_LABELS,
  type CompletenessParty,
  type CompletenessRequest,
} from "@/features/completeness/completeness";
import { Button, SelectField, TextAreaField, TextField } from "@/shared/ui";
import { at, EXTERNAL_ID, EXTERNAL_ID_HINT, idProblem, isIsoDate } from "@/shared/validation";
import { useRefusedSubmit } from "@/shared/refusedSubmit";

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
  const [checked, setChecked] = useState(false);
  const problems = {
    ...Object.fromEntries(
      parties.flatMap((p, i) => {
        const problem = idProblem(p.externalId, EXTERNAL_ID, {
          required: false,
          hint: EXTERNAL_ID_HINT,
        });
        return problem ? [[`party${String(i)}`, problem]] : [];
      }),
    ),
    ...at("parties", complete.length === 0 ? "Indiquez au moins une partie" : undefined),
    ...at("context", contextProblem(context)),
    ...at("date", date && !isIsoDate(date) ? "Date invalide" : undefined),
  };
  const {
    container: formRef,
    refuse,
    summary: problemSummary,
  } = useRefusedSubmit(Object.keys(problems).length);

  return (
    <form
      ref={formRef}
      aria-label="Dossier à évaluer"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setChecked(true);
        if (Object.keys(problems).length > 0) {
          refuse();
          return;
        }
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
              error={
                checked
                  ? (problems[`party${String(index)}`] ??
                    (index === 0 ? problems["parties"] : undefined))
                  : undefined
              }
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
          error={checked ? problems["context"] : undefined}
          value={context}
          onChange={(event) => {
            setContext(event.currentTarget.value);
          }}
        />
        <TextField
          label="Date d'évaluation"
          description="Aujourd'hui par défaut"
          type="date"
          error={checked ? problems["date"] : undefined}
          value={date}
          onChange={(event) => {
            setDate(event.currentTarget.value);
          }}
        />
        {problemSummary}
        <div>
          <Button type="submit" loading={pending}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
