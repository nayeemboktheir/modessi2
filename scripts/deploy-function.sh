#!/usr/bin/env bash
# Interactive edge-function deployer. Run this ON the Coolify host:
#
#   Coolify -> Workspace -> Terminal -> pick the server (NOT a container)
#   curl -fsSL https://raw.githubusercontent.com/nayeemboktheir/modessi2/main/scripts/deploy-function.sh | bash
#
# It discovers the container and its bind mount itself, shows which functions
# differ between the repo and the host, and copies only what you choose. See
# supabase/functions/DEPLOYING.md for the reasoning behind each step.
set -uo pipefail

REPO="${REPO:-nayeemboktheir/modessi2}"
BRANCH="${BRANCH:-main}"
API="${API:-https://api.modessi.shop}"

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
dim()  { printf '\033[2m%s\033[0m\n' "$*"; }
warn() { printf '\033[33m%s\033[0m\n' "$*"; }
err()  { printf '\033[31m%s\033[0m\n' "$*" >&2; }
ok()   { printf '\033[32m%s\033[0m\n' "$*"; }

for c in docker curl tar; do
  command -v "$c" >/dev/null || { err "missing $c - are you on the host shell, not a container?"; exit 1; }
done

# ---- 1. find the container and the directory it serves ---------------------
CID="$(docker ps --filter name=edge-functions --format '{{.Names}}' | head -1)"
[ -n "$CID" ] || { err "no running edge-functions container found"; exit 1; }

FUNCS="$(docker inspect "$CID" \
  --format '{{range .Mounts}}{{if eq .Destination "/home/deno/functions"}}{{.Source}}{{end}}{{end}}')"
[ -n "$FUNCS" ] && [ -d "$FUNCS" ] || { err "could not resolve the functions bind mount"; exit 1; }

bold "container : $CID"
bold "functions : $FUNCS"
echo

# ---- 2. fetch the repo ----------------------------------------------------
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
dim "fetching $REPO@$BRANCH ..."
curl -fsSL "https://codeload.github.com/$REPO/tar.gz/refs/heads/$BRANCH" -o "$TMP/r.tar.gz" \
  || { err "download failed"; exit 1; }
tar -xzf "$TMP/r.tar.gz" -C "$TMP"
# The archive has a single top-level directory named <repo>-<branch>, so resolve
# it rather than guessing a depth.
TOP="$(find "$TMP" -mindepth 1 -maxdepth 1 -type d ! -name '*.tar.gz' | head -1)"
SRC="$TOP/supabase/functions"
if [ ! -d "$SRC" ]; then
  err "supabase/functions not found in the archive"
  dim "  archive top level: ${TOP:-<none>}"
  dim "  looked for:        $SRC"
  exit 1
fi

# ---- 3. compare repo vs host ---------------------------------------------
# A directory's fingerprint is the sorted list of its files' checksums, so a
# change to any file inside it shows up.
fingerprint() {
  local d="$1"
  [ -d "$d" ] || { echo "ABSENT"; return; }
  find "$d" -type f ! -name '.DS_Store' -exec md5sum {} + 2>/dev/null \
    | sed "s#$d/##" | sort -k2 | md5sum | cut -d' ' -f1
}

names=(); status=(); changed=()
i=0
for d in "$SRC"/*/; do
  n="$(basename "$d")"
  a="$(fingerprint "$d")"; b="$(fingerprint "$FUNCS/$n")"
  if   [ "$b" = "ABSENT" ]; then st="NEW"
  elif [ "$a" != "$b" ];    then st="CHANGED"
  else                           st="same"
  fi
  i=$((i+1)); names+=("$n"); status+=("$st")
  [ "$st" = same ] || changed+=("$n")
done

bold "repo vs host"
for idx in "${!names[@]}"; do
  n="${names[$idx]}"; st="${status[$idx]}"
  case "$st" in
    NEW)     printf '  %2d) \033[32m%-26s NEW\033[0m\n'     "$((idx+1))" "$n" ;;
    CHANGED) printf '  %2d) \033[33m%-26s CHANGED\033[0m\n' "$((idx+1))" "$n" ;;
    *)       printf '  %2d) \033[2m%-26s same\033[0m\n'     "$((idx+1))" "$n" ;;
  esac
done

# Host directories with no counterpart in the repo are left alone (Coolify's
# sample `hello/` lives here); flag them so they are not a mystery.
for d in "$FUNCS"/*/; do
  n="$(basename "$d")"
  [ -d "$SRC/$n" ] || dim "      $n  (on host only - not touched)"
