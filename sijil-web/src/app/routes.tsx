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
        path: "recherche/plein-texte",
        lazy: async () => ({
          Component: (await import("@/features/search/SearchPage")).FullTextSearchPage,
        }),
      },
      {
        path: "recherche/completude",
        lazy: async () => ({
          Component: (await import("@/features/search/SearchPage")).CompletenessSearchPage,
        }),
      },
      {
        path: "dossiers/:partyType/:partyId",
        lazy: async () => ({
          Component: (await import("@/features/dossier/DossierPage")).DossierPage,
        }),
      },
      {
        path: "dossiers/:partyType/:partyId/completude",
        lazy: async () => ({
          Component: (await import("@/features/dossier/DossierPage")).DossierCompletenessPage,
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
      // Catalogue des types (ADR 0032 : écrans venus de l'ancien sijil-catalogue-web).
      {
        path: "catalogue",
        lazy: async () => ({
          Component: (await import("@/features/catalogue/types-list/TypesListPage")).TypesListPage,
        }),
      },
      {
        path: "catalogue/types/nouveau",
        lazy: async () => ({
          Component: (await import("@/features/catalogue/draft-editor/NewTypePage")).NewTypePage,
        }),
      },
      {
        path: "catalogue/types/:code",
        lazy: async () => ({
          Component: (await import("@/features/catalogue/type-sheet/TypeSheetPage")).TypeSheetPage,
        }),
      },
      {
        path: "catalogue/types/:code/brouillon",
        lazy: async () => ({
          Component: (await import("@/features/catalogue/draft-editor/EditorPage")).EditorPage,
        }),
      },
      {
        path: "catalogue/types/:code/soumission",
        lazy: async () => ({
          Component: (await import("@/features/catalogue/submission/SubmissionPage"))
            .SubmissionPage,
        }),
      },
      {
        path: "catalogue/exigences",
        lazy: async () => ({
          Component: (await import("@/features/catalogue/requirements/RequirementSetsPage"))
            .RequirementSetsPage,
        }),
      },
      {
        path: "catalogue/exigences/nouveau",
        lazy: async () => ({
          Component: (await import("@/features/catalogue/requirements/RequirementSetEditorPage"))
            .NewRequirementSetPage,
        }),
      },
      {
        path: "catalogue/exigences/:code/versions/:version",
        lazy: async () => ({
          Component: (await import("@/features/catalogue/requirements/RequirementSetEditorPage"))
            .RequirementSetEditorPage,
        }),
      },
      {
        path: "catalogue/dictionnaire",
        lazy: async () => ({
          Component: (await import("@/features/catalogue/dictionary/DictionaryPage"))
            .DictionaryPage,
        }),
      },
      {
        path: "catalogue/partage",
        lazy: async () => ({
          Component: (await import("@/features/catalogue/sharing/SharingPage")).SharingPage,
        }),
      },
      {
        path: "catalogue/revues",
        lazy: async () => ({
          Component: (await import("@/features/catalogue/review/ReviewQueuePage")).ReviewQueuePage,
        }),
      },
      {
        path: "catalogue/types/:code/versions/:version/revue",
        lazy: async () => ({
          Component: (await import("@/features/catalogue/review/ReviewPage")).ReviewPage,
        }),
      },
    ],
  },
];
