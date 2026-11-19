# sijil-catalogue-web

Front du catalogue des types de documents (lot 3, **L3-09**) : liste des types, fiche d'un type, éditeur de brouillon et soumission. Socle : `docs/spec/09-fronts.md` ; composants **Mantine** (OQ-15 / DEC-18).

## Provisoire (lot 3A)

- **Pas de BFF** : `sijil-catalogue-bff` (L3-08) est en NO GO jusqu'à l'ADR 0011. Le front parle au contrat **provisoire** `contracts/sijil-catalogue-bff.yaml`, qui sera revu et figé en L3-08.
- **Authentification simulée** : `GET /api/session` renvoie une session de démonstration (bandeau « Authentification simulée (provisoire) » sur chaque écran). Aucune décision d'identité n'est prise ici (B-010).
- **Données de démonstration** : en développement, le BFF est remplacé par des bouchons MSW (`src/mocks`), qui ne contiennent aucun type réel de la banque. Le service worker de MSW (`public/`) n'est jamais livré dans le build de production.

## Commandes

| But                                                                                                     | Commande                                 |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Lancer en développement (bouchons MSW)                                                                  | `npm run dev -w web/sijil-catalogue-web` |
| Régénérer le client depuis le contrat                                                                   | `npm run api -w web/sijil-catalogue-web` |
| Vérification complète (contrat à jour, lint, format, types, tests et axe, build, budget de 250 Ko gzip) | `npm run ci -w web/sijil-catalogue-web`  |

## Écrans

| Écran                | Route                     | Ce qui est couvert                                                                                                                                                                                                                                                |
| -------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Liste des types      | `/`                       | Filtres (recherche, parcours, statut) reflétés dans l'URL, pagination par curseur (« Charger plus »), quatre états                                                                                                                                                |
| Fiche d'un type      | `/types/:code`            | Versions, motif de la dernière demande de modifications, différences entre deux versions par rubrique, nouvelle version                                                                                                                                           |
| Nouveau type         | `/types/nouveau`          | Code, parcours référent, libellé ; 409 sur un code existant                                                                                                                                                                                                       |
| Éditeur de brouillon | `/types/:code/brouillon`  | Rubriques en onglets (identité, métadonnées avec aperçu du formulaire généré, validité, rétention, stockage, traitements, sensibilité et visibilité, FileNet) ; validation en ligne ; enregistrement avec `If-Match` ; erreurs du serveur par champ ; 412 signalé |
| Soumission           | `/types/:code/soumission` | Contrôles du serveur, erreurs regroupées par rubrique                                                                                                                                                                                                             |

Limite assumée : hors identité et sensibilité, les rubriques se saisissent en JSON (validé en ligne). Des formulaires dédiés par rubrique pourront suivre quand la définition sera stabilisée (L3-13, ADR 0013 pour la rétention).
