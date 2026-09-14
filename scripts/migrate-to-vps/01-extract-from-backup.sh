#!/usr/bin/env bash
# Turn Lovable's database export into one import-ready SQL file for the
# self-hosted stack.
#
# Replaces the old 01-dump-source.sh: Lovable-managed projects give you no
# direct Postgres URI, but the dashboard's "Export data" produces a pg_dump
# custom-format archive, which is just as good and needs no credentials.
#
# What this deliberately does and does not carry across:
#
#   public schema   schema + data + RLS policies + functions + triggers +
#                   sequences, with grants to anon/authenticated/service_role
#                   kept (the whole authorization model depends on them) and
#                   grants to Lovable's sandbox_exec roles stripped, since those
#                   roles do not exist on self-hosted and would error.
#
#   auth            DATA ONLY for users + identities. Not the auth schema DDL:
#                   self-hosted GoTrue owns and versions that itself, and the
#                   cloud copy carries oauth_*/webauthn_*/saml_* tables and
#                   newer session columns it does not expect. Not sessions or
#                   refresh_tokens either - the JWT secret changes, so existing
#                   sessions are void anyway. Not auth.schema_migrations, or
#                   GoTrue would think its migrations had already run.
#
#   storage         NOTHING. The cloud storage.objects has versioning columns
#                   (archived_at, is_delete_marker, is_versioned) that
#                   storage-api v1.44.2 does not have, so transplanting rows
#                   breaks on COPY. 03-migrate-storage.py uploads the files
#                   through the Storage API instead and lets storage-api write
#                   its own rows, which is version-proof. The
#                   database_export_* bucket in the dump is Lovable's own export
#                   artifact and is not yours to migrate.
#
# Postgres client tools run in Docker, so nothing needs installing. The archive
# was written by pg_dump 18.6 from a 17.6 server with zstd compression;
# pg_restore 17 reads it correctly (verified: byte-identical output to
# pg_restore 18), so PG_IMAGE can stay on the target's own major version.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

BACKUP="${BACKUP:-}"
SOURCE_URL="${SOURCE_URL:-https://kphkbmwycreriandedis.supabase.co}"
TARGET_URL="${TARGET_URL:-https://api.modessi.shop}"
BUCKET="${BUCKET:-shop-assets}"
PG_IMAGE="${PG_IMAGE:-postgres:17}"
OUT="${OUT:-}"

if [ -z "$BACKUP" ] || [ ! -f "$BACKUP" ]; then
  cat >&2 <<USAGE
usage: BACKUP=/path/to/modessi2_YYMMDD.backup ./01-extract-from-backup.sh

  BACKUP      Lovable's export (pg_dump custom format, starts with "PGDMP")
  OUT         output directory (default: alongside the backup, in ./import/)
  TARGET_URL  new API origin for the URL rewrite (default $TARGET_URL)

The output contains customer PII and password hashes - keep it out of git.
USAGE
  exit 64
fi

BACKUP_ABS="$(cd "$(dirname "$BACKUP")" && pwd)/$(basename "$BACKUP")"
OUT="${OUT:-$(dirname "$BACKUP_ABS")/import}"
mkdir -p "$OUT"

# Docker needs a path it can mount and a name without spaces inside the
# container, so stage the archive into the output dir under a fixed name.
STAGE="$OUT/.stage"
mkdir -p "$STAGE"
cp -f "$BACKUP_ABS" "$STAGE/dump.backup"

# Windows/Git-Bash: hand Docker a native path and stop MSYS rewriting it.
if command -v cygpath >/dev/null 2>&1; then
  STAGE_HOST="$(cygpath -w "$STAGE")"
  DOCKER_ENV="MSYS_NO_PATHCONV=1"
else
  STAGE_HOST="$STAGE"
  DOCKER_ENV=""
fi

pgr() {
  env $DOCKER_ENV docker run --rm -v "${STAGE_HOST}:/w" "$PG_IMAGE" pg_restore "$@"
}

echo "==> archive header"
pgr -l /w/dump.backup | sed -n '2,12p' | sed 's/^/    /'

echo
echo "==> 1/4  public schema (schema + data + policies + grants)"
pgr --schema=public --no-owner -f /w/public-raw.sql /w/dump.backup

