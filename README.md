# Sijil frontend

Front unique de **Sijil**, la plateforme documentaire d'AWB : recherche et dossiers clients, fiche document, dépôt, complétude, et catalogue des types (plan de classement, exigences, dictionnaire de métadonnées, revues, partage 360).

Le backend vit dans le dépôt voisin **[sijil-kit](https://github.com/amineocto/sijil)** : API, catalogue, worker et `admin-channel`, le BFF qui sert ce front et porte la session (ADR 0032).

```text
workspace-ged/
  sijil-kit/        backend (Java, Spring Boot), contrats OpenAPI, ADR, suivi du projet
  sijil-frontend/   ce dépôt
```

## Contenu

| Dossier | Rôle |
|---|---|
| `sijil-web/` | L'application React (Vite, TypeScript strict, TanStack Query, React Router, React Hook Form + Zod) |
| `ui-kit/` | `@sijil/ui-kit` : thème, composants d'état (chargement, vide, erreur), client HTTP avec CSRF, i18n |
| `vendor/` | Paquet `@awb/ui` construit depuis le dépôt de la banque, **jamais versionné** (ADR 0037, B-032) |
| `contracts/admin-channel.yaml` | Copie du contrat du BFF ; la source est `sijil-kit/contracts/admin-channel.yaml` |
| `docs/` | Documentation du front : architecture, socle commun, ADR propres au front |

## Démarrer

```bash
make awb-ui AWB_UI_SRC=<dépôt awb-ui>   # une fois : construit vendor/awb-ui-*.tgz
make install
make dev                                # http://localhost:5173, sur les bouchons MSW (aucune donnée réelle)
```

Contre la pile locale réelle (BFF, Keycloak, API), lancée depuis `sijil-kit` (`make up`, puis les applications) :

```bash
make dev-bff
```

## Commandes

| But | Commande |
|---|---|
| Vérification complète, identique à la CI | `make ci` |
| Vérification du front seul | `npm run ci -w sijil-web` |
| Mise en forme | `npm run format -w sijil-web` |
| Contrat du BFF changé dans `sijil-kit` | `make contract-sync` (recopie puis régénère `src/api/schema.d.ts`) |
| Build de production | `make build` |

## Lien avec le BFF

`admin-channel` embarque le build de ce dépôt (`sijil-web/dist`) dans ses ressources statiques. Il le lit dans `../sijil-frontend/sijil-web/dist` par défaut (propriété Maven `sijil.web.dist` dans `sijil-kit/channel/admin-channel/pom.xml`). Ordre de livraison : `make build` ici, puis le build du BFF dans `sijil-kit`.

## Documentation

- [docs/architecture.md](docs/architecture.md) : structure, écrans, données, tests.
- [docs/spec/09-fronts.md](docs/spec/09-fronts.md) : socle commun et exigences UX.
- [docs/adr/](docs/adr/README.md) : décisions propres au front. Le registre complet des ADR reste dans `sijil-kit/docs/adr`.
- [sijil-web/README.md](sijil-web/README.md) : BFF, session, écrans documents, scénario de bout en bout.
