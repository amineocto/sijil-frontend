import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderAt, seriousViolations } from "@/test/render";
import { stub } from "@/test/setup";
import { canonical, diffDefinitions } from "@/features/catalogue/type-sheet/diff";
import { fieldChanges, periodLabel, valueLabel } from "@/features/catalogue/type-sheet/readable";

describe("Fiche d'un type", () => {
  it("montre les versions, le motif de revue et les rubriques modifiées", async () => {
    const user = userEvent.setup();
    const { container } = renderAt("/catalogue/types/CIN");

    expect(await screen.findByText("Préciser la base légale de la rétention.")).toBeVisible();
    const versions = screen.getByRole("table", { name: "Versions" });
    expect(within(versions).getAllByRole("row")).toHaveLength(3);
    const changed = within(screen.getByRole("table", { name: "Champs modifiés" }))
      .getByText("Taille maximale (Mo)")
      .closest("tr") as HTMLElement;
    expect(changed).toHaveTextContent("Stockage");
    expect(changed).toHaveTextContent("10");
    expect(changed).toHaveTextContent("15");
    const definition = screen.getByRole("group", { name: "Définition du type, en lecture seule" });
    expect(definition).toBeDisabled();
    expect(within(definition).getByLabelText(/Libellé français/)).not.toHaveValue("");
    expect(screen.getByRole("link", { name: "Modifier le brouillon" })).toHaveAttribute(
      "href",
      "/catalogue/types/CIN/brouillon",
    );
    expect(await seriousViolations(container)).toEqual([]);

    await user.selectOptions(screen.getByLabelText("Version comparée"), "1");
    expect(screen.getByText("Aucune différence entre ces deux versions.")).toBeVisible();
  });

  it("ouvre une nouvelle version d'un type publié puis passe à l'éditeur", async () => {
    const user = userEvent.setup();
    stub.session = { ...stub.session, parcours: ["credit-immo"] };
    const { router } = renderAt("/catalogue/types/OFFRE_PRET");

    await user.click(await screen.findByRole("button", { name: "Nouvelle version" }));

    await screen.findByRole("heading", { name: "Brouillon du type OFFRE_PRET" });
    expect(router.state.location.pathname).toBe("/catalogue/types/OFFRE_PRET/brouillon");
    expect(stub.types.find((t) => t.code === "OFFRE_PRET")?.versions).toHaveLength(2);
  });

  it("ne propose aucune modification hors de son parcours", async () => {
    renderAt("/catalogue/types/OFFRE_PRET");
    await screen.findByRole("heading", { name: "Versions" });
    expect(screen.queryByRole("button", { name: "Nouvelle version" })).not.toBeInTheDocument();
  });

  it("signale un type inconnu", async () => {
    renderAt("/catalogue/types/INCONNU");
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

  it("dit les changements dans les mots de l'éditeur, sans JSON", () => {
    expect(periodLabel("P10Y6M")).toBe("10 ans 6 mois");
    expect(periodLabel("P1D")).toBe("1 jour");
    expect(valueLabel(true)).toBe("Oui");
    expect(valueLabel(["application/pdf", "image/png"])).toBe("PDF, Image PNG");
    expect(
      fieldChanges(
        { retention: { duration: "P5Y", startEvent: "CREATION" }, sensitivity: "STANDARD" },
        { retention: { duration: "P10Y", startEvent: "CREATION" }, sensitivity: "SENSIBLE" },
      ),
    ).toEqual([
      { rubric: "Rétention", field: "Rétention › Durée", before: "5 ans", after: "10 ans" },
      {
        rubric: "Sensibilité et visibilité",
        field: "Sensibilité",
        before: "Standard",
        after: "Sensible",
      },
    ]);
  });
});
