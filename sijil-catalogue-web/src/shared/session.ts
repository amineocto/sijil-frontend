import { useQuery } from "@tanstack/react-query";
import { api, call, type Schemas } from "@/shared/api";

export type Session = Schemas["Session"];

/**
 * Utilisateur connecté au BFF (OIDC, session serveur). Affichage seulement : le catalogue décide
 * des droits sur le jeton échangé (ADR 0011).
 */
export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: () => call(api.GET("/api/session")),
    staleTime: Infinity,
  });
}

export function canContribute(session: Session | undefined, parcours?: string): boolean {
  if (!session?.roles.includes("catalogue-contributeur")) return false;
  return parcours === undefined || session.parcours.includes(parcours);
}

export function canReview(session: Session | undefined): boolean {
  return session?.roles.includes("catalogue-reviseur") ?? false;
}
