# Architecture du front

> À maintenir : tout nouvel écran, toute nouvelle fonctionnalité ou tout changement de structure met ce document à jour dans le même commit.

## Vue d'ensemble

```text
Navigateur ── même origine ──> admin-channel (sijil-kit) ──> sijil-api, sijil-catalogue, vision360-api
   │                              │
   │  fichiers statiques          └─ session OIDC (Keycloak), CSRF, en-têtes de sécurité
   └─ /api/* (JSON)
```

- Le front ne parle qu'à `admin-channel`, sur la même origine. Aucun jeton dans le navigateur : la session est celle du BFF, un 401 relance la connexion.
- Le front n'est pas une barrière de sécurité : il masque ce que l'utilisateur ne peut pas faire, le BFF refuse.
- Seul l'envoi d'un fichier va directement au stockage, par l'URL présignée d'une session de dépôt (quarantaine, 5 minutes).

## Structure

```text
sijil-web/src/
  app/          routes (routes.tsx), Layout (menu, en-tête, visite guidée), styles globaux
  api/          schema.d.ts, généré depuis contracts/admin-channel.yaml : ne jamais éditer
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

Une adresse inconnue affiche « Page introuvable » dans la coquille (`app/NotFoundPage.tsx`). Un écran qui échoue au rendu ou au chargement affiche `app/RouteError.tsx`, avec « Recharger la page », à la place de l'écran par défaut du routeur.

**Dossiers récemment ouverts** (`shared/recentDossiers.ts`) : gardés par utilisateur, dans le stockage de session du navigateur seulement, et effacés à la déconnexion. Ce sont des identifiants de clients : rien n'en est écrit dans le stockage durable.

## Données

- **TanStack Query** pour tout appel au BFF. Clés de cache nommées par ressource (`["editor", code]`, `["requirement-sets"]`…) ; une écriture invalide les clés concernées.
- **Clés de cache** : une ressource, une clé. Les deux ressources d'un type ont chacune la leur dans `shared/queryKeys.ts` : la fiche du catalogue (`/api/types/{code}`) et le type publié servi au dépôt (`/api/document-types/{code}`). Une revue approuvée invalide les deux.
- **Client** : `openapi-fetch` typé par `src/api/schema.d.ts`. `call()` (`shared/api.ts`) transforme une réponse en échec en `ApiError` (statut, message, `correlationId`, erreurs par champ).
- **États** : `QueryState` rend chargement, erreur (avec référence) et, sur demande, un affichage dédié au 404.
- **Concurrence** : écritures avec `If-Match` (ETag) ; un 412 est expliqué à l'utilisateur.
- **Formulaires** : tout ce que le navigateur peut contrôler l'est **avant l'envoi**, avec les règles du serveur : contrats du BFF et de `sijil-api`, schéma de métadonnées du type, schéma de définition d'un type (`draft-editor/definitionChecks.ts`). Rien n'est envoyé, aucun fichier compris, tant qu'un champ est signalé. Les contrôles communs sont dans `shared/validation.ts`. Les formulaires désactivent la validation native du navigateur (`noValidate`) pour afficher leurs propres messages en français.
- **Formulaire refusé** : `shared/refusedSubmit.tsx` annonce le nombre de champs à corriger (`role="alert"`) et place le focus sur le premier champ en erreur. Tous les formulaires l'emploient.
- **Actions irréversibles** : retirer un terme, publier un jeu d'exigences et publier une version de type passent par `ConfirmDialog` (`shared/ui`), qui dit la conséquence. Une publication est impossible tant que le formulaire a des modifications non enregistrées, et la revue ne présélectionne aucune décision.
- **Dossier volumineux** : au-delà de 200 documents chargés, le dossier affiche un avertissement et le compteur porte un « + ».
- **Refus du serveur** : il reste juge. Ses erreurs (`errors[].field`, pointeur JSON, par exemple `metadata/numero`) sont rattachées au champ, et leurs codes traduits en phrases (`serverProblems`).
- **Aperçu** : un PDF ou une image s'affiche dès l'ouverture d'un document. Un autre format attend un clic, car il se télécharge.

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
