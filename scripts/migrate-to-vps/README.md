# Migrating the Modessi backend off Lovable onto the self-hosted stack

Moves the backend from the **Lovable-managed Supabase project**
(`kphkbmwycreriandedis.supabase.co`) to the **self-hosted Supabase stack already
provisioned in Coolify**, served at **`https://api.modessi.shop`**.

The storefront at `modessi.shop` is live and taking orders. Everything in steps
1–6 is invisible to shoppers: the live frontend keeps talking to Lovable until
the frontend rebuild in step 7, which is the only customer-visible moment.

The source is read-only for the whole procedure. The Lovable project is never
written to or deleted, so it stays a working rollback target.

## What is being moved

| | |
|---|---|
| Postgres | 17.6 → `supabase/postgres:17.6.1.169` (same major, no version trap) |
| Database | 25 MB — 6,665 orders, 6,870 order_items, 7,169 sms_logs |
| Catalog | 62 products, 346 variations, 3 categories, 75 wholesale prices |
| Config | 53 `admin_settings` rows, including courier/SMS/Resend credentials |
| Auth | 12 users — bcrypt hashes and identities travel intact |
| Storage | `shop-assets`, public, 121 objects / 101 MB — files re-uploaded, rows *not* transplanted |
| Schema | 53 RLS policies, 9 functions, 13 triggers (all verified after import) |

Extensions in use are `pgcrypto`, `uuid-ossp`, `pg_stat_statements` and
`supabase_vault` (0 secrets) — all standard in self-hosted Supabase. No
`pg_cron`, no `pg_net`, nothing that needs special handling.

## The trap worth knowing about

**6,861 rows hold absolute URLs to the old project.** Product images and order
thumbnails are stored as full `https://kphkbmwycreriandedis.supabase.co/...`
URLs, not relative paths:

| Where | Rows | Shape |
|---|---|---|
| `order_items.product_image` | 6,745 | uniform public-object prefix |
| `products.images` (text[]) | 27 rows / 113 elements | uniform public-object prefix |
| `admin_settings.value` | 3 (`favicon_url`, `shop_logo_url`, `site_logo`) | uniform public-object prefix |

A migration that moves the files and the rows but not these URLs *appears* to
work perfectly — every image still loads, because it is still being served by
Lovable. It breaks silently on the day that project is paused or deleted.

`04-rewrite-storage-urls.sql.tmpl` is baked into the import file by step 2 and
runs at the end of step 3. It rewrites exactly that one prefix, reports the
row counts it changed, and **raises an exception if any reference survives** —
so a partial rewrite fails the import rather than passing quietly. A further 152
image URLs point at `https://modessi.shop/wp-content/...` — legacy WordPress
files on Hostinger, deliberately left alone.

## Prerequisites

Only one thing is still outstanding:

1. **Target `service_role` key** — Coolify → the service → Environment Variables →
   `SERVICE_SUPABASESERVICE_KEY` (eye icon to reveal). Used *only* by the storage
   copy in step 4, to authenticate uploads into your own MinIO.

No longer needed, and removed from the plan:

- ~~Source Postgres URI~~ — Lovable-managed projects don't expose one, and they
  don't need to. The dashboard's **Export data** button produces a pg_dump
  custom-format archive, which `01-extract-from-backup.sh` turns into an import
  file. No source credentials at all.
- ~~SSH access~~ / ~~exposing port 5432~~ — the import goes in through Coolify's
  **Import Backup** in the browser, and anything else runs in Coolify's
  **Terminal**. The stack stays on `Use the stack network only`.
- ~~Coolify token with `deploy`~~ — done, and the stack is up (step 1).

Locally you need **Docker** (Postgres client tools run in a container) and
**Python 3** (storage copy, standard library only). Nothing to install:
no `psql`, `pg_dump`, `supabase` CLI, `rsync`, `jq` or `aws`.

```sh
cp 00-config.sh.example 00-config.sh && $EDITOR 00-config.sh
```

## Procedure

### 1. Start the stack and give it the right hostname — ✅ DONE (2026-09-14)

Service `supabase-modessi` / `nul28nblfi7lon4nizr4afdm`, project `modessi`,
**running:healthy**. Verified:

