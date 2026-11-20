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
          Component: (await import("@/features/search/SearchPage")).SearchPage,
        }),
      },
      {
        path: "recherche",
        lazy: async () => ({
          Component: (await import("@/features/search/SearchPage")).SearchPage,
        }),
      },
      {
        path: "depot",
        lazy: async () => ({
          Component: (await import("@/features/deposit/DepositPage")).DepositPage,
        }),
      },
      {
        path: "documents/:id",
        lazy: async () => ({
          Component: (await import("@/features/document/DocumentPage")).DocumentPage,
        }),
      },
    ],
  },
];
