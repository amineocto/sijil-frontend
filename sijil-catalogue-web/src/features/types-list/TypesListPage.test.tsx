import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { renderAt, seriousViolations } from "@/test/render";
import { server, stub } from "@/test/setup";
import type { MockType } from "@/mocks/data";

describe("Liste des types", () => {
  it("affiche les types avec leur dernière version et leur statut, sans violation axe", async () => {
    const { container } = renderAt("/");

    const table = await screen.findByRole("table");
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(4);
    expect(rows[1]).toHaveTextContent("CIN");
    expect(rows[1]).toHaveTextContent("Brouillon");
    expect(screen.getByRole("link", { name: "CIN" })).toHaveAttribute("href", "/types/CIN");
    expect(screen.getByText("Authentification simulée (provisoire)")).toBeInTheDocument();
    expect(await seriousViolations(container)).toEqual([]);
  });

  it("applique les filtres depuis l'URL et les y reflète", async () => {
    const user = userEvent.setup();
    const { router } = renderAt("/?status=PUBLIE");
    await screen.findByRole("link", { name: "OFFRE_PRET" });
    expect(screen.queryByRole("link", { name: "CIN" })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Statut"), "");
    await user.type(screen.getByLabelText(/Recherche/), "rib");
    await user.click(screen.getByRole("button", { name: "Filtrer" }));

    await screen.findByRole("link", { name: "RIB" });
    expect(router.state.location.search).toBe("?q=rib");
    expect(screen.queryByRole("link", { name: "OFFRE_PRET" })).not.toBeInTheDocument();
  });

  it("charge la page suivante par curseur", async () => {
    const user = userEvent.setup();
    stub.types = Array.from({ length: 25 }, (_, i) => generated(i));
    renderAt("/");
    await screen.findByRole("link", { name: "T_00" });
    expect(screen.queryByRole("link", { name: "T_24" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Charger plus" }));

    await screen.findByRole("link", { name: "T_24" });
    expect(screen.queryByRole("button", { name: "Charger plus" })).not.toBeInTheDocument();
  });

  it("affiche l'état vide", async () => {
    renderAt("/?q=inexistant");
    expect(await screen.findByRole("heading", { name: "Aucun type de document" })).toBeVisible();
  });

  it("affiche l'erreur avec sa référence et permet de réessayer", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("/api/types", () =>
        HttpResponse.json(
          { type: "about:blank", title: "Erreur", status: 503, detail: "Catalogue indisponible" },
          { status: 503, headers: { "X-Correlation-Id": "corr-42" } },
        ),
      ),
    );
    renderAt("/");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Catalogue indisponible");
    expect(alert).toHaveTextContent("corr-42");

    server.resetHandlers();
    await user.click(within(alert).getByRole("button", { name: "Réessayer" }));
    await screen.findByRole("table");
  });

  it("ne propose la création qu'aux contributeurs", async () => {
    stub.session = { user: "lecteur", roles: ["catalogue-lecteur"], parcours: [] };
    renderAt("/");
    await screen.findByRole("table");
    await waitFor(() => {
      expect(screen.getByLabelText("Utilisateur connecté")).toHaveTextContent("lecteur");
    });
    expect(screen.queryByRole("link", { name: "Nouveau type" })).not.toBeInTheDocument();
  });
});

function generated(i: number): MockType {
  const code = `T_${String(i).padStart(2, "0")}`;
  return {
    code,
    family: null,
    ownerParcours: "eer",
    referentParcours: "eer",
    versions: [
      {
        version: 1,
        status: "BROUILLON",
        effectiveFrom: null,
        submittedBy: null,
        reviewedBy: null,
        reviewReason: null,
        definition: { labels: { fr: code } },
        revision: 0,
      },
    ],
  };
}
