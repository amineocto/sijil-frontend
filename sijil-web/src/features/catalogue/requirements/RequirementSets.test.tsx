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
    await user.type(screen.getByLabelText(/Libellé du jeu/), "Prêt automobile");
    await user.click(screen.getByRole("button", { name: "Enregistrer le brouillon" }));

    expect(await screen.findByText("Jeu PRET_AUTO, version 1")).toBeVisible();
    expect(router.state.location.pathname).toBe("/catalogue/exigences/PRET_AUTO/versions/1");
  });

  it("décrit les exigences dans un formulaire et signale ce qui manque", async () => {
    const user = userEvent.setup();
    renderAt("/catalogue/exigences/nouveau");
    await user.type(await screen.findByLabelText(/Code du jeu/), "pret_auto");
    await user.click(screen.getByRole("button", { name: "Ajouter une exigence" }));
    const card = screen.getByRole("region", { name: "Exigence 2" });
    await user.click(screen.getByRole("button", { name: "Enregistrer le brouillon" }));

    expect(screen.getByLabelText(/Libellé du jeu/)).toHaveAccessibleDescription(
      expect.stringContaining("Au moins 3 caractères"),
    );
    expect(within(card).getByText("Choisissez au moins un type")).toBeVisible();

    await user.type(screen.getByLabelText(/Libellé du jeu/), "Prêt automobile");
    await user.type(within(card).getByLabelText("Libellé"), "Relevé d'identité bancaire");
    const filled = screen.getByRole("region", { name: "Relevé d'identité bancaire" });
    expect(within(filled).getByLabelText(/Identifiant/)).toHaveValue("releve-d-identite-bancaire");
    await user.selectOptions(within(filled).getByLabelText(/Types de document acceptés/), "RIB");
    await user.selectOptions(within(filled).getByLabelText("Fraîcheur"), "PERIOD");
    await user.click(screen.getByRole("button", { name: "Enregistrer le brouillon" }));

    await screen.findByText("Jeu PRET_AUTO, version 1");
    expect(stub.requirementSets.find((r) => r.code === "PRET_AUTO")?.definition).toEqual({
      label: "Prêt automobile",
      requirements: [
        {
          id: "piece-d-identite",
          label: "Pièce d'identité",
          anyOf: ["CIN", "PASSEPORT"],
          for: { roles: ["TITULAIRE"] },
          freshness: "VALID_ON_DATE",
          minAssurance: "CONTROLE_AUTO",
        },
        {
          id: "releve-d-identite-bancaire",
          label: "Relevé d'identité bancaire",
          anyOf: ["RIB"],
          freshness: "P3M",
        },
      ],
    });
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
    expect(await screen.findByLabelText(/Libellé du jeu/)).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Ajouter une exigence" })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Identifiant de la partie 1"), "P0099999");
    await user.click(screen.getByRole("button", { name: "Simuler" }));

    expect(await screen.findByText(/\(simulation\)/)).toBeVisible();
    expect(screen.getByRole("list", { name: "Pièces à demander" })).toHaveTextContent(
      "CIN ou PASSEPORT",
    );
  });
});
