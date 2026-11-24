import { useSyncExternalStore } from "react";

/** Points de rupture du poste CRC : menu en tiroir sous 1024 px, cartes au lieu des tableaux sous 768 px. */
export const NARROW = "(max-width: 767px)";
export const COMPACT = "(max-width: 1023px)";

/**
 * Vrai quand la requête média s'applique. On rend une seule version (tableau ou cartes, menu ou
 * tiroir) plutôt que deux versions masquées en CSS : les lecteurs d'écran n'en voient qu'une.
 */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const list = globalThis.matchMedia(query);
      list.addEventListener("change", notify);
      return () => {
        list.removeEventListener("change", notify);
      };
    },
    () => globalThis.matchMedia(query).matches,
    () => false,
  );
}
