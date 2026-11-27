import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ErrorState, LoadingState, networkError } from "@sijil/ui-kit";
import { accessHeaders, type Access } from "@/shared/access";
import type { DocumentView } from "@/shared/types";
import { Button, Muted } from "@/shared/ui";

/** Formats affichés dans la page ; les autres se téléchargent. */
const VIEWABLE = ["application/pdf", "image/png", "image/jpeg"];

class PreviewError extends Error {
  constructor(readonly status: number) {
    super("aperçu indisponible");
  }
}

interface Content {
  url: string;
  type: string;
}

async function fetchPreview(document: DocumentView, access: Access): Promise<Content> {
  let response: Response;
  try {
    response = await globalThis.fetch(
      `${globalThis.location.origin}/api/documents/${document.id}/preview`,
      { credentials: "same-origin", headers: accessHeaders(access) },
    );
  } catch {
    throw new PreviewError(0);
  }
  if (!response.ok) throw new PreviewError(response.status);
  const blob = await response.blob();
  return { url: URL.createObjectURL(blob), type: blob.type };
}

/**
 * Aperçu relayé par le BFF (jamais d'URL présignée) : le contenu est lu avec les motifs d'accès en
 * en-têtes, puis affiché depuis la mémoire du navigateur. Un PDF ou une image s'affiche dès
 * l'ouverture du document (demande du responsable, 2026-11-27) ; un autre format attend un clic,
 * car il se télécharge.
 */
export function Preview({ document, access }: { document: DocumentView; access: Access }) {
  const viewable = VIEWABLE.includes(document.content.mediaType);
  const [requested, setRequested] = useState(false);
  const preview = useQuery({
    queryKey: ["preview", document.id, access],
    queryFn: () => fetchPreview(document, access),
    enabled: viewable || requested,
    retry: false,
    gcTime: 0,
    staleTime: Infinity,
  });
  const url = preview.data?.url;
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );

  if (preview.isFetching) return <LoadingState />;
  if (preview.error) {
    const error =
      preview.error instanceof PreviewError && preview.error.status === 0
        ? networkError()
        : { message: "L'aperçu n'est pas disponible.", correlationId: undefined };
    return <ErrorState error={error} onRetry={() => void preview.refetch()} />;
  }
  if (preview.data) {
    const { type } = preview.data;
    if (type.startsWith("image/")) {
      return (
        <img
          src={preview.data.url}
          alt={`Aperçu du document ${document.documentType}`}
          className="max-w-3xl rounded-lg border border-gray-200"
        />
      );
    }
    return type === "application/pdf" ? (
      <iframe
        src={preview.data.url}
        title={`Aperçu du document ${document.documentType}`}
        className="h-[70vh] w-full rounded-lg border border-gray-200"
      />
    ) : (
      <a
        href={preview.data.url}
        download={document.id}
        className="font-medium text-orange-700 underline-offset-2 hover:underline"
      >
        Enregistrer le fichier
      </a>
    );
  }
  return (
    <div className="flex flex-col items-start gap-3">
      <Muted>Ce format ne s&apos;affiche pas : il sera téléchargé.</Muted>
      <Button
        variant="secondary"
        onClick={() => {
          setRequested(true);
        }}
      >
        Télécharger
      </Button>
    </div>
  );
}
