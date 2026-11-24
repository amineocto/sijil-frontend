import { setupWorker } from "msw/browser";
import { DOMAIN_ADMIN, REVIEWER, SESSION } from "@/mocks/catalogue-data";
import { READER } from "@/mocks/data";
import { SijilStub } from "@/mocks/handlers";

/**
 * Bouchon du BFF dans le navigateur, en développement seulement (`npm run dev`). L'état survit à un
 * rechargement (stockage de session de l'onglet) ; `?demo=lecteur`, `?demo=reviseur` ou
 * `?demo=contributeur` ou `?demo=admin-domaine` change d'utilisateur de démonstration.
 */
const STORAGE_KEY = "sijil-web-demo";
const stub = new SijilStub();

restore();
const demo = new URLSearchParams(globalThis.location.search).get("demo");
if (demo === "lecteur") stub.session = READER;
if (demo === "reviseur") stub.session = REVIEWER;
if (demo === "contributeur") stub.session = SESSION;
if (demo === "admin-domaine") stub.session = DOMAIN_ADMIN;
save();

export const worker = setupWorker(...stub.handlers());
worker.events.on("response:mocked", save);

function restore() {
  try {
    const saved = globalThis.sessionStorage.getItem(STORAGE_KEY);
    if (saved) Object.assign(stub, JSON.parse(saved) as Partial<SijilStub>);
  } catch {
    // Stockage indisponible : état initial.
  }
}

function save() {
  try {
    const { session, documents, revisions, pending, deleted, types } = stub;
    globalThis.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ session, documents, revisions, pending, deleted, types }),
    );
  } catch {
    // Stockage indisponible : l'état reste en mémoire.
  }
}
