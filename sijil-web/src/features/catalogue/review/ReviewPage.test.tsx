import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { REVIEWER } from "@/mocks/catalogue-data";
import { renderAt, seriousViolations } from "@/test/render";
import { server, stub } from "@/test/setup";
import { reviewSchema, today } from "@/features/catalogue/review/form";

const REVIEW = "/catalogue/types/ATTESTATION_SALAIRE/versions/2/revue";

function asReviewer() {
  stub.session = REVIEWER;
}

describe("File de revue", () => {
  it("liste les versions en revue, sans violation axe", async () => {
    asReviewer();
    const { container } = renderAt("/catalogue/revues");

    const link = await screen.findByRole("link", { name: "ATTESTATION_SALAIRE v2" });
    expect(link).toHaveAttribute("href", REVIEW);
    expect(screen.getByRole("link", { name: "File de revue" })).toBeVisible();
    expect(await seriousViolations(container)).toEqual([]);
  });

  it("dit quand rien n'attend de revue", async () => {
    asReviewer();
    stub.types = stub.types.filter((t) => t.code !== "ATTESTATION_SALAIRE");
    renderAt("/catalogue/revues");
    expect(await screen.findByText("Aucune version en attente de revue")).toBeVisible();
  });

  it("signale une panne et propose de réessayer", async () => {
    server.use(
      http.get("/api/reviews", () =>
        HttpResponse.json({ type: "x", title: "Erreur", status: 502 }, { status: 502 }),
      ),
    );
    renderAt("/catalogue/revues");
    expect(await screen.findByRole("button", { name: /Réessayer/ })).toBeVisible();
  });

  it("n'affiche le lien de la file qu'aux réviseurs", async () => {
    renderAt("/catalogue");
    await screen.findByRole("table");
    expect(screen.queryByRole("link", { name: "File de revue" })).not.toBeInTheDocument();
  });
});

describe("Revue d'une version", () => {
  it("montre les différences avec la version publiée puis approuve avec une date d'effet", async () => {
    asReviewer();
    const user = userEvent.setup();
    const { container } = renderAt(REVIEW);

    const table = await screen.findByRole("table", { name: "Champs modifiés" });
    const changed = within(table).getByText("Taille maximale (Mo)").closest("tr") as HTMLElement;
    expect(changed).toHaveTextContent("10");
    expect(changed).toHaveTextContent("5");
    expect(screen.getByText(/Différences avec la version publiée v1/)).toBeVisible();
    expect(await seriousViolations(container)).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Enregistrer la revue" }));

    expect(await screen.findByRole("status")).toHaveTextContent("état « Publié »");
    const version = stub.types.find((t) => t.code === "ATTESTATION_SALAIRE")?.versions[0];
    expect(version?.status).toBe("PUBLIE");
    expect(version?.effectiveFrom).toBe(today());
  });

  it("exige un motif pour demander des modifications", async () => {
    asReviewer();
    const user = userEvent.setup();
    renderAt(REVIEW);

    await user.click(await screen.findByRole("radio", { name: "Demander des modifications" }));
    await user.click(screen.getByRole("button", { name: "Enregistrer la revue" }));
    expect(await screen.findByText("Motif obligatoire")).toBeVisible();

    await user.type(screen.getByRole("textbox", { name: /Motif/ }), "Préciser la finalité.");
    await user.click(screen.getByRole("button", { name: "Enregistrer la revue" }));

    expect(await screen.findByRole("status")).toHaveTextContent("état « Brouillon »");
    expect(
      stub.types.find((t) => t.code === "ATTESTATION_SALAIRE")?.versions[0]?.reviewReason,
    ).toBe("Préciser la finalité.");
  });

  it("rend le refus des quatre yeux : on ne revoit pas sa propre soumission", async () => {
    stub.session = { ...REVIEWER, user: "contributeur.credit" };
    const user = userEvent.setup();
    renderAt(REVIEW);

    await user.click(await screen.findByRole("button", { name: "Enregistrer la revue" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Vous ne pouvez pas revoir une version que vous avez soumise",
    );
  });

  it("prévient quand la version a changé depuis la lecture", async () => {
    asReviewer();
    const user = userEvent.setup();
    renderAt(REVIEW);
    await screen.findByRole("button", { name: "Enregistrer la revue" });
    const version = stub.types.find((t) => t.code === "ATTESTATION_SALAIRE")?.versions[0];
    if (version) version.revision += 1;

    await user.click(screen.getByRole("button", { name: "Enregistrer la revue" }));

    expect(await screen.findByText("La version a changé depuis votre lecture")).toBeVisible();
  });

  it("n'a rien à revoir pour une version publiée, et montre une première version entière", async () => {
    renderAt("/catalogue/types/OFFRE_PRET/versions/1/revue");
    expect(await screen.findByText("Rien à revoir")).toBeVisible();
    expect(screen.getByText("Définition proposée (première version)")).toBeVisible();
  });

  it("signale une version inconnue", async () => {
    renderAt("/catalogue/types/ATTESTATION_SALAIRE/versions/9/revue");
    expect(await screen.findByRole("alert")).toHaveTextContent("Type inconnu");
  });

  it("valide la décision avant l'envoi", () => {
    const base = { reason: "", comment: "" };
    expect(
      reviewSchema.safeParse({ ...base, decision: "APPROVE", effectiveFrom: "2000-01-01" }).success,
    ).toBe(false);
    expect(
      reviewSchema.safeParse({ ...base, decision: "APPROVE", effectiveFrom: "" }).success,
    ).toBe(false);
    expect(
      reviewSchema.parse({
        decision: "REQUEST_CHANGES",
        effectiveFrom: "",
        reason: " Motif ",
        comment: " Note ",
      }),
    ).toEqual({ decision: "REQUEST_CHANGES", reason: "Motif", comment: "Note" });
    expect(today(new Date("2026-11-20T23:30:00Z"))).toBe("2026-11-20");
  });
});
