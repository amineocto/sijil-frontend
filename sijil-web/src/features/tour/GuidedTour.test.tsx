import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DATA_OFFICE, DOMAIN_ADMIN, REVIEWER } from "@/mocks/catalogue-data";
import { CONTRIBUTOR, READER } from "@/mocks/data";
import { renderAt, seriousViolations } from "@/test/render";
import { stub } from "@/test/setup";
import { hasSeenTour, tourSettings } from "./seen";
import { profileLabel, tourSteps } from "./steps";

const targets = (session: Parameters<typeof tourSteps>[0]) =>
  tourSteps(session).map((s) => s.target);

describe("Visite guidée", () => {
  afterEach(() => {
    localStorage.clear();
    tourSettings.autoStart = false;
  });

  it("ne présente que les écrans ouverts au profil connecté", () => {
    expect(targets(READER)).toEqual([
      "accueil",
      "recherche-globale",
      "nav-recherche",
      "nav-catalogue",
      "nav-exigences",
      "menu",
      "utilisateur",
      "visite",
    ]);
    expect(targets(CONTRIBUTOR)).toContain("nav-depot");
    expect(targets(CONTRIBUTOR)).not.toContain("nav-revues");
    expect(targets(REVIEWER)).toContain("nav-revues");
    expect(targets(REVIEWER)).not.toContain("nav-depot");
    expect(targets(DOMAIN_ADMIN)).toContain("nav-partage");
    expect(targets(DATA_OFFICE)).toContain("nav-dictionnaire");
    expect(targets(REVIEWER)).not.toContain("nav-dictionnaire");
    expect(profileLabel(DATA_OFFICE)).toBe("Data Office");
    expect(profileLabel(CONTRIBUTOR)).toBe("contributeur du parcours eer (documents et catalogue)");
    expect(profileLabel({ ...CONTRIBUTOR, roles: ["catalogue-contributeur"] })).toBe(
      "rédacteur du catalogue pour le parcours eer",
    );
    expect(profileLabel(READER)).toBe("lecteur");
    expect(profileLabel({ ...READER, roles: [...READER.roles, "sijil-bris-de-glace"] })).toBe(
      "lecteur, habilité au bris de glace",
    );
  });

  it("se lance depuis le menu, avance étape par étape et se ferme, sans violation axe", async () => {
    stub.session = CONTRIBUTOR;
    const user = userEvent.setup();
    const { container } = renderAt("/");

    await user.click(await screen.findByRole("button", { name: "Visite guidée" }));
    const dialog = await screen.findByRole("dialog", { name: "Bienvenue dans Sijil" });
    expect(dialog).toHaveTextContent("contributeur du parcours eer");
    expect(dialog).toHaveTextContent(`étape 1 sur ${String(tourSteps(CONTRIBUTOR).length)}`);
    expect(within(dialog).getByRole("button", { name: "Suivant" })).toHaveFocus();
    expect(await seriousViolations(container.ownerDocument.body)).toEqual([]);

    await user.click(within(dialog).getByRole("button", { name: "Suivant" }));
    expect(await screen.findByRole("dialog", { name: "Ouvrir un dossier" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Suivant" }));
    expect(await screen.findByRole("dialog", { name: "Rechercher" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Suivant" }));
    expect(await screen.findByRole("dialog", { name: "Déposer un document" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Précédent" }));
    expect(await screen.findByRole("dialog", { name: "Rechercher" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Fermer la visite" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(hasSeenTour(CONTRIBUTOR.user)).toBe(true);
  });

  it("s'ouvre d'elle-même à la première connexion seulement", async () => {
    tourSettings.autoStart = true;
    stub.session = DOMAIN_ADMIN;
    const user = userEvent.setup();
    const first = renderAt("/");

    const dialog = await screen.findByRole("dialog", { name: "Bienvenue dans Sijil" });
    expect(dialog).toHaveTextContent("administrateur du domaine eer");
    await user.click(within(dialog).getByRole("button", { name: "Passer la visite" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    first.unmount();

    renderAt("/");
    expect(await screen.findByRole("button", { name: "Visite guidée" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
