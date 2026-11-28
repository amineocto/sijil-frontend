# Décisions du front

Le registre des ADR de Sijil est unique et reste dans le dépôt backend : `sijil-kit/docs/adr/`. Les numéros sont partagés entre les deux dépôts. Une nouvelle ADR du front prend le numéro suivant de ce registre et y est référencée.

Ce dossier garde une copie des ADR propres au front :

| ADR | Titre | Statut |
|---|---|---|
| [0037](0037-charte-awb-ui.md) | Front : charte et composants AWB (`@awb/ui`) à la place de Mantine | acceptée |
| [0040](0040-icones-lucide-react.md) | Icônes de l'interface avec `lucide-react`, version figée | acceptée |

ADR du backend qui concernent le front, à lire dans `sijil-kit/docs/adr/` :

| ADR | Sujet |
|---|---|
| 0032 | BFF unique `admin-channel` et front unique `sijil-web` |
| 0038 | Dictionnaire de métadonnées tenu par le Data Office |
| 0039 | Politique de rétention et base légale facultatives |
| 0041 | Administration des parcours (proposée) |
| 0042 | Séparation du front dans le dépôt `sijil-frontend` |
| 0043 | Familles `omnichannel` et `channel` ; le BFF s'appelle `admin-channel` (son client Keycloak reste `sijil-bff`) |
