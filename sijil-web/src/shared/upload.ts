/** Empreinte SHA-256 du fichier, en hexadécimal, annoncée à l'ouverture de la session. */
export async function sha256(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Envoi direct du fichier vers la quarantaine, par l'URL présignée de la session (un objet, 5
 * minutes), avec les en-têtes signés ; la progression est rapportée de 0 à 100.
 */
export function putFile(
  url: string,
  headers: Record<string, string>,
  file: Blob,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    for (const [name, value] of Object.entries(headers)) {
      // Le navigateur pose lui-même la longueur.
      if (name.toLowerCase() !== "content-length") request.setRequestHeader(name, value);
    }
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
      } else reject(new Error(`Envoi refusé par le stockage (${String(request.status)}).`));
    };
    request.onerror = () => {
      reject(new Error("Envoi interrompu : vérifiez la connexion et réessayez."));
    };
    request.send(file);
  });
}
