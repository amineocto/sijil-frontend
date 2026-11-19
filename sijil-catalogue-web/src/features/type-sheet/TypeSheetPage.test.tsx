import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderAt, seriousViolations } from "@/test/render";
import { stub } from "@/test/setup";
import { canonical, diffDefinitions } from "@/features/type-sheet/diff";

describe("Fiche d'un type", () => {
  it("montre les versions, le motif de revue et les rubriques modifiées", async () => {
    const user = userEvent.setup();
    const { container } = renderAt("/types/CIN");

    expect(await screen.findByText("Préciser la base légale de la rétention.")).toBeVisible();
    const versions = screen.getAllByRole("table")[0] as HTMLElement;
    expect(within(versions).getAllByRole("row")).toHaveLength(3);
    const changed = screen.getByRole("region", { name: "Rubrique maxSizeMb" });
    expect(within(changed).getByLabelText("maxSizeMb avant")).toHaveTextContent("10");
    expect(within(changed).getByLabelText("maxSizeMb après")).toHaveTextContent("15");
    expect(screen.getByRole("link", { name: "Modifier le brouillon" })).toHaveAttribute(
      "href",
      "/types/CIN/brouillon",
    );
    expect(await seriousViolations(container)).toEqual([]);

    await user.selectOptions(screen.getByLabelText("Version comparée"), "1");
    expect(screen.getByText("Aucune différence entre ces deux versions.")).toBeVisible();
  });

  it("ouvre une nouvelle version d'un type publié puis passe à l'éditeur", async () => {
    const user = userEvent.setup();
    stub.session = { ...stub.session, parcours: ["credit-immo"] };
    const { router } = renderAt("/types/OFFRE_PRET");

    await user.click(await screen.findByRole("button", { name: "Nouvelle version" }));

    await screen.findByRole("heading", { name: "Brouillon du type OFFRE_PRET" });
    expect(router.state.location.pathname).toBe("/types/OFFRE_PRET/brouillon");
    expect(stub.types.find((t) => t.code === "OFFRE_PRET")?.versions).toHaveLength(2);
  });

  it("ne propose aucune modification hors de son parcours", async () => {
    renderAt("/types/OFFRE_PRET");
    await screen.findByRole("heading", { name: "Versions" });
    expect(screen.queryByRole("button", { name: "Nouvelle version" })).not.toBeInTheDocument();
  });

  it("signale un type inconnu", async () => {
    renderAt("/types/INCONNU");
    expect(await screen.findByRole("alert")).toHaveTextContent("Type inconnu");
  });

  it("compare les définitions sans tenir compte de l'ordre des clés", () => {
    expect(canonical({ b: 1, a: { d: 2, c: 3 } })).toBe(canonical({ a: { c: 3, d: 2 }, b: 1 }));
    expect(canonical(undefined)).toBe("undefined");
    expect(diffDefinitions({ a: 1, b: [1] }, { b: [1], c: 2 })).toEqual([
      { key: "a", before: 1, after: undefined },
      { key: "c", before: undefined, after: 2 },
    ]);
  });
});
