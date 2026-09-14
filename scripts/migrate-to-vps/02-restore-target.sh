#!/usr/bin/env bash
# Restore the dumps into the self-hosted stack. DESTRUCTIVE on the TARGET only.
#
# Order matters and is not the order the files are numbered in:
#   auth data -> public schema -> storage data
# public.profiles and public.user_roles carry foreign keys to auth.users, so the
# users have to exist before the public dump's COPY blocks run. And
# storage.buckets must precede storage.objects for the same reason.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./00-config.sh

OUT="${WORKDIR}/dump"
for f in 01-public.sql 02-auth-data.sql 03-storage-data.sql; do
  [ -s "$OUT/$f" ] || { echo "missing or empty: $OUT/$f - run 01-dump-source.sh first" >&2; exit 1; }
done

pg() { docker run --rm -i -v "${OUT}:/out" "$PG_IMAGE" "$@"; }

echo "This DROPS AND RECREATES the public schema on:"
echo "  ${TARGET_DB_URL%%\?*}" | sed -E 's#://[^:]+:[^@]+@#://***:***@#'
echo "and deletes existing storage.objects / the ${BUCKET} bucket row there."
echo "The source is untouched and remains a rollback target."
read -r -p "Type 'restore' to continue: " ok
[ "$ok" = restore ] || { echo "aborted"; exit 1; }

echo "==> 0/4  sanity: target must be a Supabase stack (auth + storage schemas present)"
pg psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -At -c \
  "select case when count(*)=2 then 'ok' else 'MISSING' end
     from information_schema.schemata where schema_name in ('auth','storage');" | grep -qx ok \
  || { echo "target does not look like a Supabase stack - is it started?" >&2; exit 1; }

echo "==> 1/4  auth data (users before the public FKs need them)"
pg psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
begin;
delete from auth.identities;
delete from auth.users;
commit;
SQL
pg psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -f /out/02-auth-data.sql

echo "==> 2/4  public schema: DDL + data + sequence positions"
# Whether pg_dump emits "CREATE SCHEMA public" for an explicitly named schema
# varies by version, and a duplicate would abort the whole restore under
# ON_ERROR_STOP. Strip it and own the schema creation here instead.
sed -E '/^CREATE SCHEMA "?public"?;/d' "$OUT/01-public.sql" > "$OUT/01-public.prepared.sql"
removed=$(( $(grep -cE '^CREATE SCHEMA "?public"?;' "$OUT/01-public.sql" || true) ))
echo "     stripped ${removed} CREATE SCHEMA public statement(s) from the dump"

pg psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
begin;
drop schema if exists public cascade;
create schema public;
grant usage on schema public to anon, authenticated, service_role;
commit;
SQL
pg psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -f /out/01-public.prepared.sql

echo "==> 3/4  storage metadata (bucket row, then object rows)"
pg psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 <<SQL
begin;
delete from storage.objects where bucket_id = '${BUCKET}';
delete from storage.buckets where id = '${BUCKET}';
commit;
SQL
pg psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -f /out/03-storage-data.sql

echo "==> 4/4  rewrite storage URLs baked into the data"
# 6,745 order_items rows, 113 product image entries and 3 admin_settings rows
# hold absolute https://<old-ref>.supabase.co/... URLs. Left alone they keep
# serving from Lovable, and break the day that project is paused.
cp ./04-rewrite-storage-urls.sql "$OUT/04-rewrite-storage-urls.sql"
pg psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 \
  -v src="$SOURCE_URL" -v dst="$TARGET_URL" -v bucket="$BUCKET" \
  -f /out/04-rewrite-storage-urls.sql

echo
echo "Restore done. Next: 03-migrate-storage.sh (moves the actual image files)"
