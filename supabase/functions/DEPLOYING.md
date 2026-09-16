# Deploying an edge function

`supabase functions deploy` **does not work here.** It talks to Supabase Cloud's management API,
which a self-hosted stack has no equivalent of. Deploying is a **file copy** into a directory the
running container already watches.

| | |
|---|---|
| Host | `72.61.248.65` (the Coolify host) |
| Coolify service | `supabase-modessi` / `nul28nblfi7lon4nizr4afdm` |
| Container | `supabase-edge-functions-nul28nblfi7lon4nizr4afdm` |
| Host directory | `/data/coolify/services/nul28nblfi7lon4nizr4afdm/volumes/functions` |
| Mounted at | `/home/deno/functions` |

Confirm the directory rather than trusting the path above — Coolify does not list this mount among
the service's volumes, so it can only be read off the container:

```sh
CID=$(docker ps --filter name=edge-functions --format '{{.Names}}' | head -1)
docker inspect "$CID" --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{"\n"}}{{end}}'
```

---

## The easy path

[`scripts/deploy-function.sh`](../../scripts/deploy-function.sh) does everything below
interactively. Run it on the **host** shell (Coolify → Workspace → Terminal → pick the server):

```sh
curl -fsSL \
  https://raw.githubusercontent.com/nayeemboktheir/modessi2/main/scripts/deploy-function.sh \
  -o /tmp/deploy-function.sh
bash /tmp/deploy-function.sh
```

Do **not** use `curl ... | bash` for this script. It is interactive, and piping its source into
Bash also consumes Bash's standard input. The menu will be printed, but the script receives
end-of-file instead of waiting for a choice and exits with `nothing done`.

It finds the container and its bind mount itself, fetches `main`, then shows what actually differs:

```
repo vs place-order            same
repo vs send-sms               CHANGED
repo vs steadfast-management   NEW
      hello  (on host only - not touched)

  d  deploy only what differs   (recommended)
  a  deploy every function
  1 3 7 ...  deploy these numbers
```

It writes `main/index.ts` in place rather than replacing it, restarts the container **only** if the
router changed, and then checks each deployed function landed. Export `ANON_KEY=...` first and it
will also call each endpoint — a 401/403 there is success, since it proves the worker booted and the
auth guard did its job.

For the complete Steadfast integration, select the numbers currently shown for these four entries:

```
_shared
steadfast-courier
steadfast-management
steadfast-status
```

For example, if the displayed numbers are `1`, `14`, `15`, and `16`, enter:

```
choice: 1 14 15 16
```

Menu numbers can change as functions are added, so match the displayed names instead of blindly
reusing old numbers. No restart is needed after deploying only these entries. If `main` is selected
and changed, the script restarts the Edge Functions container automatically.

Read the rest of this document when something goes wrong, or when writing a new function (step 1 is
the part that matters for correctness).

## 1. Write the function

```
supabase/functions/my-function/index.ts
```

**Authorize inside the function.** The router only checks that the JWT is *signed*, and the
publishable anon key is a valid signed JWT that ships in the browser bundle — so getting past the
router proves nothing about who is calling. Anything that spends money, touches customer data, or
calls a paid third-party API must guard itself:

```ts
import { requireAdmin } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const auth = await requireAdmin(req);        // or requireAdminOrInternal
  if (!auth.ok) return auth.response;
  // ...
});
```

- `requireAdmin` — a real admin user only. Use for anything reading customer data or dispatching
  couriers.
- `requireAdminOrInternal` — also accepts the service-role key, for function-to-function calls.
  Used by `send-sms` and `send-order-email`.

Genuinely public endpoints (the ad-pixel forwarders, `place-order`) must instead be **rate limited**
via [`_shared/rateLimit.ts`](_shared/rateLimit.ts), because a fresh worker is spawned per request
and module-level counters are therefore useless. Anything that must persist between calls belongs in
a table — see `rate_limit_hits` and `courier_lookup_cache`.

Test the shape locally before deploying; there is no staging stack.

## 2. Commit and push

The host pulls from GitHub, so the function must be on `main` first.

```sh
git add supabase/functions/my-function
git commit -m "feat: add my-function edge function"
git push
```

## 3. Copy it onto the host

### With SSH access

```sh
SSH_HOST=root@72.61.248.65 \
FUNCTIONS_DIR=/data/coolify/services/nul28nblfi7lon4nizr4afdm/volumes/functions \
CONTAINER=supabase-edge-functions-nul28nblfi7lon4nizr4afdm \
  ./scripts/deploy-functions.sh
```

### Without SSH — via Coolify's terminal

Use **Coolify → Workspace → Terminal → the server**, *not* the service's container terminal. The
edge-runtime container is minimal: it has `tar` but **no `curl`, `wget`, `git` or `deno` CLI**, so it
cannot fetch anything itself.

```sh
FUNCS=/data/coolify/services/nul28nblfi7lon4nizr4afdm/volumes/functions
cd /tmp
curl -fsSL https://codeload.github.com/nayeemboktheir/modessi2/tar.gz/refs/heads/main -o m.tar.gz
tar -xzf m.tar.gz
SRC=/tmp/modessi2-main/supabase/functions

# ---- EITHER: one named function (substitute the real directory name) ----
NAME=my-function
rm -rf "$FUNCS/$NAME"
cp -r "$SRC/$NAME" "$FUNCS/$NAME"

# ---- OR: every function in the repo, no names needed --------------------
# Overwrites each one with what is on main. Idempotent - unchanged functions
# are simply rewritten with identical code - so this is the safer default when
# several functions changed, or when you are unsure which did. Skips main/
# (see the warning below) and does NOT delete host-only directories, so
# Coolify's sample `hello/` survives harmlessly.
for d in "$SRC"/*/; do
  n=$(basename "$d"); [ "$n" = main ] && continue
  rm -rf "$FUNCS/$n"; cp -r "$d" "$FUNCS/$n"; echo "installed $n"
done

rm -rf /tmp/m.tar.gz /tmp/modessi2-main
```

