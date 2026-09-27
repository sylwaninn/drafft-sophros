#!/usr/bin/env bash
# Demo data for sophros, in the LOCAL database of drafft-backend only.
#
#   scripts/demo.sh up     replaces any previous demo: 14 accounts and every case sophros handles
#   scripts/demo.sh down   removes it all
#
# Rows go in with triggers off (scripts/demo/up.sql): no email, push, Stream or R2 call. Pictures are drawn
# locally (silhouettes, no real face) and uploaded to the local Storage: bucket sophros-demo for photos,
# verification-selfies for the selfie. The accounts never appear in the app's Discover.
set -euo pipefail
cd "$(dirname "$0")/.."

backend=${DRAFFT_BACKEND:-../drafft-backend}
db=supabase_db_drafft-backend
api=http://127.0.0.1:55421
selfie=de000000-0000-4000-8000-000000000004/demo/selfie.jpg

key=$(cd "$backend" && supabase status -o env 2>/dev/null | sed -n 's/^SERVICE_ROLE_KEY="\{0,1\}\([^"]*\)"\{0,1\}$/\1/p')
[ -n "$key" ] || { echo "No local Supabase running in $backend (supabase start)." >&2; exit 1; }

sql() { docker exec -i "$db" psql -U postgres -v ON_ERROR_STOP=1 --single-transaction -qtA; }
storage() { # method path [curl args]
  local method=$1 path=$2; shift 2
  curl -fsS -o /dev/null -X "$method" "$api/storage/v1/$path" -H "apikey: $key" -H "authorization: Bearer $key" "$@"
}

down() {
  sql < scripts/demo/down.sql
  storage POST bucket/sophros-demo/empty 2>/dev/null || true
  storage DELETE bucket/sophros-demo 2>/dev/null || true
  storage DELETE object/verification-selfies -H "content-type: application/json" -d "{\"prefixes\":[\"$selfie\"]}" 2>/dev/null || true
}

case "${1:-}" in
  up)
    down
    work=$(mktemp -d)
    trap 'rm -rf "$work"' EXIT
    sql < scripts/demo/up.sql > "$work/media.txt"
    echo "de000000-0000-4000-8000-000000000004/demo/selfie.jpg|selfie" >> "$work/media.txt"
    python3 scripts/demo/images.py "$work/img" "$work/media.txt"
    storage POST bucket -H "content-type: application/json" -d '{"id":"sophros-demo","name":"sophros-demo","public":true}'
    while IFS='|' read -r path _; do
      bucket=sophros-demo
      [ "$path" = "$selfie" ] && bucket=verification-selfies
      storage POST "object/$bucket/$path" -H "content-type: image/jpeg" -H "x-upsert: true" --data-binary "@$work/img/$path"
    done < "$work/media.txt"
    echo "Demo data in: $(grep -c . "$work/media.txt") pictures, 14 accounts. Remove with: scripts/demo.sh down"
    ;;
  down)
    down
    echo "Demo data removed."
    ;;
  *) echo "Usage: $0 up|down" >&2; exit 64 ;;
esac
