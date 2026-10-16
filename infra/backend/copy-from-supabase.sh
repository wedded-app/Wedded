#!/bin/bash
# Copies accounts and data from the hosted Supabase demo into this server, once,
# at the move (infra/README.md). Runs on the server as root through
# `npm run backend -- copy-from-supabase`. The demo's database address, with
# its password, is read from Parameter Store at /wedded/backend/copy/SOURCE_DB_URL.
# Files in Storage are copied separately (npm run storage:copy).
set -euo pipefail

source_db=$(aws ssm get-parameter --name /wedded/backend/copy/SOURCE_DB_URL --with-decryption \
  --query Parameter.Value --output text)
sql() { docker exec -i supabase-db psql -qAt -v ON_ERROR_STOP=1 -U supabase_admin -d postgres "$@"; }

accounts=$(sql -c 'select count(*) from auth.users')
if [ "$accounts" != 0 ] && [ -z "${REPLACE:-}" ]; then
  echo "This server already has $accounts accounts. To replace all its data with the demo's, run it again with REPLACE=1." >&2
  exit 1
fi

# Everything in one transaction: on any error nothing changes. Triggers are off
# (replica), so no alert is re-sent and no counter moves while rows go in.
tables=$(sql -c "select string_agg(format('%I.%I', schemaname, tablename), ', ') from pg_tables where schemaname = 'public'")
{
  echo 'begin;'
  echo 'set session_replication_role = replica;'
  echo 'set client_min_messages = warning;'
  echo "truncate auth.users, $tables cascade;"
  docker exec supabase-db pg_dump "$source_db" --data-only -t 'public.*' -t auth.users -t auth.identities
  echo 'commit;'
} | sql

echo "Copied $(sql -c 'select count(*) from auth.users') accounts and $(sql -c 'select count(*) from public.vendors') vendors."
