import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CompletenessResultView } from "@/features/completeness/CompletenessResultView";
import {
  evaluate,
  STATE_LABELS,
  type CompletenessResult,
} from "@/features/completeness/completeness";
import { api, call, isApiError } from "@/shared/api";
import type { PartyType } from "@/shared/types";
import { Button, Heading, Notice, Panel, ProgressBar, SelectField } from "@/shared/ui";

/** Pièces satisfaites sur pièces exigées (hors exigences non applicables). */
export function score(result: CompletenessResult): { satisfied: number; total: number } {
  const states = result.requirements.flatMap((r) => r.parties.map((p) => p.state));
  const applicable = states.filter((s) => s !== "NON_APPLICABLE");
  return {
    satisfied: applicable.filter((s) => s === "SATISFAITE").length,
    total: applicable.length,
  };
}

/**
 * Complétude du dossier : un jeu d'exigences publié, évalué pour la partie du dossier (titulaire),
 * en jauge, avec les pièces qui manquent et le détail à la demande.
 */
export function DossierCompleteness({
  partyType,
  partyId,
}: {
  partyType: PartyType;
  partyId: string;
}) {
  const [code, setCode] = useState("");
  const [detail, setDetail] = useState(false);
  const sets = useQuery({
    queryKey: ["requirement-sets"],
    queryFn: () => call(api.GET("/api/requirement-sets", {})),
  });
  const run = useMutation({ mutationFn: evaluate });
  const published = (sets.data ?? []).filter((s) => s.status !== "BROUILLON" || s.version > 1);
  const result = run.data;
  const missing =
    result?.requirements.flatMap((r) =>
      r.parties
        .filter((p) => p.state !== "SATISFAITE" && p.state !== "NON_APPLICABLE")
        .map((p) => `${r.label ?? r.id} (${STATE_LABELS[p.state].toLowerCase()})`),
    ) ?? [];
  const progress = result ? score(result) : null;

  return (
    <Panel className="flex flex-col gap-4">
      <Heading level={3}>Complétude du dossier</Heading>
      <form
        aria-label="Vérifier la complétude"
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!code) return;
          setDetail(false);
          run.mutate({
            requirementSet: code,
            parties: [{ kind: partyType, externalId: partyId, role: "TITULAIRE" }],
          });
        }}
      >
        <SelectField
          label="Jeu d'exigences"
          placeholder={sets.isPending ? "Chargement…" : "Choisir un jeu publié"}
          options={published.map((s) => ({ value: s.code, label: s.definition.label }))}
          value={code}
          onChange={(e) => {
            setCode(e.currentTarget.value);
          }}
        />
        <div>
          <Button type="submit" variant="secondary" disabled={!code || run.isPending}>
            {run.isPending ? "Vérification…" : "Vérifier"}
          </Button>
        </div>
      </form>
      {run.error && (
        <Notice tone="danger" title="Vérification impossible">
          {isApiError(run.error) ? run.error.message : "Une erreur inattendue est survenue."}
        </Notice>
      )}
      {result && progress && (
        <div className="flex flex-col gap-3" aria-live="polite">
          <ProgressBar
            value={progress.total === 0 ? 100 : (progress.satisfied / progress.total) * 100}
            label={`${String(progress.satisfied)} pièce(s) sur ${String(progress.total)}`}
          />
          <p
            className={`text-sm font-semibold ${result.complete ? "text-green-700" : "text-red-700"}`}
          >
            {result.complete ? "Dossier complet" : "Dossier incomplet"}
          </p>
          {missing.length > 0 && (
            <ul className="list-disc ps-5 text-sm text-gray-800">
              {missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
          {result.partial && (
            <Notice tone="warning" title="Résultat partiel">
              Une source n&apos;a pas répondu : le résultat n&apos;est pas complet.
            </Notice>
          )}
          <div>
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={detail}
              onClick={() => {
                setDetail(!detail);
              }}
            >
              {detail ? "Masquer le détail" : "Voir le détail"}
            </Button>
          </div>
          {detail && <CompletenessResultView result={result} />}
        </div>
      )}
    </Panel>
  );
}
