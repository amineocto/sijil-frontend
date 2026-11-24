import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderAt, seriousViolations } from "@/test/render";

/** Fait passer l'écran sous `below` px : les requêtes `max-width` d'au moins cette valeur s'appliquent. */
function narrowScreen(below: number) {
  const spy = vi.spyOn(window, "matchMedia").mockImplementation((query: string) => {
    const max = /max-width: (\d+)px/.exec(query)?.[1];
    return {
      matches: max !== undefined && Number(max) >= below,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    } as unknown as MediaQueryList;
  });
  return () => {
    spy.mockRestore();
  };
}

describe("Coquille du poste CRC", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("replie le menu en icônes, garde ses noms accessibles et mémorise le choix", async () => {
    const first = renderAt("/");
    const user = userEvent.setup();
    const toggle = await screen.findByRole("button", { name: "Réduire le menu" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveAttribute("aria-controls", "menu-principal");

    await user.click(toggle);
    const expand = screen.getByRole("button", { name: "Déplier le menu" });
    expect(expand).toHaveAttribute("aria-expanded", "false");
    const nav = screen.getByRole("navigation", { name: "Navigation principale" });
    expect(within(nav).getByRole("link", { name: "Déposer un document" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Catalogue" })).toHaveAttribute(
      "title",
      "Catalogue",
    );
    expect(screen.getByRole("button", { name: "Visite guidée" })).toBeInTheDocument();
    expect(await seriousViolations(first.container)).toEqual([]);
    first.unmount();

    renderAt("/");
    expect(await screen.findByRole("button", { name: "Déplier le menu" })).toBeInTheDocument();
  });

  it("sous 1024 px, ouvre le menu dans un tiroir qui se referme en suivant un lien", async () => {
    const restore = narrowScreen(1023);
    try {
      const { container } = renderAt("/");
      const user = userEvent.setup();
      expect(
        screen.queryByRole("navigation", { name: "Navigation principale" }),
      ).not.toBeInTheDocument();

      await user.click(await screen.findByRole("button", { name: "Ouvrir le menu" }));
      const drawer = screen.getByRole("dialog", { name: "Menu" });
      expect(within(drawer).getByRole("button", { name: "Fermer le menu" })).toHaveFocus();
      expect(await seriousViolations(container.ownerDocument.body)).toEqual([]);

      await user.click(within(drawer).getByRole("link", { name: "Catalogue" }));
      await waitFor(() => {
        expect(screen.queryByRole("dialog", { name: "Menu" })).not.toBeInTheDocument();
      });
    } finally {
      restore();
    }
  });
});
