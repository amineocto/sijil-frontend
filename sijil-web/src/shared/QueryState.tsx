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
  /** Rendu à la place de l'erreur quand la ressource n'existe pas (404). */
  notFound?: ReactNode;
}

/** États « chargement » et « erreur » communs ; l'écran rend lui-même « vide » et « données ». */
export function QueryState<T>({ query, children, notFound }: QueryStateProps<T>) {
  if (query.isPending) return <LoadingState />;
  if (notFound !== undefined && isApiError(query.error) && query.error.status === 404) {
    return <>{notFound}</>;
  }
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
