import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { awbStylesheetFonts } from "./src/app/theme";

export default defineConfig(({ command }) => ({
  plugins: [awbStylesheetFonts(), tailwindcss(), react()],
  // `public/` ne contient que le service worker des bouchons MSW : jamais livré en production.
  publicDir: command === "serve" ? "public" : false,
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Logo de la charte, livré par @awb/ui hors de ses exports.
      "@awb-logo": fileURLToPath(
        new URL("../../node_modules/@awb/ui/dist/awb-logo.svg", import.meta.url),
      ),
    },
  },
  // Écrans chargés à la demande analysés dès le démarrage : sans cela, Vite découvre leurs
  // dépendances (formulaires du catalogue) en cours de navigation et recharge la page.
  optimizeDeps: { entries: ["index.html", "src/**/!(*.test).tsx"] },
  server: {
    // Bouchons MSW par défaut ; avec VITE_MOCKS=false, tout passe par le BFF local (même origine
    // vue du navigateur : cookie de session, CSRF, redirections OIDC).
    port: 5174,
    proxy:
      process.env["VITE_MOCKS"] === "false"
        ? Object.fromEntries(
            ["/api", "/oauth2", "/login", "/logout"].map((path) => [
              path,
              { target: process.env["SIJIL_BFF_URL"] ?? "http://localhost:8082", xfwd: true },
            ]),
          )
        : {},
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // La visite guidée ne s'ouvre pas d'elle-même pendant les tests (src/features/tour).
    env: { VITE_TOUR_AUTOSTART: "false" },
    testTimeout: 15000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/test/**",
        "src/main.tsx",
        "src/mocks/browser.ts",
        "src/api/schema.d.ts",
      ],
      thresholds: { lines: 80, branches: 80, functions: 80, statements: 80 },
    },
  },
}));
