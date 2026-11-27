import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DATA_OFFICE, SESSION } from "@/mocks/catalogue-data";
import { termProblems } from "@/features/catalogue/dictionary/TermDrawer";
import { renderAt, seriousViolations } from "@/test/render";
import { stub } from "@/test/setup";

describe("Dictionnaire de métadonnées (ADR 0038)", () => {
  it("se lit par tous, se filtre, et ne s'écrit pas sans le rôle Data Office, sans violation axe", async () => {
    stub.session = SESSION;
    const user = userEvent.setup();
    const { container } = renderAt("/catalogue/dictionnaire");

    const table = await screen.findByRole("table", { name: "Termes du dictionnaire" });
    const cin = within(table).getByRole("row", { name: /numeroCin/ });
    expect(cin).toHaveTextContent("Numéro de CIN");
    expect(cin).toHaveTextContent("Personnelle");
    expect(within(table).getByRole("row", { name: /dateFin/ })).toHaveTextContent("Déprécié");
    expect(screen.queryByRole("button", { name: "Nouveau terme" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Modifier/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dictionnaire" })).toBeVisible();
    expect(await seriousViolations(container)).toEqual([]);

    await user.type(screen.getByLabelText("Rechercher"), "date");
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    await user.selectOptions(screen.getByLabelText("Statut"), "DEPRECIE");
    expect(within(table).getByRole("row", { name: /dateFin/ })).toBeVisible();
    expect(within(table).queryByRole("row", { name: /dateExpiration/ })).toBeNull();
    await user.type(screen.getByLabelText("Rechercher"), "zzz");
    expect(screen.getByText("Aucun terme ne correspond à la recherche.")).toBeVisible();
  });

  it("un profil hors Data Office consulte un terme en lecture seule", async () => {
    stub.session = SESSION;
    const user = userEvent.setup();
    renderAt("/catalogue/dictionnaire");

    expect(await screen.findByText("Dictionnaire tenu par le Data Office")).toBeVisible();
    await user.click(await screen.findByRole("button", { name: "Consulter numeroCin" }));
    const form = await screen.findByRole("form", { name: "Terme numeroCin" });
    expect(within(form).getByLabelText(/Libellé français/)).toBeDisabled();
    expect(within(form).getByLabelText(/Libellé français/)).toHaveValue("Numéro de CIN");
    expect(within(form).queryByRole("button", { name: "Enregistrer" })).not.toBeInTheDocument();
    await user.click(within(form).getByRole("button", { name: "Fermer" }));
    expect(screen.queryByRole("form", { name: "Terme numeroCin" })).not.toBeInTheDocument();
  });

  it("le Data Office crée un terme à liste de valeurs, et un code pris est refusé", async () => {
    stub.session = DATA_OFFICE;
    const user = userEvent.setup();
    renderAt("/catalogue/dictionnaire");

    await user.click(await screen.findByRole("button", { name: "Nouveau terme" }));
    const form = screen.getByRole("form", { name: "Nouveau terme" });
    await user.click(within(form).getByRole("button", { name: "Enregistrer" }));
    expect(within(form).getByText(/Une minuscule puis lettres/)).toBeVisible();
    expect(within(form).getByText("Obligatoire")).toBeVisible();

    await user.type(within(form).getByLabelText(/^Nom technique/), "situationFamiliale");
    await user.type(within(form).getByLabelText(/^Libellé français/), "Situation familiale");
    await user.selectOptions(within(form).getByLabelText(/^Format/), "ENUM");
    await user.type(within(form).getByLabelText("Valeurs permises"), "CELIBATAIRE{Enter}");
    await user.type(within(form).getByLabelText("Valeurs permises"), "MARIE{Enter}");
    await user.selectOptions(within(form).getByLabelText(/^Donnée personnelle/), "SENSIBLE");
    await user.click(within(form).getByRole("button", { name: "Enregistrer" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Situation familiale (situationFamiliale) est actif",
    );
    expect(stub.terms.find((t) => t.code === "situationFamiliale")).toMatchObject({
      format: "ENUM",
      values: ["CELIBATAIRE", "MARIE"],
      personalData: "SENSIBLE",
      updatedBy: "data-office.demo",
    });

    await user.click(screen.getByRole("button", { name: "Nouveau terme" }));
    const again = screen.getByRole("form", { name: "Nouveau terme" });
    await user.type(within(again).getByLabelText(/^Nom technique/), "montant");
    await user.type(within(again).getByLabelText(/^Libellé français/), "Montant");
    await user.selectOptions(within(again).getByLabelText(/^Format/), "NUMBER");
    await user.type(within(again).getByLabelText("Minimum"), "0");
    await user.type(within(again).getByLabelText("Maximum"), "10");
    await user.click(within(again).getByRole("button", { name: "Enregistrer" }));
    expect(await within(again).findByRole("alert")).toHaveTextContent("existe déjà");
    await user.click(within(again).getByRole("button", { name: "Annuler" }));
    expect(screen.queryByRole("form", { name: "Nouveau terme" })).not.toBeInTheDocument();
  });

  it("le Data Office modifie un terme à sa révision et le déprécie ; son code et son format ne changent pas", async () => {
    stub.session = DATA_OFFICE;
    const user = userEvent.setup();
    renderAt("/catalogue/dictionnaire");

    await user.click(await screen.findByRole("button", { name: "Modifier numeroCin" }));
    const form = await screen.findByRole("form", { name: "Modification du terme numeroCin" });
    expect(within(form).getByLabelText(/^Nom technique/)).toHaveAttribute("readonly");
    expect(within(form).getByLabelText(/^Format/)).toBeDisabled();
    expect(within(form).getByLabelText("Motif")).toHaveValue("^[A-Z]{1,2}[0-9]{1,6}$");
    await user.type(within(form).getByLabelText("Longueur maximale"), "8");
    await user.type(within(form).getByLabelText(/^Définition/), "Numéro de la CIN électronique.");
    await user.type(within(form).getByLabelText(/^Propriété FileNet/), "AWB_NumCin");
    await user.selectOptions(within(form).getByLabelText(/^Statut/), "DEPRECIE");
    await user.click(within(form).getByRole("button", { name: "Enregistrer" }));

    expect(await screen.findByRole("status")).toHaveTextContent("est déprécié");
    expect(stub.terms.find((t) => t.code === "numeroCin")).toMatchObject({
      revision: 1,
      status: "DEPRECIE",
      maxLength: 8,
      definition: "Numéro de la CIN électronique.",
      filenetProperty: "AWB_NumCin",
    });

    // Révision périmée : le terme a changé entre-temps.
    await user.click(screen.getByRole("button", { name: "Modifier montant" }));
    const stale = await screen.findByRole("form", { name: "Modification du terme montant" });
    const montant = stub.terms.find((t) => t.code === "montant");
    if (montant) montant.revision = 5;
    await user.click(within(stale).getByRole("button", { name: "Enregistrer" }));
    expect(await within(stale).findByRole("alert")).toHaveTextContent("Rechargez le terme");
  });

  it("contrôle un terme comme le contrat avant l'envoi", () => {
    const base = {
      code: "numeroCin",
      labelFr: "Numéro",
      labelAr: "",
      labelEn: "",
      definition: "",
      format: "TEXT" as const,
      maxLength: "",
      pattern: "",
      values: [],
      minimum: "",
      maximum: "",
      personalData: "AUCUNE" as const,
      filenetProperty: "",
      status: "ACTIF" as const,
    };
    expect(termProblems(base, true)).toEqual({});
    expect(termProblems({ ...base, code: "Numero", maxLength: "0", pattern: "[a-" }, true)).toEqual(
      {
        code: "Une minuscule puis lettres et chiffres, sans espace",
        maxLength: "Nombre entier de 1 à 100 000",
        pattern: "Expression régulière invalide",
      },
    );
    expect(termProblems({ ...base, format: "ENUM" }, false)).toEqual({
      values: "Ajoutez au moins une valeur",
    });
    expect(
      termProblems({ ...base, format: "INTEGER", minimum: "5", maximum: "2.5" }, false),
    ).toEqual({ maximum: "Nombre entier attendu" });
    expect(termProblems({ ...base, format: "NUMBER", minimum: "5", maximum: "2" }, false)).toEqual({
      maximum: "Le maximum doit être supérieur ou égal au minimum",
    });
  });
});
