import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // `public/` ne contient que le service worker des bouchons MSW : jamais livré en production.
  publicDir: command === "serve" ? "public" : false,
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    // Bouchons MSW par défaut ; avec VITE_MOCKS=false, tout passe par le BFF local (même origine
    // vue du navigateur : cookie de session, CSRF, redirections OIDC).
    port: 5173,
    proxy:
      process.env["VITE_MOCKS"] === "false"
        ? Object.fromEntries(
            ["/api", "/oauth2", "/login", "/logout"].map((path) => [
              path,
              { target: process.env["CATALOGUE_BFF_URL"] ?? "http://localhost:8083", xfwd: true },
            ]),
          )
        : {},
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
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
