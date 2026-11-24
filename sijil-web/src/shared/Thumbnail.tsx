import { useEffect, useState } from "react";

/**
 * Vignette de la version courante (lot 5), lue par le BFF puis affichée depuis la mémoire du
 * navigateur ; rien n'est affiché tant qu'elle n'existe pas (traitement en cours ou format sans
 * rendu).
 */
export function Thumbnail({ id, label }: { id: string; label: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let revoked = false;
    let objectUrl: string | null = null;
    void globalThis
      .fetch(`${globalThis.location.origin}/api/documents/${id}/thumbnail`, {
        credentials: "same-origin",
      })
      .then(async (response) => {
        if (!response.ok || revoked) return;
        objectUrl = URL.createObjectURL(await response.blob());
        setUrl(objectUrl);
      })
      .catch(() => undefined);
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);
  if (!url) return null;
  return <img src={url} alt={`Vignette ${label}`} className="size-16 object-contain" />;
}
