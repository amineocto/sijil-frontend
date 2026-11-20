import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { renderAt, seriousViolations } from "@/test/render";
import { server } from "@/test/setup";

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:vignette");
  URL.revokeObjectURL = vi.fn();
});

describe("Recherche plein texte", () => {
  it("cherche un texte dans les documents d'une partie et ouvre la fiche Sijil", async () => {
    const query = new URLSearchParams();
    server.use(
      http.get("/api/search", ({ request }) => {
        new URL(request.url).searchParams.forEach((value, key) => {
          query.set(key, value);
        });
        return undefined;
      }),
    );
    const { container } = renderAt("/");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: "Plein texte" }));
    await user.type(screen.getByRole("textbox", { name: /Texte cherché/ }), "carte");
    await user.type(screen.getByRole("textbox", { name: /Identifiant de la partie/ }), "CLI-42");
    await user.click(screen.getByRole("button", { name: "Chercher" }));

    const table = await screen.findByRole("table", { name: "Documents trouvés en plein texte" });
    expect(
      table.querySelector('a[href="/documents/2f1c2a54-7c1e-4a3b-9d55-0b2f5e9b1a11"]'),
    ).not.toBeNull();
    expect(await screen.findAllByRole("img", { name: /Vignette/ })).not.toHaveLength(0);
    expect(query.get("q")).toBe("carte");
    expect(query.get("partyType")).toBe("CLIENT");
    expect(await seriousViolations(container)).toEqual([]);
  });

  it("dit qu'aucun document ne contient le texte, et rend l'erreur de la façade", async () => {
    renderAt("/");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: "Plein texte" }));
    await user.type(screen.getByRole("textbox", { name: /Texte cherché/ }), "introuvable");
    await user.type(screen.getByRole("textbox", { name: /Identifiant de la partie/ }), "CLI-42");
    await user.click(screen.getByRole("button", { name: "Chercher" }));
    expect(await screen.findByText("Aucun document")).toBeInTheDocument();

    server.use(
      http.get("/api/search", () =>
        HttpResponse.json(
          { title: "Indisponible", status: 503, correlationId: "c-7" },
          { status: 503 },
        ),
      ),
    );
    await user.clear(screen.getByRole("textbox", { name: /Texte cherché/ }));
    await user.type(screen.getByRole("textbox", { name: /Texte cherché/ }), "autre texte");
    await user.click(screen.getByRole("button", { name: "Chercher" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("c-7");
  });

  it("charge la page suivante avec le curseur rendu par la façade", async () => {
    const cursors: (string | null)[] = [];
    const item = (n: number) => ({
      id: `v360-${String(n)}`,
      type: { code: "CIN", label: `CIN ${String(n)}` },
      createdAt: "2026-11-20T08:00:00Z",
      sensitivity: "SENSIBLE",
      source: { system: "SIJIL", sijilId: `doc-${String(n)}` },
    });
    server.use(
      http.get("/api/search", ({ request }) => {
        const cursor = new URL(request.url).searchParams.get("cursor");
        cursors.push(cursor);
        return cursor === null
          ? HttpResponse.json({
              items: [item(1)],
              page: { size: 20, hasMore: true, nextCursor: "page-2" },
            })
          : HttpResponse.json({ items: [item(2)], page: { size: 20, hasMore: false } });
      }),
    );
    renderAt("/");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: "Plein texte" }));
    await user.type(screen.getByRole("textbox", { name: /Texte cherché/ }), "carte");
    await user.type(screen.getByRole("textbox", { name: /Identifiant de la partie/ }), "CLI-42");
    await user.click(screen.getByRole("button", { name: "Chercher" }));
    expect(await screen.findByRole("link", { name: "CIN 1" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Résultats suivants" }));

    expect(await screen.findByRole("link", { name: "CIN 2" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "CIN 1" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Résultats suivants" })).not.toBeInTheDocument();
    expect(cursors).toEqual([null, "page-2"]);
  });
});
