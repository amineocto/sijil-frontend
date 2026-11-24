import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";
import { SijilStub } from "@/mocks/handlers";

// Les findBy* attendent 1 s par défaut : trop court quand la CI tourne sur une machine chargée
// (échecs intermittents constatés le 2026-11-21, charge moyenne ~30). Le délai d'un test reste
// borné par testTimeout.
configure({ asyncUtilTimeout: 5000 });

/** Bouchon du BFF partagé par les tests, remis à zéro après chacun. */
export const stub = new SijilStub();
export const server = setupServer(...stub.handlers());

// API du navigateur absentes de jsdom, utilisées par les composants.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});
class NoResizeObserver {
  observe() {
    return undefined;
  }
  unobserve() {
    return undefined;
  }
  disconnect() {
    return undefined;
  }
}
window.ResizeObserver = NoResizeObserver;
Element.prototype.scrollIntoView = () => undefined;
Object.defineProperty(document, "fonts", {
  value: { addEventListener: () => undefined, removeEventListener: () => undefined },
});

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
  stub.reset();
});
afterAll(() => {
  server.close();
});
