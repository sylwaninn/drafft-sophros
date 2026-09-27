#!/usr/bin/env bash
# Writes .dev.vars for `pnpm dev`: the local Supabase of drafft-backend (URL in wrangler.jsonc, service role
# key from `supabase status`). Stream stays empty until you paste the staging app's key and secret
# (conversations need them; everything else works without). Never rewrites an existing .dev.vars.
#
#   scripts/local-env.sh [path to drafft-backend, default ../drafft-backend]
set -euo pipefail
cd "$(dirname "$0")/.."

backend=${1:-../drafft-backend}
[ -e .dev.vars ] && { echo ".dev.vars already exists; edit it by hand." >&2; exit 1; }
key=$(cd "$backend" && supabase status -o env 2>/dev/null | sed -n 's/^SERVICE_ROLE_KEY="\{0,1\}\([^"]*\)"\{0,1\}$/\1/p')
[ -n "$key" ] || { echo "No local Supabase running in $backend (supabase start)." >&2; exit 1; }

umask 077
{
  echo "SUPABASE_SECRET_KEY=$key"
  echo "STREAM_API_KEY="
  echo "STREAM_API_SECRET="
  echo "DEV_STAFF_EMAIL=dev@drafft.local"
} > .dev.vars
echo "Wrote .dev.vars. Add the Stream staging key and secret to read conversations."
