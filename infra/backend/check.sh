#!/bin/bash
# Asks the server what the app asks before anyone signs in: Auth is up, a table
# reads, a search runs. Runs on the server (`npm run backend -- check`), which
# holds the app's key; curl -f fails on any answer that isn't 2xx, so a broken
# deploy fails the demo run before the app is published.
#
#   DOMAIN=… bash check.sh
set -euo pipefail

: "${DOMAIN:?}"
url=https://$DOMAIN
key=$(grep '^SUPABASE_PUBLISHABLE_KEY=' /opt/wedded/supabase/.env | tail -n1 | cut -d= -f2- | tr -d "'\"")

curl -fsS -H "apikey: $key" "$url/auth/v1/health" >/dev/null
curl -fsS -H "apikey: $key" "$url/rest/v1/categories?select=slug&limit=1" | grep -q '"slug"'
curl -fsS -H "apikey: $key" -H 'Content-Type: application/json' -d '{}' \
  "$url/rest/v1/rpc/search_vendors" >/dev/null
echo "Answering: $url"
