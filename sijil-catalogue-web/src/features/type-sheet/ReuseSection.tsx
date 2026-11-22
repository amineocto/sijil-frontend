import { useState } from "react";
import { Alert, Button, List, Stack, Text, Textarea, Title } from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ErrorState } from "@sijil/ui-kit";
import { api, call, isApiError, type Schemas } from "@/shared/api";
import { canContribute, useSession } from "@/shared/session";

/**
 * Parcours qui réutilisent le type, et déclaration de réutilisation par le parcours de
 * l'utilisateur (ORG-04 : sans approbation, journalisée).
 */
export function ReuseSection({ sheet }: { sheet: Schemas["TypeSheet"] }) {
  const session = useSession();
  const mine = session.data?.parcours[0];
  const canDeclare =
    canContribute(session.data) &&
    mine !== undefined &&
    mine !== sheet.ownerParcours &&
    !sheet.reuses.some((r) => r.parcours === mine);
  return (
    <Stack>
      <Title order={3}>Réutilisation</Title>
      {sheet.reuses.length === 0 ? (
        <Text>Aucun autre parcours ne réutilise ce type.</Text>
      ) : (
        <List aria-label="Parcours qui réutilisent le type">
          {sheet.reuses.map((r) => (
            <List.Item key={r.parcours}>
              <strong>{r.parcours}</strong> : {r.purpose} (déclaré par {r.declaredBy}, le{" "}
              {r.declaredAt.slice(0, 10)})
            </List.Item>
          ))}
        </List>
      )}
      {canDeclare && <ReuseForm code={sheet.code} parcours={mine} />}
    </Stack>
  );
}

function ReuseForm({ code, parcours }: { code: string; parcours: string }) {
  const queryClient = useQueryClient();
  const [purpose, setPurpose] = useState("");
  const [error, setError] = useState<string>();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const declare = useMutation({
    mutationFn: (body: Schemas["NewReuse"]) =>
      call(
        api.POST("/api/types/{code}/reuses", {
          params: { path: { code }, header: { "Idempotency-Key": idempotencyKey } },
          body,
        }),
      ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["type", code] }),
  });
  if (declare.isSuccess) {
    return (
      <Alert color="green" role="status" title="Réutilisation déclarée">
        Le parcours {parcours} réutilise désormais ce type ; la déclaration est journalisée.
      </Alert>
    );
  }
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const text = purpose.trim();
        if (text === "" || text.length > 500) {
          setError("Finalité obligatoire, 500 caractères au plus");
          return;
        }
        setError(undefined);
        declare.mutate({ purpose: text });
      }}
    >
      <Stack maw={560}>
        <Textarea
          label={`Finalité de la réutilisation par le parcours ${parcours}`}
          description="Sans approbation : la responsabilité revient à votre parcours."
          required
          value={purpose}
          error={error}
          onChange={(e) => {
            setPurpose(e.currentTarget.value);
          }}
        />
        <Button type="submit" loading={declare.isPending} w="fit-content">
          Déclarer la réutilisation
        </Button>
        {isApiError(declare.error) && <ErrorState error={declare.error} headingLevel={4} />}
      </Stack>
    </form>
  );
}
