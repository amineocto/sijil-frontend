# sijil-web

Sijil web (sous-lot **4E**, L4E-03 à L4E-05) : recherche, fiche document, dépôt, nouvelle version et actions sur les documents Sijil, en remplacement des usages ciblés de Content Navigator. Socle : `docs/spec/09-fronts.md` ; composants et charte **`@awb/ui`** de la banque, mise en page Tailwind, coquille du poste CRC (ADR 0037). `@awb/ui` est construit en local tant que le Nexus interne est injoignable : `make awb-ui AWB_UI_SRC=<dépôt awb-ui>` avant `npm ci`.

## BFF et session

- Le front parle à `admin-channel` (contrat `contracts/admin-channel.yaml` (copie du dépôt sijil-kit)) sur la même origine : connexion OIDC par le BFF, un 401 relance la connexion, « Se déconnecter » close la session du BFF puis celle de l'IdP. Aucun jeton dans le navigateur.
- L'aperçu est lu par le BFF (jamais d'URL présignée de lecture côté navigateur) puis affiché depuis la mémoire du navigateur. Seul l'envoi d'un fichier va directement vers la quarantaine, par l'URL présignée de la session (un objet, 5 minutes).
- La finalité (document d'un autre parcours) et le motif de bris de glace (document restreint) sont saisis par l'utilisateur et relayés en en-têtes, jamais dans l'adresse.
- **Données de démonstration** : en développement et dans les tests, le BFF est remplacé par des bouchons MSW (`src/mocks`), sans aucune donnée réelle ; `?demo=lecteur` change d'utilisateur. Le service worker de MSW (`public/`) n'est jamais livré dans le build de production.

## Commandes

| But                                                                                           | Commande                   |
| --------------------------------------------------------------------------------------------- | -------------------------- |
| Lancer en développement (bouchons MSW)                                                        | `npm run dev -w sijil-web` |
| Régénérer le client depuis le contrat                                                         | `npm run api -w sijil-web` |
| Vérification complète (contrat, lint, format, types, tests et axe, build, budget, Playwright) | `npm run ci -w sijil-web`  |

Avec le BFF réel : `VITE_MOCKS=false npm run dev -w sijil-web` (proxy vers `SIJIL_BFF_URL`, par défaut `http://localhost:8082`, lancé par `make run-admin-channel`).

## Écrans

| Écran          | Route            | Ce qui est couvert                                                                                                                   |
| -------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Recherche      | `/`              | Client, personne ou compte, type ; finalité et motif de bris de glace ; quatre états                                                 |
| Fiche document | `/documents/:id` | Métadonnées, parties, aperçu PDF et image, versions, historique des métadonnées, usages ; finalité demandée sur refus                |
| Dépôt          | `/depot`         | Type publié, formulaire généré depuis le schéma, titulaire, fichier (format, taille), progression, suivi de la quarantaine           |
| Actions        | fiche document   | Modifier les métadonnées (motif, `If-Match`, erreurs par champ, 412), nouvelle version, suppression logique avec motif, restauration |

Limites assumées (fiche `docs/spec/lots/lot-4E-bff-sijil-web.md`) : documents Sijil seulement (recherche toutes sources hors périmètre, B-014) ; un seul titulaire au dépôt.

## Scénario de bout en bout (L4E-05)

`npm run e2e -w sijil-web` (inclus dans `npm run ci`) : Playwright sur le serveur de développement et les bouchons MSW ; un contributeur dépose une carte d'identité, le document passe la quarantaine, s'ouvre et se retrouve dans la recherche ; axe sur chaque écran, contraste compris. L'essai avec le BFF réel, Keycloak et le stockage est une validation de niveau B (B-021).
