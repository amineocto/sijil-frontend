export const STATUS_LABELS: Record<string, string> = {
  EN_QUARANTAINE: "En contrôle",
  ACTIF: "Actif",
  REJETE_TECHNIQUE: "Rejeté au contrôle",
  SUPPRIME_LOGIQUE: "Supprimé",
  RETENTION_ECHUE: "Rétention échue",
};

export const SENSITIVITY_LABELS: Record<string, string> = {
  STANDARD: "Standard",
  SENSIBLE: "Sensible",
  RESTREINT: "Restreint",
};

export const PARTY_TYPE_LABELS: Record<string, string> = {
  CLIENT: "Client",
  PERSONNE: "Personne",
  COMPTE: "Compte",
};

export const PARTY_ROLE_LABELS: Record<string, string> = {
  TITULAIRE: "Titulaire",
  CO_TITULAIRE: "Co-titulaire",
  GARANT: "Garant",
  MANDATAIRE: "Mandataire",
  REPRESENTANT_LEGAL: "Représentant légal",
  AUTRE: "Autre",
};

/** Choix du type de partie, dans l'ordre des libellés. */
export const PARTY_OPTIONS = Object.entries(PARTY_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR");
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}
