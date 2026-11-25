import { useQuery } from "@tanstack/react-query";
import { api, call, type Schemas } from "@/shared/api";

/** Session unique du front : rôles des documents et du catalogue (ADR 0032). */
export type Session = Schemas["Session"];

/**
 * Utilisateur connecté au BFF (OIDC, session serveur). Affichage seulement : chaque API
 * (`sijil-api`, `sijil-catalogue`) décide des droits sur le jeton échangé (ADR 0011).
 */
export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: () => call(api.GET("/api/session")),
    staleTime: Infinity,
  });
}

/** Contributeur du parcours propriétaire : seul à modifier un document Sijil. */
export function canContribute(session: Session | undefined, parcours?: string): boolean {
  if (!session?.roles.includes("sijil-contributeur")) return false;
  return parcours === undefined || session.parcours.includes(parcours);
}

/** Bris de glace : rôle dédié (ADR 0011) ; le champ du motif n'est montré qu'à ce rôle. */
export function canBreakGlass(session: Session | undefined): boolean {
  return session?.roles.includes("sijil-bris-de-glace") ?? false;
}

/** Accès aux écrans du catalogue : au moins un rôle du catalogue. */
export function canSeeCatalogue(session: Session | undefined): boolean {
  return session?.roles.some((role) => role.startsWith("catalogue-")) ?? false;
}

/** Rédaction d'un type du catalogue pour un parcours (ou pour l'un d'eux si absent). */
export function canContributeToCatalogue(session: Session | undefined, parcours?: string): boolean {
  if (!session?.roles.includes("catalogue-contributeur")) return false;
  return parcours === undefined || session.parcours.includes(parcours);
}

/** Administration du partage des types de son parcours (ADR 0025). */
export function canAdministerSharing(session: Session | undefined): boolean {
  return session?.roles.includes("catalogue-admin-domaine") ?? false;
}

/** Tenue du dictionnaire de métadonnées (ADR 0038). */
export function canGovernDictionary(session: Session | undefined): boolean {
  return session?.roles.includes("catalogue-data-office") ?? false;
}

export function canReview(session: Session | undefined): boolean {
  return session?.roles.includes("catalogue-reviseur") ?? false;
}
