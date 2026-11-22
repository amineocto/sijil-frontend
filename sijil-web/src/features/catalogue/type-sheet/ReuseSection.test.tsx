import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { renderAt, seriousViolations } from "@/test/render";
import { server, stub } from "@/test/setup";

describe("Réutilisation", () => {
  it("liste les parcours qui réutilisent le type", async () => {
    renderAt("/catalogue/types/CIN");
    const list = await screen.findByRole("list", { name: "Parcours qui réutilisent le type" });
    expect(list).toHaveTextContent("credit-immo : Pièce d'identité de l'emprunteur");
    expect(
      screen.queryByRole("button", { name: "Déclarer la réutilisation" }),
    ).not.toBeInTheDocument();
  });

  it("déclare la réutilisation d'un type d'un autre parcours, avec sa finalité", async () => {
    const user = userEvent.setup();
    const { container } = renderAt("/catalogue/types/OFFRE_PRET");

    await user.click(await screen.findByRole("button", { name: "Déclarer la réutilisation" }));
    expect(await screen.findByText("Finalité obligatoire, 500 caractères au plus")).toBeVisible();
    expect(await seriousViolations(container)).toEqual([]);

    await user.type(screen.getByRole("textbox", { name: /Finalité/ }), "Justificatif du client");
    await user.click(screen.getByRole("button", { name: "Déclarer la réutilisation" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Réutilisation déclarée");
    expect(stub.types.find((t) => t.code === "OFFRE_PRET")?.reuses).toEqual([
      expect.objectContaining({ parcours: "eer", purpose: "Justificatif du client" }),
    ]);
    expect(await screen.findByText(/eer/, { selector: "strong" })).toBeVisible();
  });

  it("rend le refus du catalogue", async () => {
    server.use(
      http.post("/api/types/:code/reuses", () =>
        HttpResponse.json(
          { type: "x", title: "Ce parcours réutilise déjà ce type", status: 409 },
          { status: 409, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );
    const user = userEvent.setup();
    renderAt("/catalogue/types/OFFRE_PRET");
    await user.type(await screen.findByRole("textbox", { name: /Finalité/ }), "Justificatif");
    await user.click(screen.getByRole("button", { name: "Déclarer la réutilisation" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("réutilise déjà");
  });

  it("dit qu'aucun parcours ne réutilise un type et ne propose rien à un lecteur", async () => {
    stub.session = { user: "lecteur", roles: ["catalogue-lecteur"], parcours: [] };
    renderAt("/catalogue/types/OFFRE_PRET");
    expect(await screen.findByText("Aucun autre parcours ne réutilise ce type.")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Déclarer la réutilisation" }),
    ).not.toBeInTheDocument();
  });
});
