import { setupWorker } from "msw/browser";
import { READER } from "@/mocks/data";
import { SijilStub } from "@/mocks/handlers";

/**
 * Bouchon du BFF dans le navigateur, en développement seulement (`npm run dev`). L'état survit à un
 * rechargement (stockage de session de l'onglet) ; `?demo=lecteur` change d'utilisateur.
 */
const STORAGE_KEY = "sijil-web-demo";
const stub = new SijilStub();

restore();
if (new URLSearchParams(globalThis.location.search).get("demo") === "lecteur")
  stub.session = READER;
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
    const { session, documents, revisions, pending, deleted } = stub;
    globalThis.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ session, documents, revisions, pending, deleted }),
    );
  } catch {
    // Stockage indisponible : l'état reste en mémoire.
  }
}
