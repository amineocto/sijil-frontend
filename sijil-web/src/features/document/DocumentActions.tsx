import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, call, isApiError } from "@/shared/api";
import { sendFile } from "@/shared/deposit";
import { fieldsOf, toMetadata, toValues } from "@/shared/metadata";
import { MetadataFields } from "@/shared/MetadataFields";
import type { DocumentView, TypeVersion } from "@/shared/types";
import { Button, FileField, Heading, Notice, ProgressBar, TextAreaField } from "@/shared/ui";
import {
  at,
  fileProblem,
  merged,
  metadataProblems,
  REASON,
  serverProblems,
  textProblem,
} from "@/shared/validation";
import { queryKeys } from "@/shared/queryKeys";

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
    <div className="flex flex-col gap-4">
      <Heading level={3}>Actions</Heading>
      <div className="flex flex-wrap gap-3">
        <Button
          variant="secondary"
          onClick={() => {
            setMode("metadata");
          }}
        >
          Modifier les métadonnées
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setMode("version");
          }}
        >
          Nouvelle version
        </Button>
        <Button
          variant="ghost"
          classes={{ button: "text-red-700 border-red-300 hover:bg-red-50" }}
          onClick={() => {
            setMode("delete");
          }}
        >
          Supprimer
        </Button>
      </div>
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
    </div>
  );
}

function useType(code: string) {
  return useQuery({
    queryKey: queryKeys.publishedType(code),
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
    <Notice tone="danger" role="alert" title="Échec">
      {message}
    </Notice>
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
  const [checked, setChecked] = useState(false);
  const local = {
    ...metadataProblems(fields, values),
    ...at("reason", textProblem(reason, { required: true, min: REASON.min, max: REASON.max })),
  };
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
  const server = isApiError(save.error) ? serverProblems(save.error.errorsByField()) : {};
  const errors = checked ? merged(local, server) : server;
  return (
    <form
      aria-label="Modifier les métadonnées"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setChecked(true);
        if (Object.keys(local).length === 0) save.mutate();
      }}
    >
      <div className="flex max-w-xl flex-col gap-4">
        <MetadataFields fields={fields} values={values} errors={errors} onChange={setValues} />
        <TextAreaField
          label="Motif de la modification"
          required
          maxLength={REASON.max}
          error={errors["reason"]?.join(", ")}
          value={reason}
          onChange={(e) => {
            setReason(e.currentTarget.value);
          }}
        />
        <Failure error={save.error} />
        <div>
          <Button type="submit" loading={save.isPending}>
            Enregistrer
          </Button>
        </div>
      </div>
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
  // Une clé par fichier envoyé (AUD-20261120-339).
  const key = useMemo(() => (file ? crypto.randomUUID() : ""), [file]);
  const [checked, setChecked] = useState(false);
  const formats = type.data?.definition.formats ?? [];
  const problem = fileProblem(file, formats, type.data?.definition.maxSizeMb ?? 50);
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
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setChecked(true);
        if (!problem) send.mutate();
      }}
    >
      <div className="flex max-w-xl flex-col gap-4">
        <FileField
          label="Fichier de la nouvelle version"
          required
          accept={formats.join(",")}
          onFile={setFile}
          error={checked ? problem : undefined}
        />
        {send.isPending && <ProgressBar value={progress} label="Envoi du fichier" />}
        <Failure error={send.error} />
        <div>
          <Button type="submit" loading={send.isPending} disabled={!type.data}>
            Envoyer
          </Button>
        </div>
      </div>
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
  const [checked, setChecked] = useState(false);
  const reasonProblem = textProblem(reason, { required: true, min: REASON.min, max: REASON.max });
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
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setChecked(true);
        if (!reasonProblem) remove.mutate();
      }}
    >
      <div className="flex max-w-xl flex-col gap-4">
        <TextAreaField
          label="Motif de la suppression"
          description="Suppression logique : le document reste conservé et peut être restauré."
          required
          maxLength={REASON.max}
          error={checked ? reasonProblem : undefined}
          value={reason}
          onChange={(e) => {
            setReason(e.currentTarget.value);
          }}
        />
        <Failure error={remove.error} />
        <div>
          <Button type="submit" variant="danger" loading={remove.isPending}>
            Confirmer la suppression
          </Button>
        </div>
      </div>
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
  const [checked, setChecked] = useState(false);
  const reasonProblem = textProblem(reason, { required: true, min: REASON.min, max: REASON.max });
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
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setChecked(true);
        if (!reasonProblem) restore.mutate();
      }}
    >
      <div className="flex max-w-xl flex-col gap-4">
        <Notice tone="warning" title="Document supprimé">
          Le document n&apos;est plus visible des lecteurs. Vous pouvez le restaurer.
        </Notice>
        <TextAreaField
          label="Motif de la restauration"
          required
          maxLength={REASON.max}
          error={checked ? reasonProblem : undefined}
          value={reason}
          onChange={(e) => {
            setReason(e.currentTarget.value);
          }}
        />
        <Failure error={restore.error} />
        <div>
          <Button type="submit" loading={restore.isPending}>
            Restaurer
          </Button>
        </div>
      </div>
    </form>
  );
}
