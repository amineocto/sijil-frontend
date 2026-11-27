import type { MetadataField } from "@/shared/metadata";
import {
  fileProblem,
  idProblem,
  isIsoDate,
  merged,
  metadataProblems,
  PARTY_ID,
  PARTY_ID_HINT,
  serverProblems,
  textProblem,
} from "@/shared/validation";

const field = (
  f: Partial<MetadataField> & Pick<MetadataField, "name" | "kind">,
): MetadataField => ({
  label: f.name,
  required: false,
  options: [],
  ...f,
});

describe("Contrôles du navigateur", () => {
  it("borne les textes", () => {
    expect(textProblem("", { required: true })).toBe("Obligatoire");
    expect(textProblem("  ", {})).toBeUndefined();
    expect(textProblem("ab", { min: 3 })).toBe("Au moins 3 caractères");
    expect(textProblem("abcd", { max: 3 })).toBe("3 caractères au plus");
    expect(textProblem("abc", { min: 3, max: 3 })).toBeUndefined();
  });

  it("contrôle les identifiants", () => {
    expect(idProblem("", PARTY_ID, { hint: PARTY_ID_HINT })).toBe("Obligatoire");
    expect(idProblem("", PARTY_ID, { required: false, hint: PARTY_ID_HINT })).toBeUndefined();
    expect(idProblem("C 12", PARTY_ID, { hint: PARTY_ID_HINT })).toBe(PARTY_ID_HINT);
    expect(idProblem(" C12 ", PARTY_ID, { hint: PARTY_ID_HINT })).toBeUndefined();
  });

  it("reconnaît une date du calendrier", () => {
    expect(isIsoDate("2030-02-28")).toBe(true);
    expect(isIsoDate("2030-02-30")).toBe(false);
    expect(isIsoDate("28/02/2030")).toBe(false);
  });

  it("applique le schéma de métadonnées du type", () => {
    const fields = [
      field({ name: "numero", kind: "text", required: true, pattern: "^[A-Z]{1,2}[0-9]{1,6}$" }),
      field({ name: "nom", kind: "text", minLength: 2, maxLength: 4 }),
      field({ name: "code", kind: "text", pattern: "^[0-9]+$" }),
      field({ name: "motif", kind: "text", pattern: "^(" }),
      field({ name: "date", kind: "date" }),
      field({ name: "montant", kind: "number", minimum: 1, maximum: 10 }),
      field({ name: "nombre", kind: "number", integer: true }),
      field({ name: "texte", kind: "number" }),
      field({ name: "canal", kind: "choice", options: ["AGENCE"] }),
      field({ name: "actif", kind: "boolean" }),
    ];
    expect(metadataProblems(fields, {})).toEqual({ numero: "Obligatoire" });
    expect(
      metadataProblems(fields, {
        numero: "h338225",
        nom: "a",
        code: " 12 ",
        motif: "x",
        date: "2030-13-01",
        montant: "0",
        nombre: "1.5",
        texte: "abc",
        canal: "WEB",
        actif: "true",
      }),
    ).toEqual({
      numero: "Lettres en majuscules attendues : H338225",
      nom: "Au moins 2 caractères",
      code: "Sans espace au début ni à la fin",
      date: "Date invalide",
      montant: "1 au moins",
      nombre: "Nombre entier attendu",
      texte: "Nombre attendu",
      canal: "Choisissez une valeur de la liste",
    });
    expect(metadataProblems(fields, { numero: "H3", nom: "abcde", montant: "11" })).toEqual({
      nom: "4 caractères au plus",
      montant: "10 au plus",
    });
    expect(metadataProblems(fields, { numero: "12" })).toEqual({
      numero: "Format incorrect pour ce champ",
    });
  });

  it("contrôle le fichier", () => {
    const pdf = new File(["%PDF"], "a.pdf", { type: "application/pdf" });
    expect(fileProblem(null, [], 5)).toBe("Choisissez un fichier");
    expect(fileProblem(pdf, ["image/png"], 5)).toBe("Format non admis pour ce type (PNG)");
    expect(fileProblem(new File([], "v.pdf", { type: "application/pdf" }), [], 5)).toBe(
      "Le fichier est vide",
    );
    const big = new File(["x"], "b.pdf", { type: "application/pdf" });
    Object.defineProperty(big, "size", { value: 6 * 1024 * 1024 });
    expect(fileProblem(big, ["application/pdf"], 5)).toBe("Fichier trop volumineux : 5 Mo au plus");
    expect(fileProblem(pdf, ["application/pdf"], 5)).toBeUndefined();
  });

  it("dit les refus du serveur sous le bon champ", () => {
    const server = serverProblems({
      "metadata/numero": ["PATTERN"],
      "parties/0/id": ["X_INCONNU"],
    });
    expect(server).toEqual({
      numero: ["Format incorrect pour ce champ"],
      "parties/0/id": ["X_INCONNU"],
    });
    expect(merged({ numero: "Obligatoire" }, server)["numero"]).toEqual([
      "Obligatoire",
      "Format incorrect pour ce champ",
    ]);
  });
});
