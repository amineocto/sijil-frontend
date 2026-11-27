// Vérifie que la copie du contrat du BFF (contracts/sijil-bff.yaml) est celle du dépôt backend.
// Le backend sijil-kit reste la source du contrat ; ce dépôt en garde une copie pour générer le
// client (npm run api -w sijil-web). Sans dépôt backend voisin, le contrôle est sauté.
import { existsSync, readFileSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";

const local = resolve("contracts/sijil-bff.yaml");
const backend = resolve(process.env.SIJIL_KIT_DIR ?? "../sijil-kit", "contracts/sijil-bff.yaml");

if (!existsSync(backend)) {
  console.log(`Contrat du backend introuvable (${backend}) : contrôle sauté.`);
  process.exit(0);
}
if (process.argv.includes("--sync")) {
  copyFileSync(backend, local);
  console.log(`contracts/sijil-bff.yaml recopié depuis ${backend}.`);
  process.exit(0);
}
if (readFileSync(local, "utf8") !== readFileSync(backend, "utf8")) {
  console.error(
    "contracts/sijil-bff.yaml diffère du backend : npm run contract:sync, puis npm run api -w sijil-web.",
  );
  process.exit(1);
}
console.log("Contrat du BFF à jour.");
