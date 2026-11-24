import { useEffect, useState } from "react";
import { ErrorState, LoadingState, networkError } from "@sijil/ui-kit";
import { accessHeaders, type Access } from "@/shared/access";
import type { DocumentView } from "@/shared/types";
import { Button, Muted } from "@/shared/ui";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; status: number }
  | { kind: "ready"; url: string; type: string };

/**
 * Aperçu relayé par le BFF (jamais d'URL présignée) : le contenu est lu avec les motifs d'accès en
 * en-têtes, puis affiché depuis la mémoire du navigateur. PDF et images seulement.
 */
export function Preview({ document, access }: { document: DocumentView; access: Access }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  useEffect(
    () => () => {
      if (state.kind === "ready") URL.revokeObjectURL(state.url);
    },
    [state],
  );

  async function load() {
    setState({ kind: "loading" });
    try {
      const response = await globalThis.fetch(
        `${globalThis.location.origin}/api/documents/${document.id}/preview`,
        { credentials: "same-origin", headers: accessHeaders(access) },
      );
      if (!response.ok) {
        setState({ kind: "error", status: response.status });
        return;
      }
      const blob = await response.blob();
      setState({ kind: "ready", url: URL.createObjectURL(blob), type: blob.type });
    } catch {
      setState({ kind: "error", status: 0 });
    }
  }

  if (state.kind === "loading") return <LoadingState />;
  if (state.kind === "error") {
    const error =
      state.status === 0
        ? networkError()
        : { message: "L'aperçu n'est pas disponible.", correlationId: undefined };
    return <ErrorState error={error} onRetry={() => void load()} />;
  }
  if (state.kind === "ready") {
    if (state.type.startsWith("image/")) {
      return (
        <img
          src={state.url}
          alt={`Aperçu du document ${document.documentType}`}
          className="max-w-3xl rounded-lg border border-gray-200"
        />
      );
    }
    return state.type === "application/pdf" ? (
      <iframe
        src={state.url}
        title={`Aperçu du document ${document.documentType}`}
        className="h-[70vh] w-full rounded-lg border border-gray-200"
      />
    ) : (
      <a
        href={state.url}
        download={document.id}
        className="font-medium text-orange-700 underline-offset-2 hover:underline"
      >
        Enregistrer le fichier
      </a>
    );
  }
  const viewable = ["application/pdf", "image/png", "image/jpeg"].includes(
    document.content.mediaType,
  );
  return (
    <div className="flex flex-col items-start gap-3">
      <Muted>
        {viewable
          ? "Le contenu s'affiche dans la page."
          : "Ce format ne s'affiche pas : il sera téléchargé."}
      </Muted>
      <Button variant="secondary" onClick={() => void load()}>
        {viewable ? "Afficher l'aperçu" : "Télécharger"}
      </Button>
    </div>
  );
}
