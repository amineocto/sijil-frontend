# Architecture du front

> À maintenir : tout nouvel écran, toute nouvelle fonctionnalité ou tout changement de structure met ce document à jour dans le même commit.

## Vue d'ensemble

```text
Navigateur ── même origine ──> sijil-bff (sijil-kit) ──> sijil-api, sijil-catalogue, vision360-api
   │                              │
   │  fichiers statiques          └─ session OIDC (Keycloak), CSRF, en-têtes de sécurité
   └─ /api/* (JSON)
```

- Le front ne parle qu'à `sijil-bff`, sur la même origine. Aucun jeton dans le navigateur : la session est celle du BFF, un 401 relance la connexion.
- Le front n'est pas une barrière de sécurité : il masque ce que l'utilisateur ne peut pas faire, le BFF refuse.
- Seul l'envoi d'un fichier va directement au stockage, par l'URL présignée d'une session de dépôt (quarantaine, 5 minutes).

## Structure

```text
sijil-web/src/
  app/          routes (routes.tsx), Layout (menu, en-tête, visite guidée), styles globaux
  api/          schema.d.ts, généré depuis contracts/sijil-bff.yaml : ne jamais éditer
  features/     une fonctionnalité par dossier, qui n'importe pas une autre fonctionnalité
  shared/       transverse : client API, session et profils, libellés, champs, ui/ (composants, icônes)
  mocks/        bouchons MSW du BFF (développement et tests)
  test/         rendu de test, serveur MSW, contrôle axe
ui-kit/src/     @sijil/ui-kit : thème, états, client HTTP et ApiError, i18n
```

## Écrans

| Route | Fonctionnalité | Contenu |
|---|---|---|
| `/`, `/recherche` | `search` | Recherche d'un client, d'une personne ou d'un compte |
| `/recherche/plein-texte` | `search` | Recherche plein texte |
| `/recherche/completude`, `/dossiers/:type/:id/completude` | `completeness` | Complétude d'un dossier face à un jeu d'exigences |
| `/dossiers/:type/:id` | `dossier` | Documents d'une partie, par famille |
| `/depot` | `deposit` | Dépôt : type, métadonnées générées depuis le schéma, fichier, quarantaine |
| `/documents/:id` | `document` | Fiche, aperçu, versions, historique, actions ; finalité et bris de glace |
| `/catalogue` | `catalogue/types-list` | Types de document |
| `/catalogue/types/nouveau`, `/catalogue/types/:code` | `catalogue/type-sheet` | Fiche d'un type : définition en lecture, versions, différences champ par champ |
| `/catalogue/types/:code/brouillon` | `catalogue/draft-editor` | Éditeur par rubriques (formulaires, aucun JSON) |
| `/catalogue/types/:code/soumission` | `catalogue/submission` | Contrôles et envoi en revue |
| `/catalogue/revues`, `…/versions/:v/revue` | `catalogue/review` | File et revue d'une version |
| `/catalogue/exigences…` | `catalogue/requirements` | Jeux d'exigences en formulaire |
| `/catalogue/dictionnaire` | `catalogue/dictionary` | Dictionnaire de métadonnées (Data Office ; lecture pour les autres) |
| `/catalogue/partage` | `catalogue/sharing` | Partage des types au portefeuille 360 (administration de domaine) |

La visite guidée (`features/tour`) présente les écrans selon le profil de l'utilisateur.

## Données

- **TanStack Query** pour tout appel au BFF. Clés de cache nommées par ressource (`["editor", code]`, `["requirement-sets"]`…) ; une écriture invalide les clés concernées.
- **Client** : `openapi-fetch` typé par `src/api/schema.d.ts`. `call()` (`shared/api.ts`) transforme une réponse en échec en `ApiError` (statut, message, `correlationId`, erreurs par champ).
- **États** : `QueryState` rend chargement, erreur (avec référence) et, sur demande, un affichage dédié au 404.
- **Concurrence** : écritures avec `If-Match` (ETag) ; un 412 est expliqué à l'utilisateur.
- **Formulaires** : React Hook Form et Zod ; les erreurs du serveur (`errors[].field`, pointeur JSON) sont rattachées au champ.

## Interface

- Composants et charte **`@awb/ui`** (ADR 0037), Tailwind 4.
- Icônes **`lucide-react`** (ADR 0040) ; les correspondances entre un code métier et son icône sont dans `shared/ui/icons.tsx`.
- Lecture seule : les mêmes formulaires que l'édition, dans un `fieldset` désactivé. Les contrôles d'édition y sont masqués (`in-[fieldset:disabled]:hidden`) ; les onglets restent hors du `fieldset`.

## Tests

| Niveau | Outil | Où |
|---|---|---|
| Composants et écrans | Vitest, Testing Library, MSW | `*.test.ts(x)` à côté du code ; couverture des branches ≥ 80 % |
| Accessibilité | axe | dans les tests d'écran (`seriousViolations`) et en Playwright |
| Bout en bout | Playwright sur le serveur de développement et MSW | `sijil-web/e2e` |
| Budget | `scripts/check-bundle-size.mjs` | bundle initial < 250 Ko gzip |

L'essai contre le BFF réel et Keycloak reste une validation manuelle ou de niveau B (B-015, B-021).
