#!/usr/bin/env bash
# Post-migration verification. Read-only against both sides.
# Run BEFORE repointing the frontend - everything here must pass first.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./00-config.sh

OUT="${WORKDIR}/dump"
pg() { docker run --rm -i -v "${OUT}:/out" "$PG_IMAGE" "$@"; }

fail=0
note() { printf '  %-34s %s\n' "$1" "$2"; }
check() { # label expected actual
  if [ "$2" = "$3" ]; then note "$1" "ok ($3)"; else note "$1" "MISMATCH expected=$2 got=$3"; fail=1; fi
}

echo "=== 1. row counts: target vs source snapshot ==="
if [ -s "$OUT/04-source-counts.csv" ]; then
  pg psql "$TARGET_DB_URL" -At -F',' -o /out/06-target-counts.csv <<'SQL'
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
  if diff -u "$OUT/04-source-counts.csv" "$OUT/06-target-counts.csv" > "$OUT/counts.diff"; then
    echo "  every count matches the source exactly"
  else
    echo "  DIFFERENCES (- source / + target):"
    sed -n '4,$p' "$OUT/counts.diff" | sed 's/^/    /'
    fail=1
  fi
else
  echo "  no source snapshot at $OUT/04-source-counts.csv - skipping"
  fail=1
fi

echo
echo "=== 2. no data still pointing at the old project ==="
left=$(pg psql "$TARGET_DB_URL" -At -c "
  select (select count(*) from order_items where product_image like '%${SOURCE_URL#https://}%')
       + (select count(*) from products where array_to_string(images,',') like '%${SOURCE_URL#https://}%')
       + (select count(*) from admin_settings where value like '%${SOURCE_URL#https://}%');")
check "stale old-project URLs" "0" "$left"

echo
echo "=== 3. authorization model intact ==="
for fn in has_role apply_order_stock rate_limit_hit; do
  got=$(pg psql "$TARGET_DB_URL" -At -c "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='${fn}';")
  [ "$got" -ge 1 ] && note "function ${fn}()" "present" || { note "function ${fn}()" "MISSING"; fail=1; }
done
rls=$(pg psql "$TARGET_DB_URL" -At -c "select count(*) from pg_tables t where t.schemaname='public' and not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=t.tablename and c.relrowsecurity);")
check "public tables without RLS" "0" "$rls"

echo
echo "=== 4. HTTP surface ==="
probe() { printf '  %-34s ' "$1"; curl -s -o /dev/null -w 'HTTP %{http_code}\n' --max-time 20 "$2" || echo unreachable; }
probe "kong / rest"    "${TARGET_URL}/rest/v1/"
probe "auth health"    "${TARGET_URL}/auth/v1/health"
probe "storage object" "${TARGET_URL}/storage/v1/object/public/${BUCKET}/favicon.png"

echo
echo "=== 5. a real product image resolves on the new host ==="
img=$(pg psql "$TARGET_DB_URL" -At -c "select images[1] from products where images[1] like '${TARGET_URL}%' limit 1;")
if [ -n "$img" ]; then
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$img" || echo 000)
  [ "$code" = 200 ] && note "first product image" "ok (200)" || { note "first product image" "HTTP $code - $img"; fail=1; }
else
  note "first product image" "no rewritten URL found"; fail=1
fi

echo
if [ "$fail" = 0 ]; then
  echo "ALL CHECKS PASSED - safe to repoint the frontend."
else
  echo "SOME CHECKS FAILED - do not cut over yet."
  exit 1
fi
