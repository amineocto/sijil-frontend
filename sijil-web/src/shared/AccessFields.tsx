import { Stack, Textarea } from "@mantine/core";
import type { Access } from "@/shared/access";
import { canBreakGlass, useSession } from "@/shared/session";

/**
 * Accès hors de son parcours : finalité de l'usage (ADR 0018) et, pour un document restreint, motif
 * de bris de glace, proposé au seul rôle dédié (ADR 0011). Les deux sont tracés par `sijil-api`.
 */
export function AccessFields({
  value,
  onChange,
}: {
  value: Access;
  onChange: (access: Access) => void;
}) {
  const session = useSession();
  return (
    <Stack gap="xs">
      <Textarea
        label="Finalité (document d'un autre parcours)"
        description="Pourquoi consultez-vous ce document ? Elle est enregistrée."
        autosize
        minRows={1}
        maxLength={255}
        value={value.purpose ?? ""}
        onChange={(e) => {
          onChange({ ...value, purpose: e.currentTarget.value });
        }}
      />
      {canBreakGlass(session.data) && (
        <Textarea
          label="Motif de bris de glace (document restreint)"
          description="Accès exceptionnel, tracé et contrôlé."
          autosize
          minRows={1}
          maxLength={255}
          value={value.breakGlassReason ?? ""}
          onChange={(e) => {
            onChange({ ...value, breakGlassReason: e.currentTarget.value });
          }}
        />
      )}
    </Stack>
  );
}
