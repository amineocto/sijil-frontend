/**
 * Finalité (ADR 0018) et motif de bris de glace saisis par l'utilisateur, relayés en en-têtes au
 * BFF : jamais dans l'adresse (journaux, historique du navigateur).
 */
export interface Access {
  purpose?: string;
  breakGlassReason?: string;
}

export function accessHeaders(access: Access): Record<string, string> {
  const headers: Record<string, string> = {};
  if (access.purpose?.trim()) headers["X-Access-Purpose"] = access.purpose.trim();
  if (access.breakGlassReason?.trim())
    headers["X-Break-Glass-Reason"] = access.breakGlassReason.trim();
  return headers;
}
