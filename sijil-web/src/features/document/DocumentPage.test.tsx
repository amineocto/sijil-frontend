import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { READER } from "@/mocks/data";
import { renderAt, seriousViolations } from "@/test/render";
import { server, stub } from "@/test/setup";

const OWN = "/documents/2f1c2a54-7c1e-4a3b-9d55-0b2f5e9b1a11";
const OTHER = "/documents/7b0e9f3a-1c2d-4e5f-8a9b-0c1d2e3f4a5b";

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:apercu");
  URL.revokeObjectURL = vi.fn();
});

describe("Fiche document", () => {
  it("montre métadonnées, aperçu relayé et historique", async () => {
    const { container } = renderAt(OWN);
    const user = userEvent.setup();

    const metadata = await screen.findByRole("table", { name: "Métadonnées" });
    expect(metadata).toHaveTextContent("AB12345");
    // Écart de type détecté par les traitements (lot 5).
    expect(screen.getByText("Type à vérifier")).toBeInTheDocument();
    // Le PDF s'affiche dès l'ouverture, sans clic.
    expect(await screen.findByTitle("Aperçu du document CIN")).toHaveAttribute(
      "src",
      "blob:apercu",
    );
    expect(screen.getByRole("status")).toHaveTextContent("PASSEPORT");
    expect(await seriousViolations(container)).toEqual([]);

    await user.click(screen.getByRole("tab", { name: "Versions et historique" }));
    expect(await screen.findByRole("table", { name: "Versions" })).toHaveTextContent("courante");
    expect(
      await screen.findByRole("table", { name: "Historique des métadonnées" }),
    ).toHaveTextContent("Dépôt");
    expect(await screen.findByText("Aucun usage")).toBeInTheDocument();
  });

  it("signale un document partagé dans le portefeuille client 360 (ADR 0025)", async () => {
    const first = renderAt(OWN);
    expect(await screen.findByRole("table", { name: "Métadonnées" })).toBeInTheDocument();
    expect(screen.queryByText("Partagé dans le portefeuille client")).not.toBeInTheDocument();
    first.unmount();

    const own = stub.documents[0];
    if (!own) throw new Error("document de démonstration absent");
    stub.documents[0] = { ...own, sharedInPortfolio: true };
    renderAt(OWN);
    expect(await screen.findByText("Partagé dans le portefeuille client")).toBeInTheDocument();
  });

  it("demande une finalité pour le document d'un autre parcours, sans actions", async () => {
    renderAt(OTHER);
    const user = userEvent.setup();

    expect(await screen.findByText("Accès à justifier")).toBeInTheDocument();
    expect(screen.queryByText(/X-Access/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Consulter avec ce motif" }));
    expect(screen.getByText("Indiquez pourquoi vous consultez ce document")).toBeVisible();
    await user.type(screen.getByRole("textbox", { name: /Finalité/ }), "Contrôle interne");
    await user.click(screen.getByRole("button", { name: "Consulter avec ce motif" }));

    expect(await screen.findByRole("table", { name: "Métadonnées" })).toHaveTextContent("CD67890");
    expect(screen.queryByRole("button", { name: "Supprimer" })).not.toBeInTheDocument();
  });

  it("signale un aperçu indisponible et permet de réessayer", async () => {
    server.use(
      http.get("/api/documents/:id/preview", () => new HttpResponse(null, { status: 502 })),
    );
    renderAt(OWN);
    const user = userEvent.setup();
    expect(await screen.findByRole("alert")).toHaveTextContent("L'aperçu n'est pas disponible.");
    server.use(http.get("/api/documents/:id/preview", () => HttpResponse.error()));
    await user.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("modifie les métadonnées avec la révision lue, et signale une révision périmée", async () => {
    renderAt(OWN);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Modifier les métadonnées" }));
    const form = await screen.findByRole("form", { name: "Modifier les métadonnées" });
    const numero = await within(form).findByRole("textbox", { name: /Numéro/ });
    await user.clear(numero);
    await user.type(numero, "AB99999");
    await user.type(within(form).getByRole("textbox", { name: /Motif/ }), "Correction de saisie");
    await user.click(within(form).getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => {
      expect(screen.getByRole("table", { name: "Métadonnées" })).toHaveTextContent("AB99999");
    });

    server.use(
      http.patch("/api/documents/:id", () =>
        HttpResponse.json({ title: "Périmé", status: 412 }, { status: 412 }),
      ),
    );
    await user.click(screen.getByRole("button", { name: "Modifier les métadonnées" }));
    const again = await screen.findByRole("form", { name: "Modifier les métadonnées" });
    await user.type(within(again).getByRole("textbox", { name: /Motif/ }), "Nouvelle correction");
    await user.click(within(again).getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText(/rechargez la page/)).toBeInTheDocument();
  });

  it("supprime logiquement avec motif puis restaure", async () => {
    renderAt(OWN);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Supprimer" }));
    await user.type(screen.getByRole("textbox", { name: /Motif de la suppression/ }), "Doublon");
    await user.click(screen.getByRole("button", { name: "Confirmer la suppression" }));

    expect(await screen.findByText("Document supprimé")).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: /Motif de la restauration/ }), "Erreur");
    await user.click(screen.getByRole("button", { name: "Restaurer" }));
    expect(await screen.findByRole("button", { name: "Supprimer" })).toBeInTheDocument();
  });

  it("contrôle motifs, métadonnées et fichier avant tout envoi", async () => {
    let writes = 0;
    server.use(
      http.patch("/api/documents/:id", () => {
        writes++;
        return HttpResponse.json({}, { status: 500 });
      }),
      http.delete("/api/documents/:id", () => {
        writes++;
        return HttpResponse.json({}, { status: 500 });
      }),
    );
    renderAt(OWN);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Modifier les métadonnées" }));
    const form = await screen.findByRole("form", { name: "Modifier les métadonnées" });
    const numero = within(form).getByRole("textbox", { name: /Numéro/ });
    await user.clear(numero);
    await user.type(numero, "ab12");
    await user.click(within(form).getByRole("button", { name: "Enregistrer" }));
    expect(within(form).getByText("Lettres en majuscules attendues : AB12")).toBeVisible();
    expect(within(form).getByText("Obligatoire")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Supprimer" }));
    await user.type(screen.getByRole("textbox", { name: /Motif de la suppression/ }), "ok");
    await user.click(screen.getByRole("button", { name: "Confirmer la suppression" }));
    expect(screen.getByText("Au moins 3 caractères")).toBeVisible();
    expect(screen.getByRole("textbox", { name: /Motif de la suppression/ })).toHaveFocus();
    expect(
      screen
        .getAllByRole("alert")
        .some((alert) => alert.textContent.includes("1 champ à corriger")),
    ).toBe(true);
    expect(writes).toBe(0);
  });

  it("dépose une nouvelle version", async () => {
    renderAt(OWN);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Nouvelle version" }));
    const form = await screen.findByRole("form", { name: "Nouvelle version" });
    const input = form.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("champ fichier absent");
    await user.upload(input, new File(["%PDF-1.7 v2"], "v2.pdf", { type: "application/pdf" }));
    await user.click(within(form).getByRole("button", { name: "Envoyer" }));
    await waitFor(() => {
      expect(screen.queryByRole("form", { name: "Nouvelle version" })).not.toBeInTheDocument();
    });
    expect(stub.documents[0]?.currentVersion).toBe(2);
  });

  it("ne propose aucune action à un lecteur", async () => {
    stub.session = READER;
    stub.session = { ...READER, parcours: ["eer"] };
    renderAt(OWN);
    expect(await screen.findByRole("table", { name: "Métadonnées" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Supprimer" })).not.toBeInTheDocument();
  });
});
