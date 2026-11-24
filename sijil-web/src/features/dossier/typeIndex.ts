import { useQuery } from "@tanstack/react-query";
import type { TypeInfo } from "@/features/dossier/dossier";
import { api, call } from "@/shared/api";

/** Pages de types lues au plus. */
const MAX_PAGES = 10;

/** Libellé et famille de chaque type du catalogue ; vide si le catalogue n'est pas lisible. */
export function useTypeIndex(): Record<string, TypeInfo> {
  const types = useQuery({
    queryKey: ["type-index"],
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async () => {
      const index: Record<string, TypeInfo> = {};
      let cursor: string | undefined;
      for (let i = 0; i < MAX_PAGES; i++) {
        const page = await call(
          api.GET("/api/types", { params: { query: cursor ? { cursor } : {} } }),
        );
        for (const t of page.items) index[t.code] = { label: t.label, family: t.family };
        if (!page.hasMore || !page.nextCursor) break;
        cursor = page.nextCursor;
      }
      return index;
    },
  });
  return types.data ?? {};
}
