import { definitionProblems } from "@/features/catalogue/draft-editor/definitionChecks";

describe("Contrôles de forme d'une définition", () => {
  it("accepte une définition bien formée", () => {
    expect(
      definitionProblems({
        labels: { fr: "Carte d'identité" },
        retention: { duration: "P10Y", coldAfter: "P2Y", legalBasis: "Loi 43-05" },
        storage: { bucket: "eer" },
        formats: ["application/pdf"],
        maxSizeMb: 10,
        origins: { channels: ["AGENCE"], parcours: ["eer"] },
        processing: { detection: { minScore: 0.8, keywords: ["CIN"], mrz: "ID" } },
        filenet: { documentClass: "PieceIdentite", typeValue: "CIN" },
      }),
    ).toEqual([]);
  });

  it("nomme chaque champ mal formé", () => {
    expect(
      definitionProblems({
        labels: { fr: "" },
        retention: { duration: "10 ans", policy: "kyc", legalBasis: "ok" },
        storage: { bucket: "EER" },
        versioning: { max: 2.5 },
        maxSizeMb: 0,
        formats: ["pdf"],
        origins: { channels: ["agence"], parcours: ["EER"] },
        processing: { detection: { minScore: 2, keywords: ["x"], mrz: "id" } },
        filenet: { documentClass: "1x", typeValue: "a'b" },
      }).map((p) => p.pointer),
    ).toEqual([
      "/labels/fr",
      "/retention/policy",
      "/retention/duration",
      "/retention/legalBasis",
      "/storage/bucket",
      "/versioning/max",
      "/maxSizeMb",
      "/processing/detection/minScore",
      "/processing/detection/mrz",
      "/filenet/documentClass",
      "/filenet/typeValue",
      "/formats",
      "/origins/channels",
      "/origins/parcours",
      "/processing/detection/keywords",
    ]);
  });
});
