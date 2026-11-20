import { api, call } from "@/shared/api";
import type { TypeVersion, UploadSession } from "@/shared/types";
import { putFile, sha256 } from "@/shared/upload";

/**
 * Ouvre une session de dépôt pour ce fichier (type, canal, format, taille, empreinte) puis l'envoie
 * directement vers la quarantaine ; rend l'identifiant de la session à finaliser.
 */
export async function sendFile(
  type: TypeVersion,
  file: File,
  onProgress: (percent: number) => void,
): Promise<string> {
  const session = (await call(
    api.POST("/api/upload-sessions", {
      params: { header: { "Idempotency-Key": crypto.randomUUID() } },
      body: {
        documentType: type.code,
        channel: type.definition.origins?.channels?.[0] ?? "AGENCE",
        mediaType: file.type,
        size: file.size,
        sha256: await sha256(file),
      },
    }),
  )) as unknown as UploadSession;
  await putFile(session.upload.url, session.upload.headers, file, onProgress);
  return session.id;
}
