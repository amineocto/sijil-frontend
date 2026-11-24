import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderAt, seriousViolations } from "@/test/render";

describe("Menu latéral", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("se replie en icônes, garde ses noms accessibles et mémorise le choix", async () => {
    const first = renderAt("/");
    const user = userEvent.setup();
    const toggle = await screen.findByRole("button", { name: "Réduire le menu" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Consulter")).toBeInTheDocument();

    await user.click(toggle);
    const expand = screen.getByRole("button", { name: "Déplier le menu" });
    expect(expand).toHaveAttribute("aria-expanded", "false");
    expect(expand).toHaveAttribute("aria-controls", "menu-principal");
    expect(screen.queryByText("Consulter")).not.toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Navigation principale" });
    expect(nav).toContainElement(screen.getByRole("link", { name: "Déposer un document" }));
    expect(screen.getByRole("link", { name: "Catalogue" })).toHaveAttribute("title", "Catalogue");
    expect(await seriousViolations(first.container)).toEqual([]);
    first.unmount();

    renderAt("/");
    expect(await screen.findByRole("button", { name: "Déplier le menu" })).toBeInTheDocument();
  });
});
