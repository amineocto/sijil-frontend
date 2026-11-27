# 0040 — Icônes de l'interface avec `lucide-react`

Statut : acceptée
Date : 2026-11-27
Décisions liées : ADR 0037 (charte `@awb/ui`), principe P9 (pas de dépendance sans besoin)
Responsable de validation : responsable du projet
Validée par : responsable du projet, 2026-11-27 (« go avec lucide-react, écris l'ADR »)

## Contexte

Les écrans de Sijil n'avaient d'icônes que dans le menu latéral et quelques boutons. Ces icônes étaient dessinées à la main dans `src/shared/ui/icons.tsx` pour ne pas ajouter de dépendance (P9).

Le responsable du projet a demandé des icônes « pour plein d'aspects » : rubriques de l'éditeur, statuts, sensibilité, familles de pièces, états des documents, actions. Les dessiner une à une coûte du temps et donne un trait inégal.

`@awb/ui` embarque déjà `lucide-react` dans son paquet, sans l'exposer. Les composants de la charte ont donc déjà ce style d'icône.

## Décision

- `web/sijil-web` dépend de `lucide-react`, en version figée (`1.70.0`, sans `^`). Toute montée de version passe par une revue de la liste des icônes employées.
- Les icônes sont importées **une par une** (`import { Hourglass } from "lucide-react"`), pour que le bundle ne garde que celles utilisées.
- Les correspondances entre un code métier et son icône (rubrique, statut, sensibilité, famille, état d'un document) sont regroupées dans `src/shared/ui/icons.tsx`. Un écran ne choisit pas lui-même l'icône d'un statut.
- Une icône est décorative (`aria-hidden`) : le texte voisin, ou l'`aria-label` du bouton, porte le sens. Une icône seule ne remplace jamais un libellé.
- Les icônes dessinées à la main sont remplacées par leur équivalent `lucide-react`.

## Conséquences

- Une dépendance de plus dans le front, sans dépendance transitive, sous licence ISC. Elle est contrôlée par `npm audit` dans `make ci`, comme les autres.
- Le style des icônes de Sijil suit celui de la charte `@awb/ui`.
- Si la charte expose un jour ses icônes, Sijil pourra les importer depuis `@awb/ui` et retirer cette dépendance. Seul `icons.tsx` change.
