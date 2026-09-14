#!/usr/bin/env bash
# Dump the Lovable-managed Supabase project. READ-ONLY against the source.
#
# Three separate dumps, deliberately - a single pg_dump of the whole database
# would carry Supabase's own auth/storage/realtime DDL and overwrite the
# versions the self-hosted stack manages itself, which breaks GoTrue and
# storage-api. So: own our `public` schema completely, and take only the DATA
# out of auth and storage.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./00-config.sh

OUT="${WORKDIR}/dump"
mkdir -p "$OUT"

pg() {
  docker run --rm -i -v "${OUT}:/out" "$PG_IMAGE" "$@"
}

echo "==> 1/4  public schema: DDL + data (tables, RLS, functions, triggers, sequences)"
# --no-owner: source objects are owned by supabase_admin, target by postgres.
# Privileges ARE kept: grants target anon/authenticated/service_role, which all
# exist on self-hosted, and the whole authorization model depends on them.
pg pg_dump "$SOURCE_DB_URL" \
  --schema=public \
  --no-owner \
  --quote-all-identifiers \
  --file=/out/01-public.sql

echo "==> 2/4  auth users: data only (12 users, bcrypt hashes travel intact)"
pg pg_dump "$SOURCE_DB_URL" \
  --data-only --no-owner \
  --table=auth.users \
  --table=auth.identities \
  --file=/out/02-auth-data.sql

echo "==> 3/4  storage metadata: data only (bucket + object rows)"
# The FILES are moved separately by 03-migrate-storage.sh. These are just the
# rows storage-api reads to know what exists.
pg pg_dump "$SOURCE_DB_URL" \
  --data-only --no-owner \
  --table=storage.buckets \
  --table=storage.objects \
  --file=/out/03-storage-data.sql

echo "==> 4/4  reference snapshot: row counts to verify the restore against"
pg psql "$SOURCE_DB_URL" -At -F',' -o /out/04-source-counts.csv <<'SQL'
select 'products',count(*) from products
union all select 'product_variations',count(*) from product_variations
union all select 'categories',count(*) from categories
union all select 'orders',count(*) from orders
union all select 'order_items',count(*) from order_items
union all select 'draft_orders',count(*) from draft_orders
union all select 'admin_settings',count(*) from admin_settings
union all select 'wholesale_prices',count(*) from wholesale_prices
union all select 'sms_logs',count(*) from sms_logs
union all select 'sms_templates',count(*) from sms_templates
union all select 'home_page_content',count(*) from home_page_content
union all select 'contact_submissions',count(*) from contact_submissions
union all select 'user_roles',count(*) from user_roles
union all select 'auth.users',count(*) from auth.users
union all select 'storage.objects',count(*) from storage.objects
union all select 'rls_policies',count(*) from pg_policies where schemaname='public'
union all select 'public_functions',count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
union all select 'triggers',count(*) from pg_trigger where not tgisinternal
order by 1;
SQL

echo
echo "Dumps written to $OUT:"
ls -la "$OUT"
echo
echo "Source was not modified. Next: 02-restore-target.sh"
