#!/usr/bin/env bash
# Verify the migrated stack over HTTP only - no direct Postgres access needed,
# which suits a stack on "Use the stack network only".
#
# Supersedes 05-verify.sh in this environment (that one needs TARGET_DB_URL).
# Read-only: it reads rows and HEADs image URLs, and writes nothing.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./00-config.sh
# 00-config.sh normally sets this; derive it if an older copy does not.
REPO_ROOT="${REPO_ROOT:-$(cd ../.. && pwd)}"

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
# Expectations come from expected-counts.txt, which 01-extract-from-backup.sh
# writes by counting the COPY blocks in the very file that was imported. That
# way they always describe THIS export - hardcoding them means the check breaks
# the moment a fresher export is used at cutover.
EXPECTED="${EXPECTED:-}"
if [ -z "$EXPECTED" ]; then
  # Most recent expected-counts.txt under the usual export location.
  EXPECTED=$(ls -t "$REPO_ROOT"/"lovable database"/*/import/expected-counts.txt 2>/dev/null | head -1)
fi

if [ -z "$EXPECTED" ] || [ ! -s "$EXPECTED" ]; then
  bad "expected-counts.txt" "not found - re-run 01-extract-from-backup.sh, or set EXPECTED=/path/to/expected-counts.txt"
else
  echo "  using $EXPECTED"
  while IFS='=' read -r t want; do
    case "$t" in
      auth.*)            continue ;;  # auth schema is not exposed through PostgREST
      rate_limit_hits)   continue ;;  # a live counter; drifts by design
      courier_lookup_cache) continue ;; # a cache the app fills as it runs; the
                                        # smoke test alone took it 17 -> 44
      '')                continue ;;
    esac
    got="$(cnt "$t" "$TARGET_SERVICE_KEY")"
    if [ "$got" = "$want" ]; then
      note "$t" "ok ($got)"
    else
      bad "$t" "expected $want, got ${got:-<none>}"
    fi
  done < "$EXPECTED"
fi

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
# A 200 is not enough: Hostinger's SPA rewrite answers 200 with index.html for
# any missing path, so a dead image looks fine unless the content-type is
# checked too. Only the migrated URLs are asserted on; the legacy
# modessi.shop/wp-content ones are reported separately because they are
# ALREADY broken in production (the WordPress files were removed long ago) and
# are not this migration's business to fix.
ours = [u for u in uniq if 'api.modessi.shop' in u]
legacy = [u for u in uniq if u not in ours]


def probe(u):
    try:
        with urllib.request.urlopen(urllib.request.Request(u, method='HEAD'), timeout=25) as r:
            return r.status, (r.headers.get('Content-Type') or '')
    except urllib.error.HTTPError as e:
        return e.code, ''
    except Exception as e:
        return type(e).__name__, ''


ok, fails = 0, []
for u in ours:
    st, ct = probe(u)
    if st == 200 and ct.startswith('image/'):
        ok += 1
    else:
        fails.append(("%s %s" % (st, ct or 'no content-type'), u))
print("  %-40s %d/%d serve image/* " % ("migrated images", ok, len(ours)))
for c, u in fails[:10]:
    print("    FAIL %s %s" % (c, u))

if legacy:
    bad_legacy = sum(1 for u in legacy
                     if not (lambda r: r[0] == 200 and r[1].startswith('image/'))(probe(u)))
    print("  %-40s %d of %d not serving an image (pre-existing, informational)"
          % ("legacy non-api URLs", bad_legacy, len(legacy)))

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
