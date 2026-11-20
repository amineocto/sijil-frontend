import { useQuery } from "@tanstack/react-query";
import { api, call } from "@/shared/api";

export interface Session {
  user: string;
  profil?: string | null;
  parcours?: string | null;
  roles: ("sijil-lecteur" | "sijil-contributeur" | "sijil-admin")[];
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