| | |
|---|---|
| `supabase-db` | `supabase/postgres:17.6.1.169` — matches source 17.6 |
| `supabase-kong` | `https://api.modessi.shop`, TLS issued, returns 401 unauthenticated |
| `minio-createbucket` | `quay.io/minio/mc:latest`, `exited` — correct for a one-shot init container |
| other 12 containers | `running:healthy` (`supabase-rest` reports `unknown:excluded` — no healthcheck defined, not a failure) |
| hostname/auth env | all present: `SUPABASE_PUBLIC_URL`, `API_EXTERNAL_URL`, `GOTRUE_SITE_URL`, `ADDITIONAL_REDIRECT_URLS`, `STORAGE_PUBLIC_URL` |

Two things had to be fixed in **Edit Compose File** before it would start, and
both are worth remembering if the service is ever rebuilt:

- **`supabase/postgres:15.8.1.085` → `17.6.1.169`.** The Coolify template shipped
  Postgres 15 while the source runs 17.6. `pg_dump` cannot target an older major,
  so a 17.6 dump will not restore into 15. Note that Coolify's *API* reported the
  image as `17.6.1.169` while the compose actually pulled 15 — the compose file is
  the only trustworthy source. Fix this **before** first boot: once PG 15
  initialises the data directory, PG 17 refuses to start against it and the
  volume has to be destroyed.
- **`minio/mc` → `quay.io/minio/mc:latest`.** MinIO withdrew their Docker Hub
  images, so the Docker Hub pull fails with a misleading
  `repository does not exist or may require 'docker login'`. Coolify already
  mirrors the MinIO *server* image to `ghcr.io/coollabsio/minio` for this reason
  but never updated the `mc` client reference.

> The service UUID changed from `xnr36zhhjemwohdqedqhybwy` when it was recreated,
> which also regenerated the JWT secret and the anon/service keys. Re-read them
> from the service environment rather than reusing anything noted earlier.

> This stack shares the host with 16 other applications. Postgres, Logflare and
> Realtime are the hungry ones — watch memory.

### 2. Turn Lovable's export into an import file — DONE (2026-09-14)

In Lovable: **Advanced settings → Export data**, download, unzip. Then:

```sh
BACKUP="/path/to/modessi2_260914.backup" ./01-extract-from-backup.sh
```

Read-only on the archive. Writes `import/modessi-import.sql` next to it, plus
the three parts separately for inspection. What it does, and why:

- Takes the `public` schema whole — 23 tables, 53 RLS policies, 9 functions,
  13 triggers, sequence positions, and the grants to
  `anon`/`authenticated`/`service_role` the authorization model runs on.
- Strips the 62 grants to Lovable's `sandbox_exec` roles, which don't exist on
  self-hosted. (Verified none of those references sit inside `COPY` data; the
  script refuses to run if that ever changes.)
- Strips the 12 `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin` statements.
  The import runs as `postgres`, which is **not** a superuser on a Supabase
  stack, so those fail with *permission denied to change default privileges* —
  and they're redundant: the stack ships equivalent default ACLs, and in
  `RESET=1` mode - the only mode that drops the schema - the dump's 12
  `FOR ROLE postgres` variants re-establish them.
- Takes `auth.users` then `auth.identities`, **in that order**. A single
  `pg_restore --table=users --table=identities` emits them alphabetically,
  which puts identities first and fails their foreign key to users.
- Takes **no** `auth` or `storage` DDL. Self-hosted GoTrue and storage-api own
  and version those schemas themselves.
- Takes **no** storage rows — see step 4.
- Appends the URL rewrite, schema-qualified, because pg_dump sets an empty
  `search_path`.

> The output holds customer PII and 12 password hashes. It lands in a
> gitignored directory; keep it that way, and delete it once the migration is
> signed off.

### 3. Import it — DONE (2026-09-14)

Coolify → the service → **Import Backup** → upload `modessi-import.sql`, and
**change the Import command** before pressing Restore From File. Two things about
Coolify's defaults will silently defeat the import otherwise:

```
psql -U postgres -d ${POSTGRES_DB:-postgres} -v ON_ERROR_STOP=1 -f
```

- Coolify's default is `pg_restore`, which only reads pg_dump *archive* formats
  and cannot read a plain SQL file. It has to be `psql`.
- The default references `$POSTGRES_USER`, which **is not set** on this service
  (only `POSTGRES_DB`/`PASSWORD`/`HOST`/`PORT`/`HOSTNAME` are). Unset, it
  expands to `psql -U -d postgres`, where `-U` swallows `-d` and you get
  `FATAL: role "-d" does not exist`. Hardcode `postgres`.
