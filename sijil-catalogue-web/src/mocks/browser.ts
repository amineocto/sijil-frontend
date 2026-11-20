import { setupWorker } from "msw/browser";
import { REVIEWER, SESSION } from "@/mocks/data";
import { CatalogueStub } from "@/mocks/handlers";

/**
 * Bouchon du BFF dans le navigateur, en développement seulement (`npm run dev`). L'état survit à un
 * rechargement (stockage de session de l'onglet) ; `?demo=reviseur` ou `?demo=contributeur` change
 * d'utilisateur de démonstration, pour jouer les deux rôles du workflow (scénario Playwright).
 */
const STORAGE_KEY = "sijil-catalogue-demo";
const stub = new CatalogueStub();

restore();
const demo = new URLSearchParams(globalThis.location.search).get("demo");
if (demo === "reviseur") stub.session = REVIEWER;
if (demo === "contributeur") stub.session = SESSION;
save();

export const worker = setupWorker(...stub.handlers());
worker.events.on("response:mocked", save);

function restore() {
  try {
    const saved = globalThis.sessionStorage.getItem(STORAGE_KEY);
    if (saved) Object.assign(stub, JSON.parse(saved) as Pick<CatalogueStub, "types" | "session">);
  } catch {
    // Stockage indisponible : état initial.
  }
}

function save() {
  try {
    globalThis.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ types: stub.types, session: stub.session }),
    );
  } catch {
    // Stockage indisponible : l'état reste en mémoire.
  }
}
