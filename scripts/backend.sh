#!/usr/bin/env bash
# The backend server on AWS (infra/lib/backend-stack.ts, infra/README.md):
#
#   npm run backend -- deploy [--seed]      bring it up to date with this checkout:
#                                            settings, functions, migrations (--seed: sample vendors, new server only)
#                                            WEB=dist also replaces the web app with that web export,
#                                            built with the "preview" values (demo.yml)
#   npm run backend -- check                ask the server the three things the app asks before sign-in
#   npm run backend -- env                  print the address and keys for scripts:
#                                            eval "$(npm run -s backend -- env)"
#   npm run backend -- copy-from-supabase   copy accounts and data from the hosted Supabase demo, once
#
# Signs in with the AWS CLI profile "wedded" (aws login --profile wedded), or AWS_PROFILE.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -n "${AWS_ACCESS_KEY_ID:-}" ] || export AWS_PROFILE=${AWS_PROFILE:-wedded}
export AWS_REGION=us-east-2
# Git Bash on Windows turns /wedded/… and /opt/… into Windows paths unless told not to
export MSYS_NO_PATHCONV=1

key() { aws ssm get-parameter --name "/wedded/backend/keys/$1" --with-decryption --query Parameter.Value --output text; }

output() {
  aws cloudformation describe-stacks --stack-name WeddedBackend --output text \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue"
}

# Runs a command on the server through Systems Manager, prints its output, and fails if it failed
on_server() {
  local instance id status
  instance=$(output InstanceId)
  id=$(aws ssm send-command --instance-ids "$instance" --document-name AWS-RunShellScript \
    --parameters "$(jq -cn --arg c "$1" '{commands: [$c], executionTimeout: ["3600"]}')" \
    --query Command.CommandId --output text)
  echo "Running on the server (takes a few minutes the first time)…"
  while :; do
    sleep 5
    status=$(aws ssm get-command-invocation --command-id "$id" --instance-id "$instance" \
      --query Status --output text 2>/dev/null || echo Pending)
    case "$status" in Pending | InProgress | Delayed) ;; *) break ;; esac
  done
  aws ssm get-command-invocation --command-id "$id" --instance-id "$instance" --output text \
    --query '[StandardOutputContent, StandardErrorContent]'
  [ "$status" = Success ] || {
    echo "Failed on the server ($status)." >&2
    exit 1
  }
}

# Deletes the web export's scripts in the bucket that this export doesn't have and that no
# export has uploaded for 2 days. Until then a page opened before a deploy can still load
# the script for its next screen, which a new export renames.
prune_web_scripts() {
  local current cutoff stale
  current=$(cd "$WEB" && find _expo/static -type f | jq -R . | jq -s .) || return
  cutoff=$(date -u -d '2 days ago' +%FT%T 2>/dev/null || date -u -v-2d +%FT%T)
  stale=$(aws s3api list-objects-v2 --bucket "$1" --prefix app/web/_expo/static/ --output json \
    --query 'Contents[].{Key: Key, LastModified: LastModified}' |
    jq -c --argjson current "$current" --arg cutoff "$cutoff" '[.[]? | select(.LastModified < $cutoff)
      | select(.Key | ltrimstr("app/web/") | IN($current[]) | not) | {Key}] | .[:1000]') || return
  [ "$stale" = '[]' ] ||
    aws s3api delete-objects --bucket "$1" --delete "{\"Objects\": $stale, \"Quiet\": true}" >/dev/null
}

case "${1:-}" in
  deploy)
    bucket=$(output Bucket)
    aws s3 sync supabase "s3://$bucket/app/supabase" --delete --quiet \
      --exclude '.temp/*' --exclude '.branches/*' --exclude 'tests/*'
    aws s3 sync infra/backend "s3://$bucket/app/infra/backend" --delete --quiet
    if [ -n "${WEB:-}" ]; then
      # The pages mirror the export; its scripts stay a while (prune_web_scripts)
      aws s3 sync "$WEB" "s3://$bucket/app/web" --delete --exclude '_expo/static/*' --quiet
      aws s3 sync "$WEB/_expo/static" "s3://$bucket/app/web/_expo/static" --quiet
      prune_web_scripts "$bucket" ||
        echo "Couldn't remove the web app's old scripts; the next deploy tries again." >&2
    fi
    seed=$([ "${2:-}" = --seed ] && echo 1 || true)
    # A new server may still be on its first boot, which installs the AWS CLI. Without
    # --exact-timestamps a download skips a changed file of the same size (most web pages).
    # New web scripts come down first, so no page arrives before the scripts it loads
    on_server "cloud-init status --wait >/dev/null || {
        echo \"The server's first boot failed: see /var/log/cloud-init-output.log and /opt/wedded/setup.log\" >&2
        exit 1
      }
      aws s3 sync s3://$bucket/app/web/_expo/static /opt/wedded/app/web/_expo/static --exact-timestamps --quiet --region $AWS_REGION &&
      aws s3 sync s3://$bucket/app /opt/wedded/app --delete --exact-timestamps --quiet --region $AWS_REGION &&
      DOMAIN=$(output Domain) STORAGE_BUCKET=$bucket AWS_REGION=$AWS_REGION SEED=$seed \
      bash /opt/wedded/app/infra/backend/deploy.sh"
    ;;
  check)
    # On the server, which holds the app's key (the deploy user may not read it)
    on_server "DOMAIN=$(output Domain) bash /opt/wedded/app/infra/backend/check.sh"
    ;;
  env)
    echo "export SUPABASE_URL=$(output Url)"
    echo "export SUPABASE_PUBLISHABLE_KEY=$(key publishable)"
    echo "export SUPABASE_SECRET_KEY=$(key secret)"
    ;;
  copy-from-supabase)
    on_server "REPLACE=${REPLACE:-} bash /opt/wedded/app/infra/backend/copy-from-supabase.sh"
    ;;
  *)
    sed -n '2,13p' "$0"
    exit 1
    ;;
esac
