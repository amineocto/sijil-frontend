import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderAt, seriousViolations } from "@/test/render";
import { stub } from "@/test/setup";

describe("Nouveau type", () => {
  it("crée la version 1 en brouillon puis ouvre l'éditeur", async () => {
    const user = userEvent.setup();
    const { container, router } = renderAt("/catalogue/types/nouveau");
    await user.type(await screen.findByLabelText(/Code/), "PASSEPORT");
    await user.type(screen.getByLabelText(/Libellé français/), "Passeport");
    expect(await seriousViolations(container)).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Créer le brouillon" }));

    await screen.findByRole("heading", { name: "Brouillon du type PASSEPORT" });
    expect(router.state.location.pathname).toBe("/catalogue/types/PASSEPORT/brouillon");
    expect(stub.types.find((t) => t.code === "PASSEPORT")?.ownerParcours).toBe("eer");
  });

  it("refuse un code mal formé ou déjà pris", async () => {
    const user = userEvent.setup();
    renderAt("/catalogue/types/nouveau");
    const code = await screen.findByLabelText(/Code/);
    await user.type(code, "cin");
    await user.type(screen.getByLabelText(/Libellé français/), "Carte");
    await user.click(screen.getByRole("button", { name: "Créer le brouillon" }));
    expect(await screen.findByText(/commence par une lettre/)).toBeVisible();

    await user.clear(code);
    await user.type(code, "CIN");
    await user.click(screen.getByRole("button", { name: "Créer le brouillon" }));
    expect(await screen.findByText("Ce code existe déjà")).toBeVisible();
  });

  it("affiche le refus du serveur", async () => {
    const user = userEvent.setup();
    stub.session = { ...stub.session, parcours: ["eer", "autre"] };
    renderAt("/catalogue/types/nouveau");
    await user.type(await screen.findByLabelText(/Code/), "NOUVEAU");
    await user.selectOptions(screen.getByLabelText("Parcours référent"), "autre");
    await user.type(screen.getByLabelText(/Libellé français/), "Nouveau");
    stub.session = { ...stub.session, parcours: ["eer"] };
    await user.click(screen.getByRole("button", { name: "Créer le brouillon" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Accès refusé");
  });
});
