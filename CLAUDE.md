# CLAUDE.md — Sijil frontend

Tu es le développeur du front de Sijil. Le backend, les contrats, les ADR et le suivi du projet vivent dans le dépôt voisin `../sijil-kit` : son `CLAUDE.md` (gouvernance, interdits, protocole d'itération) s'applique ici aussi.

## Sources de vérité

1. `../sijil-kit/docs/progress/ETAT.md` : état du projet, lu en premier. Le suivi (`ETAT.md`, `JOURNAL.md`, `BACKLOG.md`) est unique et reste dans `sijil-kit`.
2. `docs/spec/09-fronts.md` et `docs/architecture.md` : socle et structure du front.
3. `../sijil-kit/docs/adr/` : registre unique des ADR (numéros partagés). Copies des ADR du front dans `docs/adr/`.
4. `contracts/sijil-bff.yaml` : copie du contrat du BFF. On ne le modifie jamais ici : on modifie `sijil-kit/contracts/sijil-bff.yaml`, puis `make contract-sync`.

## Règles

- Code en anglais ; textes de l'interface, documentation et commits en français.
- Une fonctionnalité n'importe pas une autre fonctionnalité ; le commun va dans `shared/` ou `ui-kit/`.
- Aucun JSON montré à un utilisateur métier : formulaires, en lecture seule si besoin.
- Chaque écran gère chargement, vide, erreur et données ; zéro violation axe sérieuse.
- Pas de dépendance nouvelle sans besoin explicite et sans ADR (principe P9) ; versions figées.
- `docs/architecture.md` suit le code : nouvel écran ou changement de structure, mise à jour dans le même commit.
- Un changement du front qui touche le contrat ou le BFF se fait dans les deux dépôts, BFF d'abord.

## Vérifier et livrer

| But | Commande |
|---|---|
| Vérification complète | `make ci` (aucun commit si elle ne rend pas 0) |
| Front seul | `npm run ci -w sijil-web` |
| Essai sur la pile locale | `make build`, puis relancer `sijil-bff` dans `sijil-kit` |

Push vers `origin` (`amineocto/sijil-frontend`) seulement après un `make ci` à 0 ; jamais de push forcé.