- **The trailing `-f` is load-bearing.** Coolify appends the uploaded file's
  path as a *positional argument* (that is how `pg_restore` takes an archive,
  hence no `-f` in the default). psql reads a positional argument as a database
  name, so with `-d` already given it discards the path:
  `psql: warning: extra command-line argument "/tmp/restore_..." ignored`.
  psql then reads empty stdin and **exits 0** — an import that reports success
  and does nothing at all. Ending the command with `-f` makes the appended path
  its argument.

Treat `exit code 0` alone as meaningless here. Confirm the three `NOTICE` lines
below, or verify with `05-verify.sh`.

Or, from Coolify's **Terminal** on `supabase-db`:

```sh
psql -U postgres -v ON_ERROR_STOP=1 -f /path/to/modessi-import.sql
```

The whole import is wrapped in `BEGIN; ... COMMIT;`. Postgres makes DDL
transactional, so it is **all-or-nothing**: if anything fails - including an
importer that ploughs past errors rather than stopping - everything rolls back
and the database is left exactly as it was. There is no half-migrated state to
unpick, which matters because Coolify's importer is not ours to control.

It is also pure SQL. pg_dump 17.6+ emits `\restrict`/`\unrestrict` guards around
`COPY` blocks; those are stripped, since psql understands them but an importer
that does not pipe through psql would choke. The `\.` terminators inside the 25
`COPY ... FROM stdin` blocks stay - they are part of the data format, not
meta-commands.

The file opens with a preflight block that aborts before touching anything if
the target has no `auth`/`storage` schema, if `public` already holds
`orders`/`products`/`admin_settings` (so a half-merge is impossible), or if this
GoTrue's `auth.users` is missing any column the dump writes — naming the
missing ones.

**This was dry-run end to end** against throwaway `supabase/postgres:17.6.1.169`
with `gotrue:v2.186.0` migrating the auth schema first, which is what the real
stack runs. Final run: exit 0, zero errors, and every count matched source:

| | source | imported |
|---|---|---|
| orders / order_items / sms_logs | 6,665 / 6,870 / 7,169 | identical |
| products / variations / wholesale | 62 / 346 / 75 | identical |
| admin_settings / draft_orders | 53 / 140 | identical |
| auth.users / identities | 12 / 12 | identical |
| RLS policies / functions / tables | 53 / 9 / 23 | identical |
| tables without RLS | 0 | 0 |

The rewrite reported `order_items=6745 products=27 admin_settings=3`, left the
113 legacy `modessi.shop/wp-content` URLs alone, kept the order-number sequence
at **10016** rather than restarting it, and preserved the admin role binding.

The rollback was proven, not assumed: running the same file a second time is
refused by the preflight (`public schema already has 3 of our tables`, exit 3) -
and because the file's opening `DELETE FROM auth.users` sits inside the
transaction, `auth.users` was still 12 afterwards rather than 0. A refused import
changes nothing.

### If Coolify's importer rejects the file

