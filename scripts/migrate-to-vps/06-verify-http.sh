#!/usr/bin/env bash
# Verify the migrated stack over HTTP only - no direct Postgres access needed,
# which suits a stack on "Use the stack network only".
#
# Supersedes 05-verify.sh in this environment (that one needs TARGET_DB_URL).
# Read-only: it reads rows and HEADs image URLs, and writes nothing.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./00-config.sh

fail=0
note() { printf '  %-40s %s\n' "$1" "$2"; }
bad()  { note "$1" "$2"; fail=1; }

# PostgREST exact count via Content-Range, e.g. "0-0/6665" -> 6665
cnt() {
  curl -s --max-time 30 -I \
    -H "apikey: $2" -H "Authorization: Bearer $2" \
    -H 'Range-Unit: items' -H 'Range: 0-0' -H 'Prefer: count=exact' \
    "$TARGET_URL/rest/v1/$1?select=*" 2>/dev/null \
  | grep -i '^content-range' | tr -d '\r' | sed 's#.*/##'
}

echo "=== 1. row counts (service_role, RLS bypassed) ==="
# Expected values are the source figures, confirmed before migration.
while IFS='=' read -r t want; do
  got="$(cnt "$t" "$TARGET_SERVICE_KEY")"
  [ "$got" = "$want" ] && note "$t" "ok ($got)" || bad "$t" "expected $want, got ${got:-<none>}"
done <<'EOF'
orders=6665
order_items=6870
sms_logs=7169
products=62
product_variations=346
admin_settings=53
wholesale_prices=75
draft_orders=140
categories=3
home_page_content=10
sms_templates=4
user_roles=1
EOF

echo
echo "=== 2. RLS actually enforced for anon ==="
# Orders and abandoned checkouts must not be readable anonymously; the public
# catalogue must be. These were audit findings #2 and #4.
for t in orders draft_orders; do
  got="$(cnt "$t" "$TARGET_ANON_KEY")"
  [ "${got:-0}" = "0" ] && note "$t hidden from anon" "ok (0)" || bad "$t LEAKS to anon" "$got rows"
done
for t in products categories; do
  got="$(cnt "$t" "$TARGET_ANON_KEY")"
  [ "${got:-0}" != "0" ] && note "$t readable by anon" "ok ($got)" || bad "$t not readable by anon" "${got:-<none>}"
done

echo
echo "=== 3. no row still points at the old project ==="
for pair in "order_items=product_image" "products=images" "admin_settings=value"; do
  t="${pair%%=*}"; c="${pair##*=}"
  got="$(cnt "${t}?${c}=like.*kphkbmwycreriandedis*" "$TARGET_SERVICE_KEY")"
  [ "${got:-0}" = "0" ] && note "$t.$c" "ok (0 stale)" || bad "$t.$c" "$got rows still on the old host"
done

echo
echo "=== 4. every distinct product image URL resolves ==="
curl -s --max-time 60 -o "${TMPDIR:-/tmp}/verify-imgs.json" \
  -H "apikey: $TARGET_ANON_KEY" "$TARGET_URL/rest/v1/products?select=images"
IMGS="${TMPDIR:-/tmp}/verify-imgs.json" python3 - <<'PY'
import json, os, collections, urllib.request, urllib.error
rows = json.load(open(os.environ['IMGS'], encoding='utf-8'))
uniq = sorted({u for r in rows for u in (r.get('images') or [])})
by = collections.Counter(u.split('/')[2] for u in uniq)
for h, n in by.most_common():
    print("  %-40s %d urls" % (h, n))
ok, fails = 0, []
for u in uniq:
    try:
        with urllib.request.urlopen(urllib.request.Request(u, method='HEAD'), timeout=25) as r:
            ok += 1 if r.status == 200 else fails.append((r.status, u)) or 0
    except urllib.error.HTTPError as e:
        fails.append((e.code, u))
    except Exception as e:
        fails.append((type(e).__name__, u))
print("  %-40s %d/%d resolve 200" % ("product images", ok, len(uniq)))
for c, u in fails[:10]:
    print("    FAIL %s %s" % (c, u))
raise SystemExit(1 if fails else 0)
PY
[ $? -eq 0 ] || fail=1

echo
echo "=== 5. RPCs the app depends on are exposed ==="
# NB: PostgREST answers 404 when the ARGUMENTS do not match, so probing with {}
# is not a presence test. Read the OpenAPI spec instead.
curl -s --max-time 30 -o "${TMPDIR:-/tmp}/verify-oa.json" \
  -H "apikey: $TARGET_SERVICE_KEY" -H "Authorization: Bearer $TARGET_SERVICE_KEY" \
  -H 'Accept: application/openapi+json' "$TARGET_URL/rest/v1/"
OA="${TMPDIR:-/tmp}/verify-oa.json" python3 - <<'PY'
import json, os
d = json.load(open(os.environ['OA'], encoding='utf-8'))
rpcs = {p[5:] for p in d.get('paths', {}) if p.startswith('/rpc/')}
tables = {p[1:] for p in d.get('paths', {}) if not p.startswith('/rpc/') and p != '/'}
missing = [f for f in ('has_role', 'apply_order_stock', 'rate_limit_hit',
                       'admin_update_order_with_items') if f not in rpcs]
for f in sorted(rpcs):
    print("  %-40s exposed" % f)
print("  %-40s %d" % ("tables exposed", len(tables)))
# generate_order_number is a trigger function - correctly NOT an RPC.
if missing:
    print("  MISSING RPCs: %s" % ", ".join(missing))
raise SystemExit(1 if missing or len(tables) != 23 else 0)
PY
[ $? -eq 0 ] || fail=1

echo
echo "=== 6. service endpoints ==="
probe() {
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 25 -H "apikey: $TARGET_ANON_KEY" "$TARGET_URL/$1")
  if [ "$code" = "$2" ]; then note "$1" "ok ($code)"; else bad "$1" "expected $2, got $code"; fi
}
probe "auth/v1/health" 200
probe "rest/v1/"       200

echo
echo "=== 7. edge functions deployed? ==="
body=$(curl -s --max-time 25 -H "apikey: $TARGET_ANON_KEY" -H 'Content-Type: application/json' \
         -d '{}' "$TARGET_URL/functions/v1/place-order" 2>/dev/null)
case "$body" in
  *"could not find an appropriate entrypoint"*)
      bad "edge functions" "NOT DEPLOYED - no code on disk (see step 6)";;
  *InvalidWorkerCreation*)
      bad "edge functions" "runtime cannot boot a worker: $body";;
  *)  note "edge functions" "responding (not the missing-entrypoint error)";;
esac

echo
if [ "$fail" = 0 ]; then
  echo "ALL CHECKS PASSED."
else
  echo "SOME CHECKS FAILED (see above)."
  exit 1
fi
