import { setupWorker } from "msw/browser";
import { CatalogueStub } from "@/mocks/handlers";

/** Bouchon du BFF dans le navigateur, en développement seulement (`npm run dev`). */
export const worker = setupWorker(...new CatalogueStub().handlers());