Its restore path has a SQL safety scanner that has [rejected legitimate backups
before](https://github.com/coollabsio/coolify/issues/11632) over
`COPY ... PROGRAM` detection; this file has none of those, but if it balks, that
is why. There may also be an upload size cap (the file is 8.8 MB). Fallbacks, in
order of preference: run it from the **Terminal** on `supabase-db` with
`psql -U postgres -v ON_ERROR_STOP=1 -f ...`; or expose 5432 in Coolify just
long enough to run it from a workstation, then close it again. Support for
restoring compose-based service databases at all landed in
[PR #7849](https://github.com/coollabsio/coolify/issues/7529) - older Coolify
builds only handled standalone databases.

### 4. Move the image files — DONE (2026-09-14): 121 objects / 101.1 MB, 0 failures

```sh
DRY_RUN=1 ./03-migrate-storage.sh    # preview
./03-migrate-storage.sh              # do it
```

Pulls all 121 objects from the source's public URLs — no source credentials
needed, the bucket is public — and uploads them with the target service key,
verifying each by content length. Re-runnable: objects already present at the
right size are skipped, so an interrupted run resumes.

**This is also what creates the `storage.objects` rows**, which is why the
import deliberately carries none. The cloud `storage.objects` has object-
versioning columns (`archived_at`, `is_delete_marker`, `is_versioned`) that
`storage-api:v1.44.2` does not have, so a `COPY` of those rows fails. Letting
storage-api write its own rows as each file lands is version-proof. The dump's
second bucket, `database_export_14_09_26`, is Lovable's own export artifact and
is not migrated.

### 5. Verify — use 06-verify-http.sh (no DB access needed); all green except step 6

```sh
./05-verify.sh
```

Checks row counts against the source snapshot, that zero rows still reference
the old project, that `has_role` / `apply_order_stock` / `rate_limit_hit` exist,
that no `public` table is missing RLS, that Kong/auth/storage answer, and that a
real product image resolves on the new host. **Do not continue unless this
passes.**

### 6. Deploy the edge functions — DONE (2026-09-14)

All 15 function directories plus `_shared` are installed in the runtime's bind
mount and the router was restarted. Verified live: `place-order` returns its own
`{"error":"Invalid name"}` validation, `courier-history` returns
`{"error":"Unauthorized"}` from `_shared/auth.ts`, and the pixel forwarders boot.

How it was done, and the traps met along the way:

- The runtime container was already running and healthy. **No new service was
  needed** - the edge runtime serves whatever is in
  `/data/coolify/services/<uuid>/volumes/functions`, mounted at
  `/home/deno/functions`. Deploying is purely a file copy.
- The container is minimal: **no curl, wget, git or deno CLI**, only `tar`. So
  the fetch has to happen from a host shell (Coolify -> Workspace -> Terminal ->
  the server), not the service's container terminal. The repo is public, so
  `curl -fsSL https://codeload.github.com/<owner>/<repo>/tar.gz/refs/heads/main`
  needs no credentials.
- `main/index.ts` and `hello/index.ts` are mounted as **individual files**, not
  just through the directory. A bind-mounted file must be written **in place**
  (`cat src > dest`) - replacing the inode with `mv`, or `rm` then create, does
  not propagate into the container. Every other function is a plain directory
  and can be `cp -r`'d.
- **Coolify ships its own `main/index.ts`** (3917 bytes). It must be overwritten
  with this repo's router (4140 bytes on LF), which carries
  `WORKER_TIMEOUT_MS = 150_000` and the `jose` JWT verification. On Coolify's
  default router, `place-order`'s deferred SMS/email work via
  `EdgeRuntime.waitUntil` would be killed early.
- `main/index.ts` is a long-lived process, so changing it needs
  `docker restart` on the container; individual functions reload per request.
- The original `InvalidWorkerCreation: could not find an appropriate entrypoint`
  was **not** about the main service - it is the per-request *user worker*
  failing because `place-order/` did not exist yet. `main function started` in
  the logs alongside that error is the tell.
- A file that reads 4140 bytes on the host against 4252 in a Windows checkout is
  just CRLF normalisation (112 lines x 1 byte), not truncation.

#### Still to set: one secret



`06-verify-http.sh` currently reports:

```
edge functions   NOT DEPLOYED - no code on disk (see step 6)
```

because `functions/v1/place-order` answers:

```
InvalidWorkerCreation: worker boot error: failed to bootstrap runtime:
could not find an appropriate entrypoint
```

The edge runtime container is healthy; there is simply no function code in its
bind mount yet, `main/index.ts` included. Until this is done the storefront
cannot place an order, so it gates step 7.

Getting the code onto the host needs one of:

- **An SSH key on `72.61.248.65`** — then `../deploy-functions.sh` rsyncs it, as
  originally designed. Cleanest.
- **Coolify's Terminal + `git clone`** — the code is already on GitHub
  (`nayeemboktheir/modessi2`); clone it on the host and copy
  `supabase/functions/` into the bind mount. Needs a token if the repo is
  private, and no file upload at all.
- **Coolify's Terminal + fetch a tarball.** Unlike the database dump, this is
  only source code with no customer data, so a short-lived URL is low risk.



Deploying is an rsync, not `supabase functions deploy` — see
[`../deploy-functions.sh`](../deploy-functions.sh):

The functions directory is a compose bind mount, and Coolify does not report it
among the service's tracked volumes (those are only the Postgres data/config
volumes and the Deno cache), so **find the real path on the host first** rather
than assuming Coolify's usual `/data/coolify/services/<uuid>/volumes/...`
layout:

```sh
ssh root@72.61.248.65 \
  "docker ps --filter name=edge-functions --format '{{.Names}}' | head -1"

ssh root@72.61.248.65 \
  "docker inspect <container-from-above> \
     --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{\"\n\"}}{{end}}'"
```

Take the source path mapped to `/home/deno/functions`, then:

```sh
SSH_HOST=root@72.61.248.65 \
FUNCTIONS_DIR=<the path you just found> \
CONTAINER=<the container name> \
  ../deploy-functions.sh
```

**Only one courier secret actually has to be an env var.** The functions resolve
credentials from `admin_settings` first and fall back to the environment, and
every courier key is already among the 53 `admin_settings` rows that arrive with
the dump — so Steadfast, Carrybee and `combined-courier-history` work with no env
vars at all.

The exception is
[`courier-history/index.ts`](../../supabase/functions/courier-history/index.ts),
which reads `BDCOURIER_API_KEY` from the environment *only*, with no
`admin_settings` fallback, and returns a 400 without it. Set just this one on the
`supabase-edge-functions` container, copying the value out of
`admin_settings.bdcourier_api_key`:

```
BDCOURIER_API_KEY
```

The rest — `STEADFAST_API_KEY`, `STEADFAST_SECRET_KEY`, `CARRYBEE_CLIENT_ID`,
`CARRYBEE_CLIENT_SECRET`, `CARRYBEE_CLIENT_CONTEXT`, `CARRYBEE_BASE_URL` — are
optional belt-and-braces fallbacks, not requirements, while `admin_settings`
holds them.

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and
`JWT_SECRET` are injected by the stack. The Resend key and order-email sender
are **not** env vars either — they live in `admin_settings` and came across with
the dump.

Keep `FUNCTIONS_VERIFY_JWT` as it is on this stack. Remember that the router
only checks the JWT *signature*, and the anon key is a valid signed JWT that
ships in the browser bundle — so every function still authorizes for itself via
`_shared/auth.ts`. That is unchanged by the migration.

### 6c. The current target is a REHEARSAL, not the final state

Everything above was done from an export taken **2026-09-14 09:54 UTC**. The
store never stopped trading, so the target is already behind. Measured on
2026-09-15:

| | in the import | live on Lovable | drift |
|---|---|---|---|
| orders | 6,665 | 6,678 | **+13** |
| order_items | 6,870 | 6,884 | +14 |
| sms_logs | 7,169 | 7,182 | +13 |
| storage objects | 121 | 122 | +1 |
| products / settings / drafts | - | - | 0 |

**Do not try to sync just the new rows.** Inserts are not the problem; updates
are. Of the orders that existed in the snapshot, **11 have since been updated** -
all 11 moved to shipped/delivered and had `tracking_number` set. A row-level
delta that copies only new orders would leave those 11 looking pending on the
new backend, and `steadfast-courier` only refuses to re-dispatch an order that
already has a `tracking_number` - so the missed updates could send parcels to
the courier twice. That is audit finding #14 reopening itself.

The correct cutover is a **fresh export and a full re-import**, which is what
`RESET=1` is for.

#### Cutover sequence

Do the slow, reversible parts first, so the window is short.

**Beforehand (no downtime, nothing customer-visible):**

1. Set the GitHub Actions secrets - `VITE_SUPABASE_URL=https://api.modessi.shop`
   and `VITE_SUPABASE_PUBLISHABLE_KEY=<the new anon key>`. Setting them changes
   nothing until the workflow runs.
2. Configure Backups (6b) and confirm a restore works.
3. Note the newest order, so you can detect anything that slips through:
   `select max(order_number), max(created_at) from orders;` on Lovable.

**The window itself (~15-20 minutes, mostly the frontend build):**

4. Export from Lovable: **Advanced settings -> Export data**, download, unzip.
5. Regenerate in cutover mode:
   ```sh
   BACKUP=/path/to/modessi2_<today>.backup RESET=1 ./01-extract-from-backup.sh
   ```
   `RESET=1` makes the import drop the rehearsal's public schema and auth rows
   first, inside the same transaction - so it is still all-or-nothing.
6. Import it exactly as in step 3 (Coolify -> Import Backup, command ending
   `-f`).
7. `./03-migrate-storage.sh` - incremental, so it skips the 121 already there
   and uploads only what is new.
8. `./06-verify-http.sh` - must be all green. Update the expected counts at the
   top of section 1 to the fresh figures first.
9. Run the **Build and Deploy to Hostinger** workflow. This is the only
   customer-visible moment, and it also ships six weeks of unreleased frontend
   work.
10. Smoke-test (step 8).

**Afterwards:** re-query Lovable for anything newer than the order number you
noted in (3) and re-enter it by hand. At the current rate - 13 orders in 28
hours, about one every two hours - a 20-minute window should catch nothing, but
check rather than assume.

Leave the Lovable project running and untouched for a rollback window.

### 6b. Configure backups — do not skip this

Managed Supabase backed this database up whether anyone thought about it or not.
Self-hosted does not. The moment step 7 completes, **6,665 orders of live revenue
history** sit on a self-hosted Postgres, on a host shared with 16 other
applications, with no backup unless one is configured here.

Coolify → the service → **Backups** (and **S3 Storage** for an offsite target).
The database is 25 MB, so a daily dump costs essentially nothing. Set this up
*before* step 7, not after — and confirm one restore actually works, because an
untested backup is a guess.

### 7. Repoint and redeploy the frontend — the only customer-visible step

The Supabase URL and key are baked in at build time, so this is a rebuild, not
a config flip.

1. Update the GitHub Actions secrets on `nayeemboktheir/modessi2`:
   - `VITE_SUPABASE_URL` → `https://api.modessi.shop`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` → the target's **anon** key
     (`SERVICE_SUPABASEANON_KEY`)
   - `VITE_SUPABASE_PROJECT_ID` → any stable identifier; nothing authorizes on it
2. Update local `.env` to match, so dev points at the new backend too.
3. Run the **Build and Deploy to Hostinger** workflow (`workflow_dispatch`).

> **This deploy also ships six weeks of unreleased work.** `origin/deploy` is
> 569 commits behind `origin/main` — it was last built 2026-08-04. The cutover
> build carries the entire audit remediation and the code-splitting change along
> with the backend switch. The two cannot be separated, so treat step 7 as both
> a backend cutover *and* a large frontend release, and smoke-test accordingly.

### 8. Smoke-test against the real store

- Home, product detail, category pages — images load from `api.modessi.shop`
- Admin sign-in, and `/admin/orders` lists the full 6,665-order history
- **Place a real test order**, confirm the row lands, the order number is
  sequential, stock deducts, and SMS/email fire
- Courier dispatch on the test order, then delete it
- `/reset-password` — the GoTrue redirect URL from step 1 is what makes this work

### 9. Afterwards

- Leave the Lovable project **running but untouched** for a rollback window.
  Rolling back = restore the old GitHub secrets and re-run the deploy workflow;
  the old backend still has all its data because nothing ever wrote to it.
- Once settled, decide the Lovable project's fate. Note that its editor loses
  its backend when you stop paying for it, and the images it serves are only
  safe to drop after step 4 plus the URL rewrite are confirmed.
- `CLAUDE.md` describes the backend as self-hosted on Coolify, which is
  currently wrong and becomes correct the moment this finishes. Worth adding
  what it still omits: Drizzle (`drizzle.config.ts`, `LOVABLE_DB_MIGRATION_URL`)
  now sits alongside `supabase/migrations`.

## Rollback

Before step 7 there is nothing to roll back — the live site is still on Lovable.
After step 7, restore the previous GitHub secrets and re-run the deploy
workflow. Keep in mind that any orders placed on the new backend after cutover
live only there, so roll back promptly or migrate those rows forward.

## Files

| File | |
|---|---|
| `01-extract-from-backup.sh` | turns Lovable's export into `modessi-import.sql` |
| `04-rewrite-storage-urls.sql.tmpl` | URL rewrite, templated into the import; idempotent, fails loudly |
| `03-migrate-storage.py` | enumerate, copy and verify all 121 objects; creates the storage rows |
| `03-migrate-storage.sh` | config wrapper for the above |
| `05-verify.sh` | counts, RLS, functions, HTTP, a real product image |
| `00-config.sh.example` | copy to `00-config.sh` (gitignored) for the storage step |
| `01-dump-source.sh`, `02-restore-target.sh` | superseded by 01-extract-from-backup.sh; kept only for a live-URI source |
