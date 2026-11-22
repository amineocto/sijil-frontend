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

test("un contributeur rédige et soumet, un réviseur approuve, le type est publié", async ({
  page,
}) => {
  // Contributeur du parcours eer : brouillon, enregistrement, soumission.
  await page.goto("/catalogue/types/CIN?demo=contributeur");
  await page.getByRole("link", { name: "Modifier le brouillon" }).click();
  const label = page.getByLabel(/Libellé français/);
  await label.fill("Carte nationale d'identité électronique");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("status")).toContainText("Brouillon enregistré");
  expect(await seriousViolations(page)).toEqual([]);

  await page.goto("/catalogue/types/CIN/soumission");
  await page.getByRole("button", { name: "Lancer les contrôles et soumettre" }).click();
  await expect(page.getByRole("status")).toContainText("En revue");
  await expect(page.getByRole("link", { name: "File de revue" })).toHaveCount(0);

  // Réviseur : file de revue, différences, approbation à la date du jour.
  await page.goto("/catalogue/revues?demo=reviseur");
  await page.getByRole("link", { name: "CIN v2" }).click();
  await expect(page.getByRole("region", { name: "Rubrique labels" })).toContainText(
    "Carte nationale d'identité électronique",
  );
  expect(await seriousViolations(page)).toEqual([]);
  await page.getByRole("button", { name: "Enregistrer la revue" }).click();
  await expect(page.getByRole("status")).toContainText("Publié");

  // Le type est publié : il quitte la file de revue, la v2 est la version publiée.
  await page.getByRole("link", { name: "Retour à la file de revue" }).click();
  await expect(page.getByRole("link", { name: "ATTESTATION_SALAIRE v2" })).toBeVisible();
  await expect(page.getByRole("link", { name: "CIN v2" })).toHaveCount(0);
  await page.goto("/catalogue/types/CIN");
  const latest = page.getByRole("row").nth(1);
  await expect(latest).toContainText("v2");
  await expect(latest).toContainText("Publié");
  expect(await seriousViolations(page)).toEqual([]);
});
