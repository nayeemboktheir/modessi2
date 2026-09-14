#!/usr/bin/env bash
# Wrapper: load config and run the storage copy.
# Preview without writing anything:  DRY_RUN=1 ./03-migrate-storage.sh
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./00-config.sh
export SOURCE_URL SOURCE_ANON_KEY TARGET_URL TARGET_SERVICE_KEY BUCKET
exec python3 ./03-migrate-storage.py
