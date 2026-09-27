#!/usr/bin/env bash
# After a deploy: the Worker's domain answers, and only through Cloudflare Access. A request without an
# Access session must be redirected to the team's login page; a 200 would mean the app is exposed.
#
#   scripts/ci/smoke.sh <url> <access team host>
set -euo pipefail
url=$1
team=$2

for attempt in 1 2 3 4 5 6; do
  status=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "$url/" || true)
  location=$(curl -sS -o /dev/null -w '%{redirect_url}' --max-time 10 "$url/" || true)
  if [ "$status" = 302 ] && [[ "$location" == "https://$team/"* ]]; then
    echo "ok: $url redirects to Access ($team)"
    exit 0
  fi
  if [ "$status" = 200 ]; then
    echo "::error::$url answered 200 without an Access session: the app is exposed." >&2
    exit 1
  fi
  echo "attempt $attempt: $status -> ${location:-no redirect}, retrying"
  sleep 10
done
echo "::error::$url never redirected to Access ($team)." >&2
exit 1
