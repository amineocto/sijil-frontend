import { useState } from "react";
import { Alert, Button, FileInput, Group, Progress, Stack, Textarea, Title } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, call, isApiError } from "@/shared/api";
import { sendFile } from "@/shared/deposit";
import { fieldsOf, toMetadata, toValues } from "@/shared/metadata";
import { MetadataFields } from "@/shared/MetadataFields";
import type { DocumentView, TypeVersion } from "@/shared/types";

type Mode = "none" | "metadata" | "version" | "delete";

/**
 * Actions d'un contributeur du parcours propriétaire : modifier les métadonnées, déposer une
 * nouvelle version, supprimer logiquement puis restaurer. Chaque écriture porte la révision lue
 * (`If-Match`) ; un conflit (412) invite à recharger.
 */
export function DocumentActions({ document, etag }: { document: DocumentView; etag: string }) {
  const [mode, setMode] = useState<Mode>("none");
  const [deleted, setDeleted] = useState<{ revision: number } | null>(null);
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: ["document", document.id] });

  if (deleted) {
    return (
      <Restore
        document={document}
        revision={deleted.revision}
        onDone={() => {
          setDeleted(null);
          void refresh();
        }}
      />
    );
  }
  return (
    <Stack gap="sm">
      <Title order={3}>Actions</Title>
      <Group>
        <Button
          variant="light"
          onClick={() => {
            setMode("metadata");
          }}
        >
          Modifier les métadonnées
        </Button>
        <Button
          variant="light"
          onClick={() => {
            setMode("version");
          }}
        >
          Nouvelle version
        </Button>
        <Button
          variant="light"
          color="red"
          onClick={() => {
            setMode("delete");
          }}
        >
          Supprimer
        </Button>
      </Group>
      {mode === "metadata" && (
        <EditMetadata
          document={document}
          etag={etag}
          onDone={() => {
            setMode("none");
            void refresh();
          }}
        />
      )}
      {mode === "version" && (
        <NewVersion
          document={document}
          etag={etag}
          onDone={() => {
            setMode("none");
            void refresh();
          }}
        />
      )}
      {mode === "delete" && (
        <Delete
          document={document}
          etag={etag}
          onDone={(revision) => {
            setMode("none");
            setDeleted({ revision });
          }}
        />
      )}
    </Stack>
  );
}

function useType(code: string) {
  return useQuery({
    queryKey: ["type", code],
    queryFn: () =>
      call(
        api.GET("/api/document-types/{code}", { params: { path: { code } } }),
      ) as unknown as Promise<TypeVersion>,
  });
}

function Failure({ error }: { error: unknown }) {
  if (!error) return null;
  const message = isApiError(error)
    ? error.status === 412
      ? "Le document a changé depuis son affichage : rechargez la page."
      : error.message
    : "L'opération a échoué.";
  return (
    <Alert color="red" role="alert" title="Échec">
      {message}
    </Alert>
  );
}

function EditMetadata({
  document,
  etag,
  onDone,
}: {
  document: DocumentView;
  etag: string;
  onDone: () => void;
}) {
  const type = useType(document.documentType);
  const [values, setValues] = useState(() => toValues(document.metadata));
  const [reason, setReason] = useState("");
  const fields = fieldsOf(type.data?.definition.metadataSchema);
  const save = useMutation({
    mutationFn: () =>
      call(
        api.PATCH("/api/documents/{id}", {
          params: { path: { id: document.id }, header: { "If-Match": etag } },
          body: { metadata: toMetadata(fields, values), reason },
        }),
      ),
    onSuccess: onDone,
  });
  const errors = isApiError(save.error) ? save.error.errorsByField() : {};
  return (
    <form
      aria-label="Modifier les métadonnées"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <Stack gap="sm" maw={560}>
        <MetadataFields fields={fields} values={values} errors={errors} onChange={setValues} />
        <Textarea
          label="Motif de la modification"
          required
          minLength={3}
          maxLength={500}
          value={reason}
          onChange={(e) => {
            setReason(e.currentTarget.value);
          }}
        />
        <Failure error={save.error} />
        <Group>
          <Button type="submit" loading={save.isPending}>
            Enregistrer
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

function NewVersion({
  document,
  etag,
  onDone,
}: {
  document: DocumentView;
  etag: string;
  onDone: () => void;
}) {
  const type = useType(document.documentType);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [key] = useState(() => crypto.randomUUID());
  const send = useMutation({
    mutationFn: async () => {
      if (!file || !type.data) throw new Error("Choisissez un fichier.");
      const session = await sendFile(type.data, file, key, setProgress);
      return call(
        api.POST("/api/documents/{id}/versions", {
          params: {
            path: { id: document.id },
            header: { "If-Match": etag, "Idempotency-Key": key },
          },
          body: { uploadSession: session },
        }),
      );
    },
    onSuccess: onDone,
  });
  return (
    <form
      aria-label="Nouvelle version"
      onSubmit={(e) => {
        e.preventDefault();
        send.mutate();
      }}
    >
      <Stack gap="sm" maw={560}>
        <FileInput
          label="Fichier de la nouvelle version"
          required
          accept={(type.data?.definition.formats ?? []).join(",")}
          value={file}
          onChange={setFile}
        />
        {send.isPending && <Progress value={progress} aria-label="Envoi du fichier" />}
        <Failure error={send.error} />
        <Group>
          <Button type="submit" loading={send.isPending} disabled={!type.data}>
            Envoyer
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

function Delete({
  document,
  etag,
  onDone,
}: {
  document: DocumentView;
  etag: string;
  onDone: (revision: number) => void;
}) {
  const [reason, setReason] = useState("");
  const remove = useMutation({
    mutationFn: () =>
      call(
        api.DELETE("/api/documents/{id}", {
          params: { path: { id: document.id }, header: { "If-Match": etag } },
          body: { reason },
        }),
      ) as unknown as Promise<{ revision: number }>,
    onSuccess: (outcome) => {
      onDone(outcome.revision);
    },
  });
  return (
    <form
      aria-label="Supprimer le document"
      onSubmit={(e) => {
        e.preventDefault();
        remove.mutate();
      }}
    >
      <Stack gap="sm" maw={560}>
        <Textarea
          label="Motif de la suppression"
          description="Suppression logique : le document reste conservé et peut être restauré."
          required
          minLength={3}
          maxLength={500}
          value={reason}
          onChange={(e) => {
            setReason(e.currentTarget.value);
          }}
        />
        <Failure error={remove.error} />
        <Group>
          <Button type="submit" color="red" loading={remove.isPending}>
            Confirmer la suppression
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

function Restore({
  document,
  revision,
  onDone,
}: {
  document: DocumentView;
  revision: number;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const restore = useMutation({
    mutationFn: () =>
      call(
        api.POST("/api/documents/{id}/restorations", {
          params: { path: { id: document.id }, header: { "If-Match": `"v${String(revision)}"` } },
          body: { reason },
        }),
      ),
    onSuccess: onDone,
  });
  return (
    <form
      aria-label="Restaurer le document"
      onSubmit={(e) => {
        e.preventDefault();
        restore.mutate();
      }}
    >
      <Stack gap="sm" maw={560}>
        <Alert color="orange" title="Document supprimé">
          Le document n&apos;est plus visible des lecteurs. Vous pouvez le restaurer.
        </Alert>
        <Textarea
          label="Motif de la restauration"
          required
          minLength={3}
          maxLength={500}
          value={reason}
          onChange={(e) => {
            setReason(e.currentTarget.value);
          }}
        />
        <Failure error={restore.error} />
        <Group>
          <Button type="submit" loading={restore.isPending}>
            Restaurer
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
