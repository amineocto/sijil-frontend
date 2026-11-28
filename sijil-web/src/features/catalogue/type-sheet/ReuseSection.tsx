import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ErrorState } from "@sijil/ui-kit";
import { api, call, isApiError, type Schemas } from "@/shared/api";
import { canContributeToCatalogue, useSession } from "@/shared/session";
import { Button, Heading, Notice, Panel, TextAreaField } from "@/shared/ui";
import { queryKeys } from "@/shared/queryKeys";
import { useRefusedSubmit } from "@/shared/refusedSubmit";

/**
 * Parcours qui réutilisent le type, et déclaration de réutilisation par le parcours de
 * l'utilisateur (ORG-04 : sans approbation, journalisée).
 */
export function ReuseSection({ sheet }: { sheet: Schemas["TypeSheet"] }) {
  const session = useSession();
  const mine = session.data?.parcours[0];
  const canDeclare =
    canContributeToCatalogue(session.data) &&
    mine !== undefined &&
    mine !== sheet.ownerParcours &&
    !sheet.reuses.some((r) => r.parcours === mine);
  return (
    <Panel className="flex flex-col gap-4">
      <Heading level={3}>Réutilisation</Heading>
      {sheet.reuses.length === 0 ? (
        <p className="text-sm text-gray-900">Aucun autre parcours ne réutilise ce type.</p>
      ) : (
        <ul
          aria-label="Parcours qui réutilisent le type"
          className="list-disc ps-5 text-sm text-gray-900"
        >
          {sheet.reuses.map((r) => (
            <li key={r.parcours}>
              <strong>{r.parcours}</strong> : {r.purpose} (déclaré par {r.declaredBy}, le{" "}
              {r.declaredAt.slice(0, 10)})
            </li>
          ))}
        </ul>
      )}
      {canDeclare && <ReuseForm code={sheet.code} parcours={mine} />}
    </Panel>
  );
}

function ReuseForm({ code, parcours }: { code: string; parcours: string }) {
  const queryClient = useQueryClient();
  const [purpose, setPurpose] = useState("");
  const [error, setError] = useState<string>();
  const { container: formRef, refuse, summary: problemSummary } = useRefusedSubmit(error ? 1 : 0);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const declare = useMutation({
    mutationFn: (body: Schemas["NewReuse"]) =>
      call(
        api.POST("/api/types/{code}/reuses", {
          params: { path: { code }, header: { "Idempotency-Key": idempotencyKey } },
          body,
        }),
      ),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: queryKeys.catalogueType(code) }),
  });
  if (declare.isSuccess) {
    return (
      <Notice tone="success" role="status" title="Réutilisation déclarée">
        Le parcours {parcours} réutilise désormais ce type ; la déclaration est journalisée.
      </Notice>
    );
  }
  return (
    <form
      ref={formRef}
      noValidate
      className="flex max-w-xl flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const text = purpose.trim();
        if (text === "" || text.length > 500) {
          setError("Finalité obligatoire, 500 caractères au plus");
          refuse();
          return;
        }
        setError(undefined);
        declare.mutate({ purpose: text });
      }}
    >
      <TextAreaField
        label={`Finalité de la réutilisation par le parcours ${parcours}`}
        description="Sans approbation : la responsabilité revient à votre parcours."
        required
        value={purpose}
        error={error}
        onChange={(e) => {
          setPurpose(e.currentTarget.value);
        }}
      />
      {problemSummary}
      <div>
        <Button type="submit" loading={declare.isPending}>
          Déclarer la réutilisation
        </Button>
      </div>
      {isApiError(declare.error) && <ErrorState error={declare.error} headingLevel={4} />}
    </form>
  );
}
