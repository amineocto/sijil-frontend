import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { REVIEWER } from "@/mocks/catalogue-data";
import { renderAt, seriousViolations } from "@/test/render";
import { stub } from "@/test/setup";

describe("Exigences documentaires (L7-04)", () => {
  it("liste les jeux avec leur statut, sans violation axe", async () => {
    const { container } = renderAt("/catalogue/exigences");

    const table = await screen.findByRole("table");
    expect(within(table).getByRole("link", { name: "CREDIT_IMMO_PARTICULIER" })).toHaveAttribute(
      "href",
      "/catalogue/exigences/CREDIT_IMMO_PARTICULIER/versions/1",
    );
    expect(within(table).getByText("Publié")).toBeVisible();
    expect(within(table).getByText("Brouillon")).toBeVisible();
    expect(screen.getByRole("link", { name: "Nouveau jeu d'exigences" })).toBeVisible();
    expect(await seriousViolations(container)).toEqual([]);
  });

  it("crée un brouillon et ouvre son éditeur", async () => {
    const user = userEvent.setup();
    const { router } = renderAt("/catalogue/exigences/nouveau");
    await user.type(await screen.findByLabelText(/Code du jeu/), "pret_auto");
    await user.click(screen.getByRole("button", { name: "Enregistrer le brouillon" }));

    expect(await screen.findByText("Jeu PRET_AUTO, version 1")).toBeVisible();
    expect(router.state.location.pathname).toBe("/catalogue/exigences/PRET_AUTO/versions/1");
  });

  it("refuse une définition qui n'est pas du JSON", async () => {
    const user = userEvent.setup();
    renderAt("/catalogue/exigences/nouveau");
    // Éditable une fois la session chargée (rôle de contributeur).
    await screen.findByRole("button", { name: "Enregistrer le brouillon" });
    const editor = screen.getByLabelText(/Définition/);
    await user.clear(editor);
    await user.type(editor, "pas du json");

    expect(screen.getByText("JSON invalide")).toBeVisible();
    expect(screen.getByRole("button", { name: "Enregistrer le brouillon" })).toBeDisabled();
  });

  it("ne laisse pas publier son propre brouillon, mais un autre réviseur le publie", async () => {
    const user = userEvent.setup();
    stub.session = { ...REVIEWER, user: "contributeur.demo" };
    const first = renderAt("/catalogue/exigences/EER_OUVERTURE/versions/1");
    await user.click(await screen.findByRole("button", { name: "Publier" }));
    expect(await screen.findByText(/n'en est pas rédacteur/)).toBeVisible();
    first.unmount();

    stub.session = REVIEWER;
    renderAt("/catalogue/exigences/EER_OUVERTURE/versions/1");
    await user.click(await screen.findByRole("button", { name: "Publier" }));
    expect(await screen.findByText("Publié")).toBeVisible();
  });

  it("simule la définition affichée pour un dossier de test", async () => {
    const user = userEvent.setup();
    renderAt("/catalogue/exigences/CREDIT_IMMO_PARTICULIER/versions/1");
    expect(await screen.findByLabelText(/Définition/)).toHaveAttribute("readonly");
    await user.type(screen.getByLabelText("Identifiant de la partie 1"), "P0099999");
    await user.click(screen.getByRole("button", { name: "Simuler" }));

    expect(await screen.findByText(/\(simulation\)/)).toBeVisible();
    expect(screen.getByRole("list", { name: "Pièces à demander" })).toHaveTextContent(
      "CIN ou PASSEPORT",
    );
  });
});
