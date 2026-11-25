import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderAt } from "@/test/render";
import { stub } from "@/test/setup";
import { splitPeriod } from "./controls";
import { fieldsOf, formatOf, schemaOf, technicalName } from "./metadata";
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
  it("lit et écrit le schéma des métadonnées sans perdre ses attributs avancés", () => {
    const schema = {
      type: "object",
      $comment: "garder",
      required: ["code"],
      properties: {
        code: { type: "string", title: "Code", maxLength: 8, pattern: "^[A-Z]+$" },
        pays: { type: "string", enum: ["MA", "FR"] },
        montant: { type: "number" },
        pages: { type: "integer" },
        recto: { type: "boolean" },
      },
    };
    const fields = fieldsOf(schema);
    expect(fields.map((f) => f.format)).toEqual(["text", "enum", "number", "integer", "boolean"]);
    expect(fields[0]).toMatchObject({
      required: true,
      maxLength: "8",
      rest: { pattern: "^[A-Z]+$" },
    });
    expect(schemaOf(fields, schema)).toEqual(schema);
    expect(formatOf({ type: "string", format: "date" })).toBe("date");
    expect(technicalName("Numéro de la pièce")).toBe("numeroDeLaPiece");
    expect(technicalName("2024")).toBe("");
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

  it("décrit une liste de valeurs, une longueur, et retire une métadonnée", async () => {
    const { user, panel } = await openRubric("Métadonnées");
    await user.click(within(panel).getByRole("button", { name: "Ajouter une métadonnée" }));
    await user.click(within(panel).getByRole("button", { name: "Ajouter une métadonnée" }));
    const [first, second] = within(panel).getAllByRole("listitem", { name: /Métadonnée/ });
    if (!first || !second) throw new Error("métadonnées absentes");
    await user.type(within(first).getByLabelText("Libellé"), "Pays");
    await user.selectOptions(within(first).getByLabelText("Format"), "enum");
    await user.type(within(first).getByLabelText("Valeurs permises"), "MA{Enter}");
    await user.type(within(second).getByLabelText("Libellé"), "Référence");
    await user.type(within(second).getByLabelText("Longueur maximale"), "12");
    await user.clear(within(second).getByLabelText("Nom technique"));
    await user.type(within(second).getByLabelText("Nom technique"), "pays");
    expect(within(second).getByText("Ce nom technique est déjà pris")).toBeVisible();
    await user.clear(within(second).getByLabelText("Nom technique"));
    await user.type(within(second).getByLabelText("Nom technique"), "Ref");
    expect(within(second).getByText(/Une minuscule/)).toBeVisible();
    await user.click(within(second).getByRole("button", { name: /Supprimer la métadonnée/ }));
    await save(user);

    expect(definition()["metadataSchema"]).toEqual({
      type: "object",
      properties: { pays: { type: "string", enum: ["MA"], title: "Pays" } },
    });
  });
});
