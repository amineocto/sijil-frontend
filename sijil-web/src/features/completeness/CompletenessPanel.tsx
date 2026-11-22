import { useState } from "react";
import { Alert, Select, Stack } from "@mantine/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import { EvaluationForm } from "@/features/completeness/EvaluationForm";
import { CompletenessResultView } from "@/features/completeness/CompletenessResultView";
import { evaluate } from "@/features/completeness/completeness";
import { api, call, isApiError } from "@/shared/api";

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
    <Stack maw={960}>
      <Select
        label="Jeu d'exigences"
        placeholder={sets.isPending ? "Chargement…" : "Choisir un jeu publié"}
        data={published.map((s) => ({ value: s.code, label: `${s.definition.label} (${s.code})` }))}
        value={code}
        onChange={setCode}
      />
      <EvaluationForm
        submitLabel="Évaluer la complétude"
        pending={run.isPending}
        onSubmit={(evaluation) => {
          if (code) run.mutate({ requirementSet: code, ...evaluation });
        }}
      />
      {!code && <Alert color="gray">Choisissez d'abord un jeu d'exigences.</Alert>}
      {run.error && (
        <Alert color="red" title="Évaluation impossible">
          {isApiError(run.error) ? run.error.message : "Une erreur inattendue est survenue."}
        </Alert>
      )}
      {run.data && <CompletenessResultView result={run.data} />}
    </Stack>
  );
}
