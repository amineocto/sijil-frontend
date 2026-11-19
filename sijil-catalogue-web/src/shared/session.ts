import { useQuery } from "@tanstack/react-query";
import { api, call, type Schemas } from "@/shared/api";

export type Session = Schemas["Session"];

/**
 * Session de l'utilisateur. PROVISOIRE : `GET /api/session` simule l'authentification en
 * attendant le BFF (L3-08) et le mécanisme d'identité de l'ADR 0011.
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