> **`main/index.ts` is special — never `cp` over it.** It is mounted as an *individual file*, not
> just through the directory, so replacing the inode (`cp` that unlinks, `mv`, or `rm` then create)
> does **not** propagate into the container. Write it in place instead:
>
> ```sh
> cat "$SRC/main/index.ts" > "$FUNCS/main/index.ts"
> ```
>
> Also: Coolify ships **its own** `main/index.ts` (3917 bytes). If the service is ever rebuilt it
> will overwrite ours, which silently removes `WORKER_TIMEOUT_MS = 150_000` and breaks
> `place-order`'s deferred SMS/email work. After any service redeploy, check:
>
> ```sh
> stat -c '%s bytes' "$FUNCS/main/index.ts"          # want 4140, not 3917
> grep -c WORKER_TIMEOUT_MS "$FUNCS/main/index.ts"   # want 2
> ```

## 4. Restart — only if you changed the router

| Changed | Restart needed? |
|---|---|
| A single function's `index.ts` | **No** — functions are read per request |
| `_shared/*.ts` | No |
| `main/index.ts` | **Yes** — it is one long-lived process |
| Any container env var | Yes, and it must be *recreated*, not restarted |

```sh
docker restart supabase-edge-functions-nul28nblfi7lon4nizr4afdm
sleep 6 && docker logs --tail 20 supabase-edge-functions-nul28nblfi7lon4nizr4afdm
```

Expect `main function started` in the log.

## 5. If the function must be callable without a JWT

Do **not** edit the router. The opt-out list is read from an env var:

```
FUNCTIONS_NO_VERIFY_JWT = tiktok-events-api,my-function
```

Set it in Coolify → the service → Environment Variables. `verify_jwt` in `supabase/config.toml` is
documentation only — nothing reads it.

Because this is an env var, the container must be **recreated**: Coolify → **Actions → Restart**.
A plain `docker restart` will not pick it up, since environment is fixed at container creation.

A public function must be rate limited (step 1) and must still validate its own input.

## 6. Secrets

Container env vars in Coolify → the service → Environment Variables. `SUPABASE_URL`,
`SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `JWT_SECRET` are injected by the stack — do not
add them yourself.

Two things deliberately live in `admin_settings` instead, because they are editable from the admin
panel: `resend_api_key` and `order_email_from`.

Courier functions read `admin_settings` **first** and fall back to the environment. The exception is
`courier-history`, which reads `BDCOURIER_API_KEY` from the environment **only** and returns 400
without it.

## 7. Verify

```sh
curl -s -X POST https://api.modessi.shop/functions/v1/my-function \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
  -H 'Content-Type: application/json' -d '{}'
```

A **401 `{"error":"Unauthorized"}`** from an admin-guarded function is success — it proves the worker
booted and `_shared/auth.ts` rejected an anonymous caller. What you are checking for is that the
function *ran*, not that it returned 200.

`scripts/migrate-to-vps/06-verify-http.sh` includes an edge-function check as part of a full
stack verification.

## Redeploying an existing function

Same copy, and normally **no restart**:

```sh
FUNCS=/data/coolify/services/nul28nblfi7lon4nizr4afdm/volumes/functions
cd /tmp
curl -fsSL https://codeload.github.com/nayeemboktheir/modessi2/tar.gz/refs/heads/main -o m.tar.gz
tar -xzf m.tar.gz
rm -rf "$FUNCS/my-function"
cp -r /tmp/modessi2-main/supabase/functions/my-function "$FUNCS/my-function"
rm -rf /tmp/m.tar.gz /tmp/modessi2-main
```

The router spawns a fresh worker per request, and local files are read from disk each time, so the
next call picks up the change. `noModuleCache: false` in `main/index.ts` governs caching of
**remote** dependencies (the `deno-cache` volume), not your local `index.ts` — so if you add or
change a remote import URL, restart to be certain.

Confirm it is really live by watching the log while you call it:

```sh
docker logs -f --tail 20 supabase-edge-functions-nul28nblfi7lon4nizr4afdm
```

`serving the request with /home/deno/functions/my-function` means the copy landed. A restart costs
about six seconds, so when in doubt, restart rather than wonder.

## Failure signatures

| Symptom | Cause |
|---|---|
| `InvalidWorkerCreation: could not find an appropriate entrypoint`, **with** `main function started` in the log | The router is fine; the *user worker* failed because `my-function/index.ts` is not on disk. The copy did not land. |
| Same error and **no** `main function started` | `main/index.ts` itself is missing or unreadable. |
| Function 404s at the gateway | Directory name must match the URL path exactly; the file must be `index.ts`. |
| Edits appear to do nothing | Editing a file that is an individual bind mount (`main/index.ts`) by replacing the inode. Use `cat src > dest`. |
| A new env var has no effect | Container was restarted, not recreated. Use Coolify → Actions → Restart. |
| `403 Admin access required` when you expected internal access | `requireAdmin` rejects the service-role key; use `requireAdminOrInternal`. |
| Host file is 4140 bytes but the checkout says 4252 | CRLF normalisation (112 lines × 1 byte), not truncation. |
| The menu appears and immediately says `nothing done` | The interactive script was piped into Bash. Download it to `/tmp` first, then run `bash /tmp/deploy-function.sh`. |
| `supabase/functions not found in the archive` | The function changes are not on the fetched branch yet, or the script is pointed at the wrong repository/branch. Push or merge them into `main`, then retry. |
