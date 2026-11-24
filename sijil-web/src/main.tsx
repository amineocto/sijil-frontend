import "@/app/app.css";
import "@awb/ui/styles.css";
import "@sijil/ui-kit/theme.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { applyLanguage } from "@sijil/ui-kit";
import { createQueryClient, Providers } from "@/app/Providers";
import { routes } from "@/app/routes";

async function start() {
  // En développement, sans BFF, les données de démonstration sont servies par MSW.
  if (import.meta.env.DEV && import.meta.env["VITE_MOCKS"] !== "false") {
    const { worker } = await import("@/mocks/browser");
    await worker.start({ onUnhandledFrame: "bypass" });
  }
  applyLanguage("fr");
  const root = document.getElementById("root");
  if (!root) throw new Error("élément #root absent");
  createRoot(root).render(
    <StrictMode>
      <Providers client={createQueryClient()}>
        <RouterProvider router={createBrowserRouter(routes)} />
      </Providers>
    </StrictMode>,
  );
}

void start();
