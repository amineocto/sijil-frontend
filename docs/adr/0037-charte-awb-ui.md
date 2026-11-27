# 0037 — Front : charte et composants AWB (`@awb/ui`) à la place de Mantine

Statut : acceptée
Validée par : responsable du projet, 2026-11-24 (« Oui, accepter »)
Date : 2026-11-24
Décisions liées : DEC-18 (Mantine), FRT-04, OQ-15, ADR 0032 (front unique), 09-fronts.md
Responsable de validation : responsable du projet

## Contexte

Le 2026-11-23, le responsable du projet a demandé que Sijil web ait le même aspect que les autres applications de la banque : « utilise les mêmes composants et la même approche, la même charte […] le même look and feel ». Il a fourni deux références :

- **`@awb/ui` 1.3.0** : la bibliothèque de composants React de la banque (Storybook, Tailwind, `class-variance-authority`) ;
- **le poste de travail CRC** : une application qui l'utilise, avec une barre latérale, un fond gris clair, des cartes blanches et des tableaux à en-tête gris.

FRT-04 prévoyait déjà ce cas : « celle de l'application d'administration React existante si elle est réutilisable, sinon Mantine ». DEC-18 avait retenu Mantine faute de bibliothèque interne disponible.

`@awb/ui` n'est publiée que sur le Nexus interne de la banque, injoignable depuis le poste de développement.

## Décision

1. **Composants et charte.** Sijil web utilise `@awb/ui` (boutons, champs, cases, boutons radio, alertes, étiquettes, avatar), sa feuille de style et ses jetons de couleur, avec Tailwind 4 pour la mise en page. Mantine est retiré. La coquille reprend celle du CRC : barre latérale avec logo, navigation et utilisateur connecté ; contenu sur fond gris clair.
2. **Origine du paquet.** Tant que le Nexus n'est pas joignable, `@awb/ui` est construit en local depuis le dépôt fourni (`make awb-ui AWB_UI_SRC=<chemin>`), et le paquet produit, `web/vendor/awb-ui-<version>.tgz`, n'est jamais versionné. Le code interne de la banque ne quitte donc pas le poste, et aucun paquet public du même nom ne peut être installé par erreur. Dès que le Nexus est joignable, la dépendance pointe sur la version publiée.
3. **Polices.** La feuille de `@awb/ui` embarque ses polices en `data:` (300 Ko compressés). La CSP du BFF (`font-src 'self'`) les refuserait. Un greffon Vite les retire, et Inter est servie en fichiers par `@fontsource-variable/inter`.
4. **Écarts imposés par l'accessibilité** (09-fronts.md, WCAG 2.1 AA), à signaler à l'équipe d'`@awb/ui` :

   | Composant `@awb/ui` | Défaut | Ce que fait Sijil |
   |---|---|---|
   | `Button` (trois variantes) | Contraste de 3,6:1 à 4,0:1, pour 4,5:1 exigé | Même composant, teinte orange-700 de la charte (5,7:1) |
   | `Tabs` | Onglet actif à 4,0:1 ; pas de lien entre l'onglet et son panneau | Onglets Sijil au même style, en orange-700 |
   | `Input`, `Textarea`, `Select` | Libellé non relié au champ | Libellé, aide et erreur reliés par Sijil (`Field`) |
   | `Input` | `required` pris pour l'astérisque, absent du champ | `<input>` natif aux classes d'`Input` |
   | `Select` | Bouton sans nom accessible, pas de valeur de formulaire | `<select>` natif aux classes de la charte, comme le CRC |
   | `Progress` | Ni rôle ni valeur | Barre `progressbar` nommée |
   | `Avatar` | Couleur tirée du nom, jusqu'à 3,8:1 | Teinte fixe orange-700 |

## Options écartées

- **Garder Mantine avec un thème orange** : l'aspect serait proche, mais ni les composants ni l'approche ne seraient ceux de la banque.
- **Copier le code d'`@awb/ui` dans le dépôt** : on perdrait les mises à jour de la bibliothèque, et le code interne de la banque partirait sur un dépôt hors banque.
- **Utiliser `@awb/ui` sans écart** : les scénarios Playwright mesurent le contraste avec axe et échoueraient ; l'exigence AA de 09-fronts.md ne serait plus tenue.

## Conséquences

- **Une installation neuve demande `make awb-ui`** avant `make ci`, tant que le Nexus reste injoignable (B-032).
- **Le bundle initial passe à 147 Ko compressés** (budget 250 Ko), sans police embarquée.
- **Les tests de composants utilisent désormais les contrôles natifs** (`selectOptions`), et leurs assertions sont inchangées.
- **Les écarts du point 4 sont à remonter à l'équipe d'`@awb/ui`.** Une fois corrigés dans la bibliothèque, les enveloppes Sijil pourront disparaître.
- **Registres :** DEC-18 passe à « remplacée par ADR 0037 », et la ligne « Composants » de 09-fronts.md suit.

## Amendement du 2026-11-24 : police

À la demande du responsable du projet, la police servie en fichiers devient Open Sans, celle de la charte et du poste CRC (`@fontsource-variable/open-sans` 5.3.0, licence OFL), au lieu d'Inter. Le greffon qui retire les polices embarquées d'`@awb/ui` reste en place : la CSP (`font-src 'self'`) est inchangée.
