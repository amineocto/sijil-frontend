import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderAt, seriousViolations } from "@/test/render";

describe("Recherche", () => {
  it("ouvre le dossier de la partie saisie, sans violation axe", async () => {
    const { container, router } = renderAt("/");
    const user = userEvent.setup();

    const form = await screen.findByRole("search", {
      name: "Ouvrir un dossier depuis la recherche",
    });
    expect(await seriousViolations(container)).toEqual([]);
    await user.selectOptions(form.querySelector("select") as HTMLSelectElement, "COMPTE");
    await user.type(form.querySelector("input") as HTMLInputElement, " CPT 7 {Enter}");

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
});
