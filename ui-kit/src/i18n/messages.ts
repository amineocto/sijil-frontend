/** Textes par défaut (français). Chaque composant accepte des textes de remplacement (i18n). */
export const messages = {
  loading: "Chargement…",
  emptyTitle: "Aucun élément",
  errorTitle: "Une erreur est survenue",
  errorRetry: "Réessayer",
  correlationLabel: "Référence de l'incident",
  networkError: "Le service est injoignable. Vérifiez votre connexion puis réessayez.",
  unexpectedError: "Une erreur inattendue est survenue.",
} as const;

export type Messages = typeof messages;
