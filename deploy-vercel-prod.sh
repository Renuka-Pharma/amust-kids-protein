#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP"
}
trap cleanup EXIT
rsync -a --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.vercel/output' \
  --exclude '.venv-iconcrop' \
  "$ROOT/" "$TMP/workspace/"
mkdir -p "$TMP/workspace/.vercel"
cp "$ROOT/.vercel/project.json" "$TMP/workspace/.vercel/project.json"
cd "$TMP/workspace"
exec npx vercel@latest deploy --prod --yes
