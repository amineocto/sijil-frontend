import type { RouteObject } from "react-router";
import { Layout } from "@/app/Layout";

/** Routes déclaratives, une page chargée à la demande par écran (09-fronts.md). */
export const routes: RouteObject[] = [
  {
    path: "/",
    element: <Layout />,
    children: [
      {
        index: true,
        lazy: async () => ({
          Component: (await import("@/features/types-list/TypesListPage")).TypesListPage,
        }),
      },
      {
        path: "types/nouveau",
        lazy: async () => ({
          Component: (await import("@/features/draft-editor/NewTypePage")).NewTypePage,
        }),
      },
      {
        path: "types/:code",
        lazy: async () => ({
          Component: (await import("@/features/type-sheet/TypeSheetPage")).TypeSheetPage,
        }),
      },
      {
        path: "types/:code/brouillon",
        lazy: async () => ({
          Component: (await import("@/features/draft-editor/EditorPage")).EditorPage,
        }),
      },
      {
        path: "types/:code/soumission",
        lazy: async () => ({
          Component: (await import("@/features/submission/SubmissionPage")).SubmissionPage,
        }),
      },
      {
        path: "revues",
        lazy: async () => ({
          Component: (await import("@/features/review/ReviewQueuePage")).ReviewQueuePage,
        }),
      },
      {
        path: "types/:code/versions/:version/revue",
        lazy: async () => ({
          Component: (await import("@/features/review/ReviewPage")).ReviewPage,
        }),
      },
    ],
  },
];
