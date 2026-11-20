import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { renderAt, seriousViolations } from "@/test/render";
import { server, stub } from "@/test/setup";

describe("Soumission", () => {
  it("liste les contrôles en échec par rubrique", async () => {
    const user = userEvent.setup();
    const { container } = renderAt("/types/RIB/soumission");
    await user.click(
      await screen.findByRole("button", { name: "Lancer les contrôles et soumettre" }),
    );

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByRole("region", { name: "Rétention" })).toHaveTextContent(
      "/retention : obligatoire",
    );
    expect(within(alert).getByRole("region", { name: "Identité" })).toHaveTextContent("/family");
    expect(within(alert).getByRole("link", { name: "Corriger le brouillon" })).toHaveAttribute(
      "href",
      "/types/RIB/brouillon",
    );
    expect(await seriousViolations(container)).toEqual([]);
  });

  it("soumet un brouillon complet", async () => {
    const user = userEvent.setup();
    renderAt("/types/CIN/soumission");
    await user.click(
      await screen.findByRole("button", { name: "Lancer les contrôles et soumettre" }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("état « En revue »");
    expect(stub.types.find((t) => t.code === "CIN")?.versions[0]?.status).toBe("EN_REVUE");
  });

  it("n'a rien à soumettre pour une version publiée", async () => {
    renderAt("/types/OFFRE_PRET/soumission");
    expect(await screen.findByText("Rien à soumettre")).toBeVisible();
  });

  it("signale une modification concurrente et les autres erreurs", async () => {
    const user = userEvent.setup();
    renderAt("/types/CIN/soumission");
    const button = await screen.findByRole("button", { name: "Lancer les contrôles et soumettre" });
    const draft = stub.types.find((t) => t.code === "CIN")?.versions[0];
    if (draft) draft.revision = 9;
    await user.click(button);
    expect(await screen.findByText("Le brouillon a été modifié entre-temps")).toBeVisible();

    server.use(
      http.post("/api/types/:code/submission", () =>
        HttpResponse.json(
          { type: "about:blank", title: "Erreur", status: 500, detail: "Panne" },
          { status: 500 },
        ),
      ),
    );
    await user.click(button);
    expect(await screen.findByRole("alert")).toHaveTextContent("Panne");
  });
});
