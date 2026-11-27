#!/usr/bin/env bash
# Construit @awb/ui depuis le dépôt de la banque et dépose le paquet dans vendor/ (ADR 0037).
# Usage : scripts/build-awb-ui.sh <dépôt awb-ui> <version> <paquet de sortie>
# Le dépôt est copié sans son .npmrc (identifiants du Nexus) ; les dépendances viennent du registre
# public, sans script d'installation ; le paquet produit n'est jamais versionné.
set -euo pipefail

src="${1:-}"
version="${2:?version attendue}"
out="${3:?paquet de sortie attendu}"

if [[ -z "$src" || ! -f "$src/package.json" ]]; then
  echo "AWB_UI_SRC=<chemin du dépôt awb-ui> est obligatoire" >&2
  exit 1
fi

work="$(mktemp -d "${TMPDIR:-/tmp}/awb-ui.XXXXXX")"
rsync -a --exclude .npmrc --exclude node_modules --exclude dist --exclude package-lock.json \
  "$src/" "$work/"
(
  cd "$work"
  npm install --ignore-scripts --no-package-lock --no-audit --no-fund \
    --registry=https://registry.npmjs.org
  npm run build
  npm pack --ignore-scripts
)
mkdir -p "$(dirname "$out")"
cp "$work/awb-ui-$version.tgz" "$out"
echo "$out prêt (copie de travail : $work)."
