import { render } from "@testing-library/react";
import axe from "axe-core";
import { createMemoryRouter, RouterProvider } from "react-router";
import { createQueryClient, Providers } from "@/app/Providers";
import { routes } from "@/app/routes";

/** Rend l'application complète (routes, fournisseurs) à une adresse donnée. */
export function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const view = render(
    <Providers client={createQueryClient()}>
      <RouterProvider router={router} />
    </Providers>,
  );
  return { ...view, router };
}

/**
 * Violations axe sérieuses ou critiques (09-fronts.md). Le contraste n'est pas mesurable dans
 * jsdom : il est vérifié sur les jetons du thème (`ui-kit`, theme.test.ts).
 */
export async function seriousViolations(container: HTMLElement): Promise<string[]> {
  const results = await axe.run(container, {
    rules: { "color-contrast": { enabled: false } },
    // Le contenu d'un aperçu (PDF dans une iframe) n'est pas une page de l'application, et jsdom
    // ne sait pas y entrer ; la page qui l'entoure reste analysée.
    iframes: false,
  });
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} : ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}
