import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderAt } from "@/test/render";
import { stub } from "@/test/setup";
import { splitPeriod } from "./controls";
import { constraintsOf, schemaOf, type Term } from "@/features/catalogue/dictionary/terms";
import { initialTerms } from "@/mocks/catalogue-data";
import { moved, namesOf, required, withTerm, without } from "./metadata";
import { compact, objectOf, omit, parse, stringsOf, text } from "./part";

function definition(): Record<string, unknown> {
  return stub.types.find((t) => t.code === "RIB")?.versions[0]?.definition ?? {};
}

async function openRubric(name: string) {
  const user = userEvent.setup();
  renderAt("/catalogue/types/RIB/brouillon");
  await screen.findByLabelText(/Libellé français/);
  await user.click(screen.getByRole("tab", { name }));
  return { user, panel: screen.getByRole("tabpanel", { name }) };
}

async function save(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Brouillon enregistré");
}

describe("Rubriques de l'éditeur : conversions", () => {
  it("traduit un terme du dictionnaire en propriété du schéma, comme le catalogue", () => {
    const terms = new Map(initialTerms().map((t) => [t.code, t]));
    const term = (code: string): Term => {
      const found = terms.get(code);
      if (!found) throw new Error(code);
      return found;
    };
    expect(schemaOf(term("dateExpiration"))).toEqual({
      type: "string",
      format: "date",
      title: "Date d'expiration",
    });
    expect(schemaOf(term("paysEmission"))).toEqual({
      type: "string",
      enum: ["MAR", "FRA", "ESP"],
      title: "Pays d'émission",
    });
    expect(schemaOf(term("montant"))).toEqual({ type: "number", minimum: 0, title: "Montant" });
    expect(schemaOf({ ...term("montant"), format: "INTEGER", maximum: 9 })).toMatchObject({
      type: "integer",
      maximum: 9,
    });
    expect(schemaOf({ ...term("montant"), format: "BOOLEAN", minimum: null })).toEqual({
      type: "boolean",
      title: "Montant",
    });
    expect(constraintsOf(term("numeroCin"))).toBe("motif ^[A-Z]{1,2}[0-9]{1,6}$");
    expect(constraintsOf(term("numero"))).toBe("200 caractères au plus");
    expect(constraintsOf(term("montant"))).toBe("au moins 0");
    expect(constraintsOf({ ...term("montant"), minimum: null, maximum: 5 })).toBe("au plus 5");
    expect(constraintsOf({ ...term("montant"), maximum: 5 })).toBe("entre 0 et 5");
    expect(constraintsOf(term("paysEmission"))).toBe("valeurs : MAR, FRA, ESP");
    expect(constraintsOf(term("dateExpiration"))).toBe("—");
  });

  it("ajoute, ordonne, exige et retire des métadonnées sans perdre la racine du schéma", () => {
    const [date, , montant] = initialTerms();
    if (!date || !montant) throw new Error("termes absents");
    let schema = withTerm({ $comment: "garder" }, date);
    schema = withTerm(schema, montant);
    expect(namesOf(schema)).toEqual(["dateExpiration", "montant"]);
    schema = moved(schema, "montant", -1);
    expect(namesOf(schema)).toEqual(["montant", "dateExpiration"]);
    expect(moved(schema, "montant", -1)).toBe(schema);
    schema = required(required(schema, "montant", true), "dateExpiration", true);
    expect(schema["required"]).toEqual(["montant", "dateExpiration"]);
    schema = without(schema, "montant");
    expect(schema).toEqual({
      type: "object",
      $comment: "garder",
      required: ["dateExpiration"],
      properties: {
        dateExpiration: { type: "string", format: "date", title: "Date d'expiration" },
      },
    });
    expect(required(schema, "dateExpiration", false)).not.toHaveProperty("required");
  });

  it("découpe une période d'une seule unité, et laisse au mode avancé une période composée", () => {
    expect(splitPeriod("P10Y")).toEqual({ amount: "10", unit: "Y" });
    expect(splitPeriod(undefined)).toEqual({ amount: "", unit: "Y" });
    expect(splitPeriod("P1Y6M")).toBeNull();
  });

  it("lit les valeurs de la définition avec prudence", () => {
    expect(parse("")).toEqual({ value: undefined, valid: true });
    expect(parse("{")).toEqual({ value: undefined, valid: false });
    expect(compact({ a: 1, b: undefined, c: "" })).toEqual({ a: 1 });
    expect(objectOf([1])).toEqual({});
    expect(stringsOf(["a", 2])).toEqual(["a"]);
    expect(text(3)).toBe("3");
    expect(text({})).toBe("");
    expect(omit({ a: 1, b: 2 }, ["b"])).toEqual({ a: 1 });
  });
});