# Grants to Lovable's sandbox roles reference roles that do not exist on
# self-hosted; keep every other grant, because anon/authenticated/service_role
# are load-bearing for PostgREST.
# Every sandbox_exec reference is DDL (GRANT ... TO, and ALTER DEFAULT
# PRIVILEGES ... TO) - verified none appear inside COPY data - so dropping any
# line that mentions the role is both safe and complete. Anchoring on
# ^GRANT|^REVOKE is not: it misses ALTER DEFAULT PRIVILEGES.
if awk '/^COPY /{i=1} i&&/^\\\.$/{i=0} i&&/sandbox_exec/{found=1} END{exit !found}' \
     "$STAGE/public-raw.sql"; then
  echo "    REFUSING: sandbox_exec appears inside COPY data, not just DDL" >&2
  exit 1
fi
grep -c 'sandbox_exec' "$STAGE/public-raw.sql" \
  | sed 's/^/    sandbox_exec DDL lines to strip: /'
# Also drop "ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin": the import runs
# as postgres, which is NOT a superuser on a Supabase stack, so altering another
# role's default privileges fails with "permission denied to change default
# privileges". They are redundant anyway - the stack ships its own default ACLs
# on public granting to anon/authenticated/service_role, and this import never
# drops the schema, so those survive. The FOR ROLE postgres variants do apply
# and are kept.
grep -v 'sandbox_exec' "$STAGE/public-raw.sql" \
  | grep -vE '^CREATE SCHEMA "?public"?;$' \
  | grep -vE '^ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin ' \
  > "$OUT/02-public.sql"
printf '    ALTER DEFAULT PRIVILEGES kept: %s (supabase_admin variants dropped: %s)\n' \
  "$(grep -c 'ALTER DEFAULT PRIVILEGES' "$OUT/02-public.sql")" \
  "$(grep -cE '^ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin ' "$STAGE/public-raw.sql")"
for r in anon authenticated service_role; do
  printf '    grants kept for %-14s %s\n' "$r" \
    "$(grep -cE "GRANT .* TO \"?${r}\"?" "$OUT/02-public.sql")"
done

echo
echo "==> 2/4  auth data (users, then identities)"
# Two passes, not one. pg_restore emits a single --table=a --table=b run in its
# own (alphabetical) order, which puts auth.identities before auth.users - and
# identities.user_id references users.id, so a combined extract fails the
# foreign key on import. Extract each separately and concatenate parent-first.
pgr --data-only --no-owner --schema=auth --table=users      -f /w/auth-users.sql      /w/dump.backup
pgr --data-only --no-owner --schema=auth --table=identities -f /w/auth-identities.sql /w/dump.backup
cat "$STAGE/auth-users.sql" "$STAGE/auth-identities.sql" > "$OUT/01-auth-data.sql"
awk '/^COPY /{t=$2;c=0;i=1;next} i&&/^\\\.$/{printf "    %-22s %d rows\n",t,c;i=0;next} i{c++}' \
  "$OUT/01-auth-data.sql"

echo
echo "==> 3/4  URL rewrite"
sed -e "s#@@SRC@@#${SOURCE_URL}#g" -e "s#@@DST@@#${TARGET_URL}#g" -e "s#@@BUCKET@@#${BUCKET}#g" \
  ./04-rewrite-storage-urls.sql.tmpl > "$OUT/03-rewrite.sql"
echo "    ${SOURCE_URL}/storage/v1/object/public/${BUCKET}/ -> ${TARGET_URL}/..."

