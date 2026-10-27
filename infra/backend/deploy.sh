#!/bin/bash
# Brings the backend server up to date with the repo: settings, the sign-in
# email, the server functions, the database migrations and the web app's
# site. Runs on the server as root: `npm run backend -- deploy` copies the
# repo's supabase/ and infra/backend/ folders (and with WEB=, the web export)
# to /opt/wedded/app and starts this through AWS Systems Manager.
#
#   DOMAIN=… STORAGE_BUCKET=… AWS_REGION=… [SEED=1] bash deploy.sh
set -euo pipefail

: "${DOMAIN:?}" "${STORAGE_BUCKET:?}" "${AWS_REGION:?}"
export AWS_REGION HOME=${HOME:-/root} # Systems Manager runs commands without a HOME
APP=$(cd "$(dirname "$0")/../.." && pwd)
PROJECT=${PROJECT:-/opt/wedded/supabase} # Supabase's self-hosting files (first-boot.sh)
SUPABASE_CLI=2.118.0                     # the version CI uses (.github/workflows/demo.yml)

# A new server may still be on its first boot
if command -v cloud-init >/dev/null; then
  cloud-init status --wait >/dev/null || {
    echo "The server's first boot failed: see /var/log/cloud-init-output.log and /opt/wedded/setup.log" >&2
    exit 1
  }
fi
cd "$PROJECT"

# One KEY='value' line, single-quoted so Docker Compose takes it literally
line() {
  case "$2" in *"'"* | *$'\n'*)
    echo "$1: quotes and line breaks aren't supported in values" >&2
    exit 1
    ;;
  esac
  printf "%s='%s'\n" "$1" "$2"
}
set_env() {
  sed -i.bak "/^$1=/d" .env && rm -f .env.bak
  line "$1" "$2" >>.env
}
read_env() { grep "^$1=" .env | tail -n1 | cut -d= -f2- | tr -d "'\""; }

# Settings and secrets in AWS Systems Manager Parameter Store:
#   /wedded/backend/env/<KEY>        a line in .env, e.g. SMTP_HOST and SMTP_PASS
#   /wedded/backend/functions/<KEY>  a server function setting, e.g. RESEND_API_KEY
parameters() {
  aws ssm get-parameters-by-path --path "$1" --with-decryption --output json \
    --query 'Parameters[].[Name, Value]' | jq -r '.[] | "\(.[0] | split("/") | last)\t\(.[1])"'
}

# Read first, so a failed read stops the deploy instead of dropping the secrets
env_parameters=$(parameters /wedded/backend/env/)
function_parameters=$(parameters /wedded/backend/functions/)

url="https://$DOMAIN"
set_env SUPABASE_PUBLIC_URL "$url"
set_env API_EXTERNAL_URL "$url/auth/v1"
set_env SITE_URL "$url"
set_env PROXY_DOMAIN "$DOMAIN"
# shortcut: the web app at www.<the API's sslip.io name> until the domain (#148); env/WEB_DOMAIN overrides it
set_env WEB_DOMAIN "www.$DOMAIN"
set_env ADDITIONAL_REDIRECT_URLS 'exp://**,weddingapp://**'
# Auto-confirm off: with it on, a new sign-up by code gets a password session that refuse_password_sign_in blocks
set_env ENABLE_EMAIL_AUTOCONFIRM false
set_env ENABLE_PHONE_AUTOCONFIRM false
set_env ENABLE_PHONE_SIGNUP false # no text-message provider yet
set_env ENABLE_ANONYMOUS_USERS false
set_env GLOBAL_S3_BUCKET "$STORAGE_BUCKET"
set_env REGION "$AWS_REGION"
set_env STUDIO_DEFAULT_ORGANIZATION Wedded
set_env STUDIO_DEFAULT_PROJECT Wedded
while IFS=$'\t' read -r key value; do [ -z "$key" ] || set_env "$key" "$value"; done <<<"$env_parameters"
chmod 600 .env

: >functions.env
chmod 600 functions.env
while IFS=$'\t' read -r key value; do [ -z "$key" ] || line "$key" "$value" >>functions.env; done <<<"$function_parameters"

# Our functions next to Supabase's main router, which reads one import map for all of them
find volumes/functions -mindepth 1 -maxdepth 1 ! -name main -exec rm -rf {} +
cp -R "$APP/supabase/functions/." volumes/functions/
jq -s '{imports: (map(.imports // {}) | add)}' "$APP"/supabase/functions/*/deno.json \
  >volumes/functions/deno.jsonc
mkdir -p volumes/email-templates
cp "$APP"/supabase/templates/*.html volumes/email-templates/

# The web app's site next to Supabase's in their Caddyfile
caddyfiles() { cat volumes/proxy/caddy/*Caddyfile 2>/dev/null | md5sum; }
caddy_before=$(caddyfiles)
cp "$APP/infra/backend/web.Caddyfile" volumes/proxy/caddy/
grep -qx 'import web.Caddyfile' volumes/proxy/caddy/Caddyfile ||
  echo 'import web.Caddyfile' >>volumes/proxy/caddy/Caddyfile

cp "$APP/infra/backend/docker-compose.wedded.yml" .
sh run.sh config add caddy wedded >/dev/null
docker compose --progress quiet up -d --wait --remove-orphans
docker compose restart functions >/dev/null
# Caddy fronts the API too, so it restarts only when its sites change
[ "$(caddyfiles)" = "$caddy_before" ] || docker compose restart caddy >/dev/null

if ! command -v supabase >/dev/null; then
  arch=$(uname -m | sed 's/aarch64/arm64/; s/x86_64/amd64/')
  curl -fsSL "https://github.com/supabase/cli/releases/download/v$SUPABASE_CLI/supabase_linux_$arch.tar.gz" |
    tar -xz -C /usr/local/bin supabase
fi
db_url="postgresql://postgres.$(read_env POOLER_TENANT_ID):$(read_env POSTGRES_PASSWORD)@localhost:$(read_env POSTGRES_PORT)/postgres?sslmode=disable"
(cd "$APP" && supabase db push --db-url "$db_url" --include-all --yes ${SEED:+--include-seed})

# Where the database's scheduled jobs and triggers call the server functions
docker exec -i supabase-db psql -q -v ON_ERROR_STOP=1 -U supabase_admin -d postgres >/dev/null <<SQL
delete from vault.secrets where name in ('project_url', 'service_role_key');
select vault.create_secret('http://api-gw:8000', 'project_url');
select vault.create_secret('$(read_env SERVICE_ROLE_KEY)', 'service_role_key');
SQL

# For laptops and scripts: `npm run backend -- env`
aws ssm put-parameter --overwrite --name /wedded/backend/keys/publishable --type String \
  --value "$(read_env SUPABASE_PUBLISHABLE_KEY)" >/dev/null
aws ssm put-parameter --overwrite --name /wedded/backend/keys/secret --type SecureString \
  --value "$(read_env SERVICE_ROLE_KEY)" >/dev/null
# The dashboard (Studio) at the server's address, user "supabase"
aws ssm put-parameter --overwrite --name /wedded/backend/keys/dashboard --type SecureString \
  --value "$(read_env DASHBOARD_PASSWORD)" >/dev/null

echo "Up to date: $url (the web app: https://$(read_env WEB_DOMAIN))"