done

echo
if [ ${#changed[@]} -eq 0 ]; then
  ok "host already matches the repo - nothing to deploy"
  exit 0
fi
bold "${#changed[@]} function(s) differ: ${changed[*]}"
echo

# ---- 4. choose ------------------------------------------------------------
cat <<'MENU'
  d  deploy only what differs   (recommended)
  a  deploy every function
  1 3 7 ...  deploy these numbers
  q  quit
MENU
printf 'choice: '; read -r choice

selected=()
case "${choice:-q}" in
  q|Q|'') echo "nothing done"; exit 0 ;;
  d|D)    selected=("${changed[@]}") ;;
  a|A)    selected=("${names[@]}") ;;
  *)      for tok in $choice; do
            case "$tok" in
              ''|*[!0-9]*) err "not a number: $tok"; exit 1 ;;
            esac
            idx=$((tok-1))
            [ -n "${names[$idx]:-}" ] || { err "no such entry: $tok"; exit 1; }
            selected+=("${names[$idx]}")
          done ;;
esac

echo; bold "deploying: ${selected[*]}"; echo

# ---- 5. copy --------------------------------------------------------------
router_changed=0
for n in "${selected[@]}"; do
  if [ "$n" = main ]; then
    # main/index.ts is an individual file bind mount: the inode must be kept,
    # so write through it rather than replacing it.
    cat "$SRC/main/index.ts" > "$FUNCS/main/index.ts" \
      && { ok "  main/index.ts written in place ($(stat -c %s "$FUNCS/main/index.ts") bytes)"; router_changed=1; } \
      || err "  main/index.ts FAILED"
  else
    rm -rf "$FUNCS/$n" && cp -r "$SRC/$n" "$FUNCS/$n" \
      && ok "  $n" || err "  $n FAILED"
  fi
done

# ---- 6. restart only if the router changed -------------------------------
echo
if [ "$router_changed" = 1 ]; then
  warn "main/index.ts changed - the router is a long-lived process, restarting"
  docker restart "$CID" >/dev/null && ok "restarted"
  sleep 6
  docker logs --tail 8 "$CID" 2>&1 | sed 's/^/    /'
else
  dim "no restart needed - individual functions are read per request"
fi

# ---- 7. prove it landed ---------------------------------------------------
echo
bold "verifying"
for n in "${selected[@]}"; do
  [ "$n" = main ] || [ "$n" = _shared ] && continue
  [ -f "$FUNCS/$n/index.ts" ] \
    && ok "  $n/index.ts present on host" \
    || err "  $n/index.ts MISSING - the copy did not land"
done

if [ -n "${ANON_KEY:-}" ]; then
  echo
  dim "  a 401/403 below means the worker booted and the auth guard rejected us - that is success"
  for n in "${selected[@]}"; do
    case "$n" in main|_shared) continue ;; esac
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 -X POST \
      -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
      -H 'Content-Type: application/json' -d '{}' "$API/functions/v1/$n")"
    printf '  %-28s HTTP %s\n' "$n" "$code"
  done
else
  dim "  set ANON_KEY=... to also call each endpoint and check it boots"
fi

echo
ok "done"
dim "watch traffic with:  docker logs -f --tail 20 $CID"
