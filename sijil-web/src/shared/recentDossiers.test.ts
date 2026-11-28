import { forgetRecentDossiers, recentDossiers, rememberDossier } from "@/shared/recentDossiers";

describe("Dossiers récemment ouverts", () => {
  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it("ne montre à un utilisateur que les dossiers qu'il a ouverts lui-même", () => {
    rememberDossier("T00002", "CLIENT", "C123456");
    rememberDossier("T00009", "COMPTE", "CPT-7");

    expect(recentDossiers("T00002").map((r) => r.id)).toEqual(["C123456"]);
    expect(recentDossiers("T00009").map((r) => r.id)).toEqual(["CPT-7"]);
  });

  it("ne retient rien tant que l'utilisateur n'est pas connu", () => {
    rememberDossier(undefined, "CLIENT", "C123456");

    expect(recentDossiers(undefined)).toEqual([]);
    expect(sessionStorage).toHaveLength(0);
  });

  it("garde les six derniers, le plus récent d'abord, sans doublon", () => {
    for (const id of ["1", "2", "3", "4", "5", "6", "7", "3"]) {
      rememberDossier("T00002", "CLIENT", id);
    }

    expect(recentDossiers("T00002").map((r) => r.id)).toEqual(["3", "7", "6", "5", "4", "2"]);
  });

  it("ne garde rien après la fermeture du navigateur ni dans le stockage partagé", () => {
    localStorage.setItem("sijil-dossiers-recents", JSON.stringify([{ type: "CLIENT", id: "X" }]));

    rememberDossier("T00002", "CLIENT", "C123456");

    expect(localStorage.getItem("sijil-dossiers-recents")).toBeNull();
    expect(Object.keys(localStorage)).toEqual([]);
  });

  it("oublie tous les dossiers à la déconnexion", () => {
    rememberDossier("T00002", "CLIENT", "C123456");
    rememberDossier("T00009", "COMPTE", "CPT-7");

    forgetRecentDossiers();

    expect(recentDossiers("T00002")).toEqual([]);
    expect(recentDossiers("T00009")).toEqual([]);
  });

  it("ignore un contenu illisible ou étranger", () => {
    sessionStorage.setItem("sijil-dossiers-recents:T00002", "{pas du json");
    expect(recentDossiers("T00002")).toEqual([]);

    sessionStorage.setItem(
      "sijil-dossiers-recents:T00002",
      JSON.stringify([{ type: "AUTRE", id: "1" }, "texte", { type: "CLIENT", id: "C1" }]),
    );
    expect(recentDossiers("T00002").map((r) => r.id)).toEqual(["C1"]);
  });
});
