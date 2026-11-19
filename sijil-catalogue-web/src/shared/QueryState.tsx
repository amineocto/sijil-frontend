import type { ReactNode } from "react";
import { ErrorState, LoadingState } from "@sijil/ui-kit";
import { isApiError } from "@/shared/api";

interface QueryStateProps<T> {
  query: {
    data: T | undefined;
    error: unknown;
    isPending: boolean;
    refetch: () => unknown;
  };
  children: (data: T) => ReactNode;
}

/** États « chargement » et « erreur » communs ; l'écran rend lui-même « vide » et « données ». */
export function QueryState<T>({ query, children }: QueryStateProps<T>) {
  if (query.isPending) return <LoadingState />;
  if (query.error || query.data === undefined) {
    const error = isApiError(query.error)
      ? query.error
      : {
          message: "Une erreur inattendue est survenue.",
          correlationId: undefined,
        };
    return <ErrorState error={error} onRetry={() => void query.refetch()} />;
  }
  return <>{children(query.data)}</>;
}
