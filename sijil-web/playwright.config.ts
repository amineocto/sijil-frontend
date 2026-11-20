import { defineConfig, devices } from "@playwright/test";

const PORT = 5176;

/**
 * Scénario de bout en bout du front (L4E-05) sur le serveur de développement et les bouchons MSW du
 * BFF. L'essai avec le BFF réel et Keycloak est une validation de niveau B (B-015, B-021).
 */
export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${String(PORT)}`,
    locale: "fr-FR",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx vite --port ${String(PORT)} --strictPort`,
    url: `http://localhost:${String(PORT)}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
