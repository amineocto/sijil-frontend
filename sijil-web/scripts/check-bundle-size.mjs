// Budget de 09-fronts.md : bundle initial (point d'entrée et ses imports statiques) < 250 Ko gzip.
import { readFileSync, readdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

const BUDGET = 250 * 1024;
const dist = new URL("../dist/", import.meta.url).pathname;
const html = readFileSync(join(dist, "index.html"), "utf8");
const initial = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.(?:js|css))"/g)].map(
  (m) => m[1],
);
const total = initial.reduce(
  (sum, file) => sum + gzipSync(readFileSync(join(dist, file))).length,
  0,
);
const assets = readdirSync(join(dist, "assets")).length;
console.log(
  `Bundle initial : ${(total / 1024).toFixed(1)} Ko gzip (${initial.length} fichiers, ${assets} au total)`,
);
if (total > BUDGET) {
  console.error(`Budget dépassé : ${(BUDGET / 1024).toFixed(0)} Ko gzip au plus`);
  process.exit(1);
}
