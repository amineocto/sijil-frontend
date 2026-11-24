import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderAt, seriousViolations } from "@/test/render";

async function openPanel() {
  const user = userEvent.setup();
  const view = renderAt("/");
  await user.click(await screen.findByRole("link", { name: "Complétude" }));
  await user.selectOptions(
    await screen.findByRole("combobox", { name: "Jeu d'exigences" }),
    await screen.findByRole("option", { name: /Crédit immobilier particulier/ }),
  );
  await user.type(screen.getByLabelText("Identifiant de la partie 1"), "P0012345");
  return { user, ...view };
}

describe("Panneau complétude (L7-05)", () => {
  it("évalue un jeu publié pour le titulaire, sans violation axe", async () => {
    const { user, container } = await openPanel();
    await user.click(screen.getByRole("button", { name: "Évaluer la complétude" }));

    const table = await screen.findByRole("table", { name: "État des exigences" });
    expect(within(table).getByText("Satisfaite")).toBeVisible();
    expect(within(table).getByText(/CIN \(10\/03\/2031\)/)).toBeVisible();
    expect(screen.getByText("Aucune pièce à demander.")).toBeVisible();
    expect(screen.getByText(/Dossier complet/)).toBeVisible();
    expect(await seriousViolations(container)).toEqual([]);
  });

  it("liste la pièce à demander quand la CIN est expirée à la date", async () => {
    const { user } = await openPanel();
    await user.type(screen.getByLabelText(/Date d'évaluation/), "2032-01-01");
    await user.click(screen.getByRole("button", { name: "Évaluer la complétude" }));

    expect(await screen.findByText("Expirée")).toBeVisible();
    const toAsk = screen.getByRole("list", { name: "Pièces à demander" });
    expect(toAsk).toHaveTextContent("CIN ou PASSEPORT");
    expect(screen.getByText(/Dossier incomplet/)).toBeVisible();
  });
});
