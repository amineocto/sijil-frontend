import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { document, READER } from "@/mocks/data";
import { renderAt, seriousViolations } from "@/test/render";
import { server, stub } from "@/test/setup";

const SHEET = /^Fiche : /;

describe("Dossier client", () => {
  it("groupe les pièces par famille avec leurs étiquettes, sans violation axe", async () => {
    const { container } = renderAt("/dossiers/client/CLI-42");

    const pieces = await screen.findByRole("region", { name: "Pièces du dossier" });
    expect(await within(pieces).findByRole("heading", { name: "Identité" })).toBeInTheDocument();
    const rows = within(pieces).getAllByRole("button", { name: /Carte d'identité nationale/ });
    expect(rows).toHaveLength(2);
    // Contributeur du parcours eer : la pièce du crédit immobilier est d'un autre parcours.
    expect(rows.some((r) => r.textContent.includes("Autre parcours"))).toBe(true);
    expect(rows.some((r) => r.textContent.includes("Type à vérifier"))).toBe(true);
    expect(screen.getByRole("link", { name: "Déposer pour ce client" })).toHaveAttribute(
      "href",
      "/depot?partieType=CLIENT&partie=CLI-42",
    );
    expect(await seriousViolations(container)).toEqual([]);
  });

  it("signale les pièces expirées ou proches de l'échéance", async () => {
    const soon = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    server.use(
      http.get("/api/documents", () =>
        HttpResponse.json({
          items: [
            document("a1", "eer", "STANDARD", { dateExpiration: "2020-01-31" }),
            document("a2", "eer", "STANDARD", { dateExpiration: soon }),
            document("a3", "eer", "STANDARD", { dateExpiration: "2099-12-31" }),
          ],
          page: { size: 20, hasMore: false },
        }),
      ),
    );
    renderAt("/dossiers/client/CLI-42");
    const pieces = await screen.findByRole("region", { name: "Pièces du dossier" });
    expect(await within(pieces).findByText("Expirée le 31/01/2020")).toBeInTheDocument();
    expect(within(pieces).getByText(/^Expire dans (9|10) j$/)).toBeInTheDocument();
    expect(within(pieces).getByText("Valide jusqu'au 31/12/2099")).toBeInTheDocument();
  });

  it("ouvre la fiche en volet, la ferme par Échap et rend le focus à la ligne", async () => {
    renderAt("/dossiers/client/CLI-42");
    const user = userEvent.setup();
    const pieces = await screen.findByRole("region", { name: "Pièces du dossier" });
    const row = (await within(pieces).findAllByRole("button", { name: /Type à vérifier/ }))[0];
    if (!row) throw new Error("ligne absente");

    await user.click(row);
    const drawer = await screen.findByRole("dialog", { name: SHEET });
    expect(within(drawer).getByRole("button", { name: "Fermer la fiche" })).toHaveFocus();
    expect(await within(drawer).findByText(/Les traitements ont détecté/)).toBeInTheDocument();
    expect(within(drawer).getByRole("link", { name: "Ouvrir en pleine page" })).toHaveAttribute(
      "href",
      "/documents/2f1c2a54-7c1e-4a3b-9d55-0b2f5e9b1a11",
    );

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: SHEET })).not.toBeInTheDocument();
    });
    expect(row).toHaveFocus();
  });

  it("demande la finalité à l'ouverture d'une pièce d'un autre parcours", async () => {
    let purpose: string | null = null;
    server.use(
      http.get("/api/documents/:id", ({ request }) => {
        purpose = request.headers.get("X-Access-Purpose");
        return undefined;
      }),
    );
    renderAt("/dossiers/client/CLI-42");
    const user = userEvent.setup();
    const pieces = await screen.findByRole("region", { name: "Pièces du dossier" });
    const row = (await within(pieces).findAllByRole("button", { name: /Autre parcours/ }))[0];
    if (!row) throw new Error("ligne absente");

    await user.click(row);
    const drawer = await screen.findByRole("dialog", { name: SHEET });
    await user.type(
      await within(drawer).findByRole("textbox", { name: /Finalité/ }),
      "Instruction du dossier",
    );
    await user.click(within(drawer).getByRole("button", { name: "Consulter avec ce motif" }));
    expect(
      await within(drawer).findByText("Partagé dans le portefeuille client"),
    ).toBeInTheDocument();
    expect(purpose).toBe("Instruction du dossier");
  });

  it("ne propose le bris de glace qu'au rôle dédié", async () => {
    renderAt("/dossiers/client/CLI-42");
    await screen.findByRole("region", { name: "Pièces du dossier" });
    expect(screen.queryByRole("form", { name: "Bris de glace" })).not.toBeInTheDocument();
  });

  it("relaie le motif de bris de glace pour le rôle dédié", async () => {
    stub.session = { ...READER, roles: ["sijil-lecteur", "sijil-bris-de-glace"] };
    let reason: string | null = null;
    server.use(
      http.get("/api/documents", ({ request }) => {
        reason = request.headers.get("X-Break-Glass-Reason");
        return undefined;
      }),
    );
    renderAt("/dossiers/client/CLI-42");
    const user = userEvent.setup();
    const form = await screen.findByRole("form", { name: "Bris de glace" });
    await user.type(within(form).getByRole("textbox", { name: /Motif/ }), "Litige");
    await user.click(
      within(form).getByRole("button", { name: "Inclure les documents restreints" }),
    );
    await waitFor(() => {
      expect(reason).toBe("Litige");
    });
  });

  it("dit qu'aucun document n'est consultable", async () => {
    renderAt("/dossiers/personne/INCONNU");
    expect(await screen.findByText("Aucun document")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Déposer pour ce titulaire" })).toBeInTheDocument();
  });

  it("affiche l'erreur du BFF avec sa référence", async () => {
    server.use(
      http.get("/api/documents", () =>
        HttpResponse.json(
          { title: "Indisponible", status: 502, correlationId: "c-9" },
          { status: 502 },
        ),
      ),
    );
    renderAt("/dossiers/client/CLI-42");
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("c-9");
    });
  });

  it("refuse une adresse qui ne désigne aucune partie", async () => {
    renderAt("/dossiers/inconnu/X");
    expect(await screen.findByText("Dossier introuvable")).toBeInTheDocument();
  });
});
