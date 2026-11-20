import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { READER } from "@/mocks/data";
import { renderAt, seriousViolations } from "@/test/render";
import { server, stub } from "@/test/setup";

describe("Recherche", () => {
  it("cherche les documents d'un client et relaie la finalité en en-tête", async () => {
    let purpose: string | null = null;
    server.use(
      http.get("/api/documents", ({ request }) => {
        purpose = request.headers.get("X-Access-Purpose");
        return undefined;
      }),
    );
    const { container } = renderAt("/");
    const user = userEvent.setup();

    expect(await screen.findByText(/Saisissez un client/)).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: /Identifiant/ }), "CLI-42");
    await user.type(screen.getByRole("textbox", { name: /Finalité/ }), "Instruction");
    await user.click(screen.getByRole("button", { name: "Rechercher" }));

    const table = await screen.findByRole("table", { name: "Documents trouvés" });
    expect(table).toHaveTextContent("credit-immo");
    expect(purpose).toBe("Instruction");
    expect(await seriousViolations(container)).toEqual([]);
  });

  it("ne propose le motif de bris de glace qu'au rôle dédié", async () => {
    renderAt("/");
    expect(await screen.findByRole("textbox", { name: /Finalité/ })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /bris de glace/ })).not.toBeInTheDocument();
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
    renderAt("/");
    const user = userEvent.setup();
    await user.type(await screen.findByRole("textbox", { name: /bris de glace/ }), "Litige");
    await user.type(screen.getByRole("textbox", { name: /Identifiant/ }), "CLI-42");
    await user.click(screen.getByRole("button", { name: "Rechercher" }));
    await screen.findByRole("table", { name: "Documents trouvés" });
    expect(reason).toBe("Litige");
  });

  it("dit qu'aucun document ne correspond", async () => {
    renderAt("/recherche");
    const user = userEvent.setup();
    await user.type(await screen.findByRole("textbox", { name: /Identifiant/ }), "INCONNU");
    await user.type(screen.getByRole("textbox", { name: /Type de document/ }), "cin");
    await user.click(screen.getByRole("button", { name: "Rechercher" }));
    expect(await screen.findByText("Aucun document")).toBeInTheDocument();
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
    renderAt("/");
    const user = userEvent.setup();
    await user.type(await screen.findByRole("textbox", { name: /Identifiant/ }), "CLI-42");
    await user.click(screen.getByRole("button", { name: "Rechercher" }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("c-9");
    });
  });
});