echo
echo "==> 4/4  assembling single import file"
{
  cat <<HDR
-- Modessi: Lovable -> self-hosted import
-- generated $(date -u '+%Y-%m-%d %H:%M:%SZ') from $(basename "$BACKUP_ABS")
--
-- Order is load-bearing: auth.users first (public.profiles and public.user_roles
-- carry foreign keys to it), then the public schema, then the URL rewrite.
-- Storage files are NOT here - run 03-migrate-storage.py after this.
--
-- CONTAINS CUSTOMER PII AND PASSWORD HASHES.
--
-- Pure SQL on purpose: no psql meta-commands (\\set, \\timing), so this file
-- works whether it is piped through psql or fed to an importer that does its
-- own thing - such as Coolify's Import Backup. When running it yourself, pass
-- the stop-on-error flag on the command line instead:
--     psql -U postgres -v ON_ERROR_STOP=1 -f modessi-import.sql
--
-- Wrapped in a single transaction, so this is all-or-nothing. Postgres makes
-- DDL transactional, so a failure at any point - including an importer that
-- would otherwise plough past errors - rolls the whole thing back and leaves
-- the database exactly as it was. There is no half-migrated state to unpick.
-- (An importer that adds its own outer transaction just nests harmlessly.)
BEGIN;

-- Preflight: refuse to run against anything that is not a Supabase stack,
-- and refuse to overwrite a public schema that already has our tables.
DO \$preflight\$
DECLARE n int; missing text;
BEGIN
  SELECT count(*) INTO n FROM information_schema.schemata
   WHERE schema_name IN ('auth','storage');
  IF n <> 2 THEN
    RAISE EXCEPTION 'target has no auth/storage schema - is this a Supabase stack?';
  END IF;

  SELECT count(*) INTO n FROM pg_tables
   WHERE schemaname='public' AND tablename IN ('orders','products','admin_settings');
  IF n > 0 THEN
    RAISE EXCEPTION 'public schema already has % of our tables - drop it first to avoid a half-merge', n;
  END IF;

  -- auth.users must have every column the dump is about to write.
  SELECT string_agg(c, ', ') INTO missing FROM (
    SELECT c FROM unnest(ARRAY[
      'instance_id','id','aud','role','email','encrypted_password','email_confirmed_at',
      'invited_at','confirmation_token','confirmation_sent_at','recovery_token',
      'recovery_sent_at','email_change_token_new','email_change','email_change_sent_at',
      'last_sign_in_at','raw_app_meta_data','raw_user_meta_data','is_super_admin',
      'created_at','updated_at','phone','phone_confirmed_at','phone_change',
      'phone_change_token','phone_change_sent_at','email_change_token_current',
      'email_change_confirm_status','banned_until','reauthentication_token',
      'reauthentication_sent_at','is_sso_user','deleted_at','is_anonymous']) AS c
    WHERE c NOT IN (SELECT column_name FROM information_schema.columns
                     WHERE table_schema='auth' AND table_name='users')
  ) q;
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'this GoTrue is missing auth.users columns: %', missing;
  END IF;
END
\$preflight\$;

CREATE SCHEMA IF NOT EXISTS public;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Existing users would collide on the primary key; the target is a fresh stack.
DELETE FROM auth.identities;
DELETE FROM auth.users;

HDR
  echo "-- ===== auth data ====="
  cat "$OUT/01-auth-data.sql"
  echo
  echo "-- ===== public schema + data ====="
  cat "$OUT/02-public.sql"
  echo
  echo "-- ===== storage URL rewrite ====="
  cat "$OUT/03-rewrite.sql"
  echo
  echo "-- ===== commit: nothing above is durable until this succeeds ====="
  echo "COMMIT;"
} > "$OUT/modessi-import.sql"

# pg_dump 17.6+ emits \restrict/\unrestrict meta-commands around COPY blocks - a
# backported guard against injection via object names in untrusted dumps. psql
# 17.6+ understands them, but an importer that does not pipe through psql will
# choke. This is our own dump and its contents have been inspected, so strip
# them for portability, and fail loudly if any other meta-command survives.
if grep -qE '^\\(restrict|unrestrict)' "$OUT/modessi-import.sql"; then
  n=$(grep -cE '^\\(restrict|unrestrict)' "$OUT/modessi-import.sql")
  grep -vE '^\\(restrict|unrestrict)' "$OUT/modessi-import.sql" > "$OUT/.tmp" \
    && mv -f "$OUT/.tmp" "$OUT/modessi-import.sql"
  echo "    stripped $n \\restrict/\\unrestrict meta-commands"
fi
# "\." is NOT a meta-command: it terminates a COPY ... FROM stdin data block and
# has to stay. Only flag anything else.
left=$(grep -cE '^\\[^.]' "$OUT/modessi-import.sql" || true)
if [ "${left:-0}" -ne 0 ]; then
  echo "    WARNING: $left psql meta-command line(s) remain:" >&2
  grep -nE '^\\[^.]' "$OUT/modessi-import.sql" | head -5 >&2
else
  printf '    no psql meta-commands; %s COPY data blocks (\\. terminators kept)\n' \
    "$(grep -c 'FROM stdin;' "$OUT/modessi-import.sql")"
fi

# The data arrives as COPY ... FROM stdin, which is what every Postgres dump
# uses and what Coolify's Postgres restore pipes through psql. If some importer
# ever cannot handle it, regenerate the public part with pg_restore --inserts to
# get INSERT statements instead - bigger and slower, but portable anywhere.

rm -rf "$STAGE"

echo
echo "Wrote $OUT/modessi-import.sql ($(wc -c < "$OUT/modessi-import.sql") bytes)"
echo
echo "Next:"
echo "  1. Coolify -> the service -> Import Backup -> upload modessi-import.sql"
echo "     (or: psql -U postgres -f it, from the Terminal on supabase-db)"
echo "  2. ./03-migrate-storage.sh   # the 121 image files"
echo "  3. ./05-verify.sh"
echo
echo "This file contains customer PII and password hashes. Do not commit it."
