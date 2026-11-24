import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderAt, seriousViolations } from "@/test/render";

describe("Recherche", () => {
  it("ouvre le dossier de la partie saisie, sans violation axe", async () => {
    const { container, router } = renderAt("/");
    const user = userEvent.setup();

    const form = await screen.findByRole("form", {
      name: "Ouvrir un dossier depuis la recherche",
    });
    expect(await seriousViolations(container)).toEqual([]);
    await user.selectOptions(within(form).getByRole("combobox", { name: "Partie" }), "COMPTE");
    await user.type(within(form).getByRole("textbox", { name: /Identifiant/ }), " CPT 7 ");
    await user.click(within(form).getByRole("button", { name: "Ouvrir le dossier" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/dossiers/compte/CPT%207");
    });
  });

  it("garde la recherche de dossier dans l'en-tête de chaque écran", async () => {
    const { router } = renderAt("/catalogue");
    const user = userEvent.setup();
    const header = await screen.findByRole("search", { name: "Ouvrir un dossier" });
    await user.type(header.querySelector("input") as HTMLInputElement, "CLI-42{Enter}");
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/dossiers/client/CLI-42");
    });
  });

  it("propose les dossiers récemment ouverts", async () => {
    localStorage.setItem(
      "sijil-dossiers-recents",
      JSON.stringify([{ type: "CLIENT", id: "C123456", openedAt: "2026-11-24T09:00:00Z" }]),
    );
    renderAt("/");
    const recents = await screen.findByRole("region", { name: "Dossiers récemment ouverts" });
    expect(within(recents).getByRole("link", { name: /Client C123456/ })).toHaveAttribute(
      "href",
      "/dossiers/client/C123456",
    );
    localStorage.clear();
  });
});
