import { createRequire } from "node:module";
import { expect, test, type Page } from "@playwright/test";

const AXE = createRequire(import.meta.url).resolve("axe-core/axe.min.js");

/** Violations axe sérieuses ou critiques de la page, contraste compris (vrai navigateur). */
async function seriousViolations(page: Page): Promise<string[]> {
  await page.addScriptTag({ path: AXE });
  return page.evaluate(async () => {
    const results = await (
      window as unknown as {
        axe: {
          run: () => Promise<{
            violations: {
              id: string;
              impact: string | null;
              nodes: { target: string[]; failureSummary?: string }[];
            }[];
          }>;
        };
      }
    ).axe.run();
    return results.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map(
        (v) =>
          `${v.id} : ${v.nodes.map((n) => `${n.target.join(" ")} (${n.failureSummary ?? ""})`).join(" | ")}`,
      );
  });
}

test("un contributeur dépose un document, qui passe la quarantaine et se retrouve dans la recherche", async ({
  page,
}) => {
  await page.goto("/depot");
  await page
    .getByRole("combobox", { name: "Type de document" })
    .selectOption({ label: "Carte d'identité nationale" });
  await page.getByRole("textbox", { name: /Numéro/ }).fill("EE778899");
  await page.getByRole("textbox", { name: /Identifiant du titulaire/ }).fill("CLI-77");
  await page.locator('input[type="file"]').setInputFiles({
    name: "cin.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.7 carte"),
  });
  expect(await seriousViolations(page)).toEqual([]);
  await page.getByRole("button", { name: "Déposer" }).click();

  // Quarantaine puis admission (suivi de réception).
  await expect(page.getByRole("status")).toContainText("En contrôle");
  await page.getByRole("link", { name: "Ouvrir le document" }).click();
  await expect(page.getByRole("table", { name: "Métadonnées" })).toContainText("EE778899");
  expect(await seriousViolations(page)).toEqual([]);

  // Le document est trouvé par son titulaire.
  await page.getByRole("link", { name: "Recherche" }).click();
  await page
    .getByRole("textbox", { name: /Identifiant/ })
    .first()
    .fill("CLI-77");
  await page.getByRole("button", { name: "Rechercher" }).click();
  await expect(page.getByRole("table", { name: "Documents trouvés" })).toContainText("CIN");
  expect(await seriousViolations(page)).toEqual([]);
});
