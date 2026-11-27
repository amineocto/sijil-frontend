# 09 — Socle commun des fronts

Un seul front, **sijil-web**, servi par le BFF unique `sijil-bff` (ADR 0032) : documents (lot 4 et suivants) et catalogue des types sous `/catalogue` (lot 3, ancien `sijil-catalogue-web`). Il s'appuie sur `ui-kit/`.

## Principes

- Un front ne parle qu'à **son** BFF, sur la même origine (fichiers statiques servis par le BFF, API sous `/api`).
- Aucun jeton dans le navigateur ; l'authentification passe par la session du BFF (voir `05-securite.md`).
- Le front n'est pas une barrière de sécurité : il masque ce que l'utilisateur ne peut pas faire, et le BFF refuse.
- Français par défaut, textes externalisés (i18n prêt pour l'arabe : direction RTL prise en compte dans le thème) [P].

## Stack

| Besoin | Choix |
|---|---|
| Build | Vite, TypeScript `strict`, chemins absolus `@/` |
| Données serveur | TanStack Query (cache, invalidation, états de chargement) |
| Routage | React Router (routes déclaratives, chargement paresseux par page) |
| Formulaires | React Hook Form + Zod (schémas partagés avec la validation côté client) |
| Client HTTP | Généré depuis l'OpenAPI du BFF (`openapi-typescript` + `openapi-fetch`) ; jeton CSRF ajouté automatiquement |
| Composants | **`@awb/ui`**, charte et composants de la banque, avec Tailwind 4 (ADR 0037 ; remplace Mantine, DEC-18) ; jetons repris dans `@sijil/ui-kit` |
| Tests | Vitest + Testing Library (composants), MSW (bouchons réseau), Playwright (bout en bout contre le BFF en profil local), axe (accessibilité) |
| Qualité | ESLint (règles react-hooks et jsx-a11y), Prettier, `tsc --noEmit` en CI |

## Structure d'un front

```text
<front>/
  src/
    app/          routage, layout, fournisseurs (QueryClient, thème, i18n)
    features/     un dossier par fonctionnalité : pages, composants, hooks, schémas
    shared/       composants et hooks transverses du front
    api/          client généré, ne jamais éditer à la main
  e2e/            scénarios Playwright
```

Règle : une fonctionnalité n'importe pas une autre fonctionnalité. Ce qui est commun remonte dans `shared/` ou dans `ui-kit`.

## Exigences UX communes

- Chaque écran gère quatre états : chargement, vide, erreur (message lisible et `correlationId` affiché) et données.
- Les listes sont paginées par curseur (« Charger plus » ou défilement), avec filtres reflétés dans l'URL.
- Les actions destructives demandent une confirmation, et la suppression logique peut être annulée.
- Les formulaires valident en ligne et affichent les erreurs du serveur champ par champ (Problem Details `errors[]`).
- Accessibilité WCAG 2.1 AA : navigation clavier complète, focus visible, libellés, contrastes. Zéro violation axe sérieuse en CI.
- Performance : bundle initial inférieur à 250 Ko gzip, pages chargées à la demande.

## BFF (Spring Boot)

- Client OIDC confidentiel, session JDBC, CSRF, en-têtes de sécurité.
- Agrège et adapte : un endpoint par besoin d'écran, pas de proxy générique.
- Appelle les API de la plateforme avec son jeton applicatif et le contexte utilisateur.
- Contrat OpenAPI propre dans `contracts/<bff>.yaml` du dépôt **sijil-kit**, source du client TypeScript ; ce dépôt en garde une copie contrôlée (`npm run contract:check`).
