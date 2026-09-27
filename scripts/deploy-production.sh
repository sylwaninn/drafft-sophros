#!/usr/bin/env bash
# Ships sophros to production after a typed confirmation. Staging first: `pnpm run deploy:staging`.
set -euo pipefail
cd "$(dirname "$0")/.."
read -r -p "Deploy sophros to PRODUCTION? Type 'production' to go on: " answer
[ "$answer" = production ] || { echo "Stopped."; exit 1; }
CLOUDFLARE_ENV=production pnpm exec react-router build
pnpm exec wrangler deploy
