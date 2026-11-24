import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { EvaluationForm } from "@/features/completeness/EvaluationForm";
import { CompletenessResultView } from "@/features/completeness/CompletenessResultView";
import { evaluate } from "@/features/completeness/completeness";
import { api, call, isApiError } from "@/shared/api";
import { Notice, Panel, SelectField } from "@/shared/ui";

/** Panneau « Complétude » (L7-05) : un jeu d'exigences publié évalué pour les parties d'un dossier. */
export function CompletenessPanel() {
  const [code, setCode] = useState<string | null>(null);
  const sets = useQuery({
    queryKey: ["requirement-sets"],
    queryFn: () => call(api.GET("/api/requirement-sets", {})),
  });
  const run = useMutation({ mutationFn: evaluate });
  const published = (sets.data ?? []).filter((s) => s.status !== "BROUILLON" || s.version > 1);

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <Panel className="flex flex-col gap-4">
        <SelectField
          label="Jeu d'exigences"
          placeholder={sets.isPending ? "Chargement…" : "Choisir un jeu publié"}
          options={published.map((s) => ({
            value: s.code,
            label: `${s.definition.label} (${s.code})`,
          }))}
          value={code ?? ""}
          onChange={(e) => {
            setCode(e.currentTarget.value || null);
          }}
        />
        <EvaluationForm
          submitLabel="Évaluer la complétude"
          pending={run.isPending}
          onSubmit={(evaluation) => {
            if (code) run.mutate({ requirementSet: code, ...evaluation });
          }}
        />
      </Panel>
      {!code && <Notice role="status">Choisissez d&apos;abord un jeu d&apos;exigences.</Notice>}
      {run.error && (
        <Notice tone="danger" title="Évaluation impossible">
          {isApiError(run.error) ? run.error.message : "Une erreur inattendue est survenue."}
        </Notice>
      )}
      {run.data && <CompletenessResultView result={run.data} />}
    </div>
  );
}
