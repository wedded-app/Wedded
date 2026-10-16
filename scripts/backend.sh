#!/usr/bin/env bash
# The backend server on AWS (infra/lib/backend-stack.ts, infra/README.md):
#
#   npm run backend -- deploy [--seed]      bring it up to date with this checkout:
#                                            settings, functions, migrations (--seed: sample vendors, new server only)
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

case "${1:-}" in
  deploy)
    bucket=$(output Bucket)
    aws s3 sync supabase "s3://$bucket/app/supabase" --delete --quiet \
      --exclude '.temp/*' --exclude '.branches/*' --exclude 'tests/*'
    aws s3 sync infra/backend "s3://$bucket/app/infra/backend" --delete --quiet
    seed=$([ "${2:-}" = --seed ] && echo 1 || true)
    # A new server may still be on its first boot, which installs the AWS CLI
    on_server "cloud-init status --wait >/dev/null || {
        echo \"The server's first boot failed: see /var/log/cloud-init-output.log and /opt/wedded/setup.log\" >&2
        exit 1
      }
      aws s3 sync s3://$bucket/app /opt/wedded/app --delete --quiet --region $AWS_REGION &&
      DOMAIN=$(output Domain) STORAGE_BUCKET=$bucket AWS_REGION=$AWS_REGION SEED=$seed \
      bash /opt/wedded/app/infra/backend/deploy.sh"
    ;;
  env)
    key() { aws ssm get-parameter --name "/wedded/backend/keys/$1" --with-decryption --query Parameter.Value --output text; }
    echo "export SUPABASE_URL=$(output Url)"
    echo "export SUPABASE_PUBLISHABLE_KEY=$(key publishable)"
    echo "export SUPABASE_SECRET_KEY=$(key secret)"
    ;;
  copy-from-supabase)
    on_server "REPLACE=${REPLACE:-} bash /opt/wedded/app/infra/backend/copy-from-supabase.sh"
    ;;
  *)
    sed -n '2,10p' "$0"
    exit 1
    ;;
esac
