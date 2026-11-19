import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";
import { CatalogueStub } from "@/mocks/handlers";

/** Bouchon du BFF partagé par les tests, remis à zéro après chacun. */
export const stub = new CatalogueStub();
export const server = setupServer(...stub.handlers());

// Mantine s'appuie sur ces API, absentes de jsdom.
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
