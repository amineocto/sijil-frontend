import {
  canAdministerSharing,
  canBreakGlass,
  canContribute,
  canContributeToCatalogue,
  canReview,
  canSeeCatalogue,
  type Session,
} from "@/shared/session";

/** Étape de la visite : l'élément montré (attribut `data-tour`), un titre et une explication. */
export interface TourStep {
  target: string;
  title: string;
  body: string;
  /** Bulle au centre de l'écran (accueil) plutôt qu'à côté de l'élément. */
  centered?: boolean;
  /** Bulle sous l'élément (en-tête) plutôt qu'à sa droite (menu latéral). */
  below?: boolean;
}

/** Sélecteur de l'élément d'une étape. */
export function tourSelector(target: string): string {
  return `[data-tour="${target}"]`;
}

/** Profil en clair, tel que la visite le présente. */
export function profileLabel(session: Session): string {
  const parcours = session.parcours.join(", ");
  const roles: string[] = [];
  const documents = canContribute(session);
  const catalogue = canContributeToCatalogue(session);
  if (documents && catalogue)
    roles.push(`contributeur du parcours ${parcours} (documents et catalogue)`);
  else if (documents) roles.push(`contributeur des documents du parcours ${parcours}`);
  else if (catalogue) roles.push(`rédacteur du catalogue pour le parcours ${parcours}`);
  if (canReview(session)) roles.push("réviseur du catalogue");
  if (canAdministerSharing(session)) roles.push(`administrateur du domaine ${parcours}`);
  if (roles.length === 0) roles.push("lecteur");
  if (canBreakGlass(session)) roles.push("habilité au bris de glace");
  return roles.join(", ");
}

/**
 * Étapes de la visite guidée pour le profil connecté : les mêmes règles que le menu, pour ne
 * montrer que les écrans ouverts à l'utilisateur. Affichage seulement : chaque service revérifie
 * les droits.
 */
export function tourSteps(session: Session): TourStep[] {
  const steps: TourStep[] = [
    {
      target: "accueil",
      centered: true,
      title: "Bienvenue dans Sijil",
      body: `Sijil est la plateforme documentaire de la banque : chaque document y est classé par type, rattaché à ses clients, conservé selon sa règle de rétention et tracé. Cette visite présente les écrans ouverts à votre profil : ${profileLabel(session)}.`,
    },
    {
      target: "recherche-globale",
      below: true,
      title: "Ouvrir un dossier",
      body:
        "Saisissez l'identifiant d'un client, d'une personne ou d'un compte : son dossier regroupe ses pièces par famille avec leur validité, vérifie sa complétude, et ouvre la fiche de chaque document en volet. Un document d'un autre parcours demande une finalité, enregistrée." +
        (canBreakGlass(session)
          ? " Les documents restreints demandent en plus un motif de bris de glace, tracé et contrôlé."
          : ""),
    },
    {
      target: "nav-recherche",
      title: "Rechercher",
      body: "Trois façons de chercher : le dossier d'une partie, le plein texte dans le contenu des documents, et la complétude d'un dossier à plusieurs parties face à un jeu d'exigences.",
    },
  ];
  if (canContribute(session)) {
    steps.push({
      target: "nav-depot",
      title: "Déposer un document",
      body: "Choisissez un type publié, renseignez ses métadonnées et son titulaire, puis envoyez le fichier. Il passe d'abord en quarantaine (antivirus, format, empreinte) ; il devient consultable dès son admission. Depuis la fiche, vous corrigez les métadonnées ou ajoutez une version.",
    });
  }
  if (canSeeCatalogue(session)) {
    steps.push({
      target: "nav-catalogue",
      title: "Catalogue des types",
      body: canContributeToCatalogue(session)
        ? "Chaque type de document décrit ses métadonnées, sa durée de conservation, sa sensibilité et son stockage. Vous rédigez une nouvelle version, la soumettez aux contrôles, puis un réviseur la publie : personne ne publie seul son propre travail."
        : "Chaque type de document décrit ses métadonnées, sa durée de conservation, sa sensibilité et son stockage. Vous y consultez les versions publiées et leur historique.",
    });
    steps.push({
      target: "nav-exigences",
      title: "Exigences documentaires",
      body: "Un jeu d'exigences liste les pièces attendues pour un dossier (par exemple une pièce d'identité valide du titulaire). Son simulateur montre ce qui manquerait à un client avant toute publication.",
    });
  }
  if (canReview(session)) {
    steps.push({
      target: "nav-revues",
      title: "File de revue",
      body: "Les versions soumises attendent votre décision : approuver avec une date d'effet, ou demander des modifications avec un motif. Vous publiez aussi les jeux d'exigences rédigés par les parcours.",
    });
  }
  if (canAdministerSharing(session)) {
    steps.push({
      target: "nav-partage",
      title: "Partage 360",
      body: "Choisissez les types de votre parcours qui apparaissent dans le portefeuille client 360. Le partage n'abaisse jamais la protection d'un document : chaque lecteur reste soumis à ses droits sur sa sensibilité.",
    });
  }
  steps.push(
    {
      target: "menu",
      title: "Réduire le menu",
      body: "Cette bascule replie le menu pour gagner de la place : il ne garde que ses icônes, et votre choix est mémorisé dans ce navigateur.",
    },
    {
      target: "utilisateur",
      title: "Votre profil",
      body: "Votre matricule et vos parcours. Le menu suit vos droits ; chaque service les vérifie à nouveau à chaque demande, et chaque consultation est tracée.",
    },
    {
      target: "visite",
      title: "Revoir la visite",
      body: "Relancez cette visite à tout moment depuis ce bouton, sous votre profil.",
    },
  );
  return steps;
}