describe("Rubriques de l'éditeur : saisie", () => {
  it("décrit le type, et la fiche affiche la description", async () => {
    const { user, panel } = await openRubric("Identité");
    await user.type(
      within(panel).getByLabelText(/^Description/),
      "  Coordonnées bancaires signées par la banque  ",
    );
    await save(user);
    expect(definition()["description"]).toBe("Coordonnées bancaires signées par la banque");

    cleanup();
    renderAt("/catalogue/types/RIB");
    expect(await screen.findByRole("heading", { name: "Description" })).toBeVisible();
    expect(screen.getByText("Coordonnées bancaires signées par la banque")).toBeVisible();
  });

  it("règle le stockage : emplacement, formats, taille et versions", async () => {
    const { user, panel } = await openRubric("Stockage");
    await user.type(within(panel).getByLabelText(/Emplacement de stockage/), "Identite");
    await user.type(within(panel).getByLabelText(/Taille maximale/), "5");
    await user.click(within(panel).getByRole("checkbox", { name: "PDF" }));
    await user.click(within(panel).getByRole("checkbox", { name: "Image JPEG" }));
    await user.click(within(panel).getByRole("checkbox", { name: "Image JPEG" }));
    await user.type(within(panel).getByLabelText("Autres formats"), "Text/CSV{Enter}");
    await user.click(within(panel).getByRole("button", { name: "Retirer text/csv" }));
    await user.type(within(panel).getByLabelText("Autres formats"), "text/plain");
    await user.click(within(panel).getByRole("button", { name: "Ajouter" }));
    await user.click(within(panel).getByRole("switch", { name: /Recompression/ }));
    await user.click(within(panel).getByRole("switch", { name: /Nouvelles versions/ }));
    await user.type(within(panel).getByLabelText(/Nombre maximal de versions/), "3");
    await save(user);

    expect(definition()).toMatchObject({
      storage: { bucket: "identite", lossyRecompression: true },
      maxSizeMb: 5,
      formats: ["application/pdf", "text/plain"],
      versioning: { allowed: true, max: 3 },
    });
  });

  it("règle les origines et les traitements, détection comprise", async () => {
    const { user, panel } = await openRubric("Traitements");
    await user.click(await within(panel).findByRole("checkbox", { name: "Entrée en relation" }));
    await user.type(within(panel).getByLabelText("Canaux de collecte"), "en ligne{Enter}");
    await user.click(within(panel).getByRole("switch", { name: /prospect/ }));
    await user.click(within(panel).getByRole("switch", { name: /OCR/ }));
    await user.selectOptions(within(panel).getByLabelText("Extraction de champs"), "MRZ");
    await user.click(within(panel).getByRole("switch", { name: /PDF\/A/ }));
    await user.click(within(panel).getByRole("switch", { name: "Détection du type" }));
    await user.type(within(panel).getByLabelText(/Mots-clés/), "carte nationale{Enter}");
    await user.type(within(panel).getByLabelText(/Code MRZ/), "id");
    await user.type(within(panel).getByLabelText(/Score minimal/), "0.8");
    await save(user);

    expect(definition()).toMatchObject({
      origins: { parcours: ["eer"], channels: ["EN_LIGNE"], prospect: true },
      processing: {
        ocr: true,
        extraction: "MRZ",
        pdfa: true,
        detection: { enabled: true, keywords: ["carte nationale"], mrz: "ID", minScore: 0.8 },
      },
    });
  });

  it("règle la visibilité, la réutilisation et la correspondance FileNet", async () => {
    const { user, panel } = await openRubric("Sensibilité et visibilité");
    await user.selectOptions(within(panel).getByLabelText(/Sensibilité/), "SENSIBLE");
    await user.click(within(panel).getByRole("switch", { name: /portefeuille client/ }));
    await user.click(within(panel).getByRole("switch", { name: /filiales/ }));
    await user.click(within(panel).getByRole("switch", { name: /Réutilisable/ }));
    await user.click(screen.getByRole("tab", { name: "FileNet" }));
    const filenet = screen.getByRole("tabpanel", { name: "FileNet" });
    await user.type(within(filenet).getByLabelText(/Classe documentaire/), "Kyc");
    await user.type(within(filenet).getByLabelText(/Valeur du type/), "RIB");
    await save(user);

    expect(definition()).toMatchObject({
      sensitivity: "SENSIBLE",
      visibility: { portfolio: true, subsidiaries: true },
      reuse: { allowed: true },
      filenet: { documentClass: "Kyc", typeValue: "RIB" },
    });
  });

  it("calcule la validité d'une durée, et change d'unité", async () => {
    const { user, panel } = await openRubric("Validité");
    await user.selectOptions(within(panel).getByLabelText("Expiration de la pièce"), "COMPUTED");
    await user.type(within(panel).getByLabelText("Durée de validité : nombre"), "3");
    await user.selectOptions(within(panel).getByLabelText("Durée de validité : unité"), "M");
    await save(user);
    expect(definition()["validity"]).toEqual({ expiresAt: "COMPUTED", duration: "P3M" });
  });

  it("choisit des termes du dictionnaire, les ordonne et signale ceux qui ne sont plus admis", async () => {
    const rib = stub.types.find((t) => t.code === "RIB")?.versions[0];
    if (!rib) throw new Error("RIB absent");
    rib.definition = {
      ...rib.definition,
      metadataSchema: {
        type: "object",
        properties: { inconnu: { type: "string" }, dateFin: { type: "string", format: "date" } },
      },
    };
    const { user, panel } = await openRubric("Métadonnées");
    expect(await within(panel).findByText("Hors dictionnaire")).toBeVisible();
    expect(within(panel).getByText("Déprécié")).toBeVisible();
    expect(
      within(panel).queryByRole("option", { name: /Date de fin/ }),
      "un terme déprécié n'est pas proposé",
    ).toBeNull();

    await user.click(within(panel).getByRole("button", { name: "Retirer inconnu" }));
    await user.click(within(panel).getByRole("button", { name: "Retirer Date de fin" }));
    const add = within(panel).getByRole("button", { name: "Ajouter" });
    expect(add).toBeDisabled();
    await user.selectOptions(
      within(panel).getByLabelText("Métadonnée du dictionnaire"),
      "paysEmission",
    );
    await user.click(add);
    await user.selectOptions(within(panel).getByLabelText("Métadonnée du dictionnaire"), "montant");
    await user.click(within(panel).getByRole("button", { name: "Ajouter" }));
    await user.click(within(panel).getByRole("button", { name: "Monter Montant" }));
    expect(within(panel).getByRole("button", { name: "Monter Montant" })).toBeDisabled();
    await user.click(within(panel).getByRole("button", { name: "Descendre Montant" }));
    const pays = within(panel).getByRole("listitem", { name: /Pays d'émission/ });
    expect(pays).toHaveTextContent("Liste de valeurs · valeurs : MAR, FRA, ESP");
    await user.click(within(pays).getByRole("switch", { name: "Obligatoire au dépôt" }));
    await save(user);

    expect(definition()["metadataSchema"]).toEqual({
      type: "object",
      required: ["paysEmission"],
      properties: {
        paysEmission: { type: "string", enum: ["MAR", "FRA", "ESP"], title: "Pays d'émission" },
        montant: { type: "number", minimum: 0, title: "Montant" },
      },
    });
  });
});
