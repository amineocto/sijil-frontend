import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { RouteError } from "@/app/RouteError";
import { navigation } from "@/shared/api";
import { renderAt } from "@/test/render";

function BrokenScreen(): never {
  throw new Error("rendu impossible");
}

describe("Écrans de repli et cache partagé entre écrans", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("dit qu'une adresse inconnue n'existe pas, sans quitter la coquille", async () => {
    renderAt("/adresse-inconnue");

    expect(await screen.findByRole("heading", { name: "Page introuvable" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Revenir à la recherche" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("search", { name: "Ouvrir un dossier" })).toBeInTheDocument();
  });

  it("propose de recharger quand un écran échoue, au lieu de l'écran anglais du routeur", async () => {
    const assign = vi.spyOn(navigation, "assign").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const router = createMemoryRouter([
      { path: "/", element: <BrokenScreen />, errorElement: <RouteError /> },
    ]);
    render(<RouterProvider router={router} />);

    expect(
      await screen.findByRole("heading", { name: "Cet écran n'a pas pu s'afficher" }),
    ).toBeVisible();
    expect(screen.queryByText(/Unexpected Application Error/)).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Recharger la page" }));
    expect(assign).toHaveBeenCalledWith(globalThis.location.href);
  });

  it("ouvre le dépôt d'un type juste après sa fiche du catalogue, avec le même cache", async () => {
    const { router } = renderAt("/catalogue/types/CIN");
    await screen.findByRole("table", { name: "Versions" });

    await act(() => router.navigate("/depot"));
    const user = userEvent.setup();
    await user.selectOptions(
      await screen.findByRole("combobox", { name: /Type de document/ }),
      "CIN",
    );

    expect(await screen.findByRole("textbox", { name: /Numéro/ })).toBeVisible();
  });
});
