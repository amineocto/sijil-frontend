# sijil-catalogue-web

Front du catalogue des types de documents (lot 3, **L3-09**, sous-lot **3B**) : liste des types, fiche d'un type, éditeur de brouillon, soumission, file de revue, revue et réutilisation. Socle : `docs/spec/09-fronts.md` ; composants **Mantine** (OQ-15 / DEC-18).

## BFF et session (sous-lot 3B)

- Le front parle à `sijil-catalogue-bff` (contrat `contracts/sijil-catalogue-bff.yaml`, 1.0.0) sur la même origine : connexion OIDC par le BFF, un 401 relance la connexion, « Se déconnecter » close la session du BFF puis celle de l'IdP. Aucun jeton dans le navigateur.
- **Données de démonstration** : en développement et dans les tests, le BFF est remplacé par des bouchons MSW (`src/mocks`), sans aucun type réel de la banque ; `?demo=reviseur` ou `?demo=contributeur` change d'utilisateur. Le service worker de MSW (`public/`) n'est jamais livré dans le build de production.

## Commandes

| But                                                                                                     | Commande                                 |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Lancer en développement (bouchons MSW)                                                                  | `npm run dev -w web/sijil-catalogue-web` |
| Régénérer le client depuis le contrat                                                                   | `npm run api -w web/sijil-catalogue-web` |
| Vérification complète (contrat à jour, lint, format, types, tests et axe, build, budget de 250 Ko gzip) | `npm run ci -w web/sijil-catalogue-web`  |

## Écrans

| Écran                | Route                                  | Ce qui est couvert                                                                                                                                                                                                                                                |
| -------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Liste des types      | `/`                                    | Filtres (recherche, parcours, statut) reflétés dans l'URL, pagination par curseur (« Charger plus »), quatre états                                                                                                                                                |
| Fiche d'un type      | `/types/:code`                         | Versions, motif de la dernière demande de modifications, différences entre deux versions par rubrique, nouvelle version                                                                                                                                           |
| Nouveau type         | `/types/nouveau`                       | Code, parcours référent, libellé ; 409 sur un code existant                                                                                                                                                                                                       |
| Éditeur de brouillon | `/types/:code/brouillon`               | Rubriques en onglets (identité, métadonnées avec aperçu du formulaire généré, validité, rétention, stockage, traitements, sensibilité et visibilité, FileNet) ; validation en ligne ; enregistrement avec `If-Match` ; erreurs du serveur par champ ; 412 signalé |
| Soumission           | `/types/:code/soumission`              | Contrôles du serveur, erreurs regroupées par rubrique                                                                                                                                                                                                             |
| File de revue        | `/revues`                              | Versions en revue (réviseurs)                                                                                                                                                                                                                                     |
| Revue                | `/types/:code/versions/:version/revue` | Différences avec la version publiée ; approbation avec date d'effet ou demande de modifications avec motif ; refus des quatre yeux et 412 signalés                                                                                                                |
| Réutilisation        | fiche du type                          | Parcours qui réutilisent le type ; déclaration avec finalité (journalisée, sans approbation)                                                                                                                                                                      |

Limite assumée : hors identité et sensibilité, les rubriques se saisissent en JSON (validé en ligne). Des formulaires dédiés par rubrique pourront suivre quand la définition sera stabilisée (L3-13, ADR 0013 pour la rétention).

## Scénario de bout en bout (L3B-04)

`npm run e2e -w web/sijil-catalogue-web` (inclus dans `npm run ci`) : Playwright sur le serveur de
développement et les bouchons MSW ; un contributeur enregistre et soumet le brouillon de `CIN`, un
réviseur (`?demo=reviseur`) l'approuve, le type est publié ; axe sur chaque écran, contraste compris.
Navigateur requis une fois par poste ou agent de CI : `npx playwright install chromium`.

Avec le BFF réel : `VITE_MOCKS=false npm run dev -w web/sijil-catalogue-web` (proxy vers
`http://localhost:8083`, ou `CATALOGUE_BFF_URL`) ; non essayé de bout en bout avec Keycloak (B-015).
