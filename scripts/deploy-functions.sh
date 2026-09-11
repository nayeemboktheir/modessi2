#!/usr/bin/env bash
# Deploy edge functions to the self-hosted Supabase stack.
#
# `supabase functions deploy` only talks to Supabase Cloud's management API, which
# self-hosted instances do not have. Instead the edge-runtime container serves
# whatever is in its /home/deno/functions bind mount, so deploying is a file sync.
#
# Usage:
#   SSH_HOST=root@your-server FUNCTIONS_DIR=/data/coolify/services/<uuid>/volumes/functions \
#     ./scripts/deploy-functions.sh
#
# Find FUNCTIONS_DIR with:
#   docker inspect <edge-functions-container> \
#     --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{"\n"}}{{end}}'

set -euo pipefail

: "${SSH_HOST:?set SSH_HOST, e.g. root@your-server}"
: "${FUNCTIONS_DIR:?set FUNCTIONS_DIR, the host path bind-mounted to /home/deno/functions}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$REPO_ROOT/supabase/functions/"

CONTAINER="${CONTAINER:-}"

echo "Syncing $SRC -> $SSH_HOST:$FUNCTIONS_DIR"
rsync -av --delete \
  --exclude '.DS_Store' \
  "$SRC" "$SSH_HOST:$FUNCTIONS_DIR/"

# Individual functions are re-read per request, but main/index.ts is the
# long-running router process and only reloads on restart.
if [ -n "$CONTAINER" ]; then
  echo "Restarting $CONTAINER to pick up main/index.ts"
  ssh "$SSH_HOST" "docker restart $CONTAINER"
else
  echo
  echo "Done. If main/index.ts changed, restart the supabase-edge-functions"
  echo "container (Coolify UI, or re-run with CONTAINER=<name> set)."
fi
