import { document } from "@/mocks/data";
import { groupByFamily, typeLabel, validity } from "./dossier";
import { dossierPath, partyTypeOf } from "./paths";

const TODAY = new Date("2026-11-24T10:00:00Z");
const expiring = (date: string) => document("d", "eer", "STANDARD", { dateExpiration: date });

describe("Dossier : règles d'affichage", () => {
  it("lit la validité dans la date d'expiration, avec un seuil d'alerte à 30 jours", () => {
    expect(validity(expiring("2031-03-14"), TODAY)).toEqual({
      state: "VALIDE",
      until: "2031-03-14",
    });
    expect(validity(expiring("2026-12-15"), TODAY)).toEqual({
      state: "BIENTOT",
      until: "2026-12-15",
      days: 21,
    });
    expect(validity(expiring("2026-11-24"), TODAY).state).toBe("BIENTOT");
    expect(validity(expiring("2026-11-23"), TODAY)).toEqual({
      state: "EXPIREE",
      until: "2026-11-23",
    });
    expect(validity(document("d", "eer", "STANDARD", {}), TODAY).state).toBe("SANS_ECHEANCE");
    expect(validity(expiring("14/03/2031"), TODAY).state).toBe("SANS_ECHEANCE");
  });

  it("groupe par famille dans l'ordre du catalogue, inconnues et sans famille à la fin", () => {
    const docs = [
      { ...document("a", "eer", "STANDARD", {}), documentType: "OFFRE_PRET" },
      { ...document("b", "eer", "STANDARD", {}), documentType: "XYZ" },
      { ...document("c", "eer", "STANDARD", {}), documentType: "CIN" },
      { ...document("d", "eer", "STANDARD", {}), documentType: "LIBRE" },
    ];
    const types = {
      OFFRE_PRET: { label: "Offre de prêt", family: "CREDIT" },
      CIN: { label: "Carte d'identité nationale", family: "IDENTITE" },
      LIBRE: { label: "Libre", family: "PATRIMOINE" },
    };
    expect(groupByFamily(docs, types).map((g) => g.label)).toEqual([
      "Identité",
      "Crédit",
      "PATRIMOINE",
      "Autres documents",
    ]);
    expect(typeLabel("XYZ", types)).toBe("XYZ");
  });

  it("met la partie dans l'adresse du dossier et l'en relit", () => {
    expect(dossierPath("CLIENT", "CLI/42")).toBe("/dossiers/client/CLI%2F42");
    expect(partyTypeOf("personne")).toBe("PERSONNE");
    expect(partyTypeOf("inconnu")).toBeUndefined();
  });
});
