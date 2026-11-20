import { useQuery } from "@tanstack/react-query";
import { api, call } from "@/shared/api";

export interface Session {
  user: string;
  profil?: string | null;
  parcours?: string | null;
  roles: ("sijil-lecteur" | "sijil-contributeur" | "sijil-admin" | "sijil-bris-de-glace")[];
}

/**
 * Utilisateur connecté au BFF (OIDC, session serveur). Affichage seulement : `sijil-api` décide des
 * droits sur le jeton échangé (ADR 0011).
 */
export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: () => call(api.GET("/api/session")) as Promise<Session>,
    staleTime: Infinity,
  });
}

/** Contributeur du parcours propriétaire : seul à modifier un document Sijil. */
export function canContribute(session: Session | undefined, parcours?: string): boolean {
  if (!session?.roles.includes("sijil-contributeur")) return false;
  return parcours === undefined || session.parcours === parcours;
}

/** Bris de glace : rôle dédié (ADR 0011) ; le champ du motif n'est montré qu'à ce rôle. */
export function canBreakGlass(session: Session | undefined): boolean {
  return session?.roles.includes("sijil-bris-de-glace") ?? false;
}
