# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm ci               # install (npm is the source of truth; bun.lock* is stale)
npm run dev          # Vite dev server on http://localhost:8080
npm run build        # production bundle into dist/
npm run lint         # eslint
```

There is no test framework in this repo — no test runner, no test files. Verify changes by running
the app.

After any schema change, regenerate the DB types so `src/integrations/supabase/types.ts` matches:

```sh
supabase gen types typescript --db-url "$SUPABASE_DB_URL" > src/integrations/supabase/types.ts
```

Deploy edge functions (see "Edge functions" below — `supabase functions deploy` does not work here):

```sh
SSH_HOST=root@72.61.248.65 FUNCTIONS_DIR=/data/coolify/services/nul28nblfi7lon4nizr4afdm/volumes/functions   ./scripts/deploy-functions.sh
```

Without an SSH key, do it from Coolify -> Workspace -> Terminal -> the **server** (not the service's
container terminal, which has no `curl`, `wget`, `git` or `deno` — only `tar`): fetch
`https://codeload.github.com/nayeemboktheir/modessi2/tar.gz/refs/heads/main`, `cp -r` each function
directory into `$FUNCTIONS_DIR`, then `docker restart` the edge-functions container.

Easiest is [scripts/deploy-function.sh](scripts/deploy-function.sh) run on the host shell — it
resolves the container and mount itself, shows which functions differ from `main`, copies only what
you pick, and restarts only if the router changed. Full procedure and failure signatures:
[supabase/functions/DEPLOYING.md](supabase/functions/DEPLOYING.md).

## Architecture

Single-page Vite + React 18 + TypeScript app serving both a Bangladeshi fashion storefront and its
admin panel from one bundle, against a **self-hosted** Supabase stack (Coolify), not Supabase Cloud.
`@/` aliases `src/`.

### Front end

- **Routing** — every route is declared in [src/App.tsx](src/App.tsx) (no nested route configs) and
  every route component except the home page is `React.lazy`-loaded behind a single `<Suspense>`, so
  the storefront bundle does not carry the admin panel. Admin pages are wrapped inline as
  `<AdminLayout><AdminX /></AdminLayout>`; `/admin/order-protection` and
  `/admin/landing-video-settings` are not wrapped at the route level because those two components
  wrap themselves. `*` falls through to the home page, so `NotFound.tsx` is unused but kept.
- **Two state systems coexist.** Redux Toolkit ([src/store/](src/store/)) holds cart and wishlist,
  which persist to `localStorage` inside the slices themselves; TanStack Query holds all
  server-derived data. Most pages call Supabase directly through `useQuery` rather than going
  through [src/services/](src/services/) — the service layer (`productService`, `orderService`,
  `adminService`) is partial, so check whether a helper exists before adding a duplicate query.
- **Auth** — [src/hooks/useAuth.tsx](src/hooks/useAuth.tsx) is a context provider over Supabase
  GoTrue that also resolves `isAdmin` by querying `user_roles`, with a 1-minute module-level cache
  that is cleared on sign-out. `AdminLayout` gates admin routes on it, but that is convenience only:
  real authorization is RLS in the database and an explicit role check in the edge functions.
- **Site configuration** lives in the `admin_settings` table as loose `key`/`value` rows, read
  ad-hoc by whichever component needs it (`Header`, `Footer`, `FaviconLoader`, print dialogs,
  pixel hooks). Adding a setting means adding a row plus a reader — there is no central config
  module.
- **Ad tracking is dual-path**: browser pixels (`useFacebookPixel`, `useGoogleAnalytics`,
  `useTikTokPixel`, mounted via `GlobalAppEffects`, suppressed on `/admin`) plus server-side
  forwarding through `useServerTracking` → the `facebook-capi` / `google-analytics` /
  `tiktok-events-api` functions. Events carry a shared `eventId` for dedup. Purchase is fired only
  on the order-confirmation page, never in `place-order`.

### Backend

`VITE_SUPABASE_URL` points at the stack's Kong gateway (`/auth/v1`, `/rest/v1`, `/storage/v1` —
MinIO bucket `shop-assets` —, `/functions/v1`). Schema history is in `supabase/migrations`.

The stack is **`https://api.modessi.shop`** — Coolify service `supabase-modessi`
(`nul28nblfi7lon4nizr4afdm`), Postgres `supabase/postgres:17.6.1.169`, on the Coolify host
`72.61.248.65` alongside ~16 unrelated applications. Postgres is on *"Use the stack network only"*,
so there is **no direct DB connection from outside**: inspect the database through PostgREST with
the service-role key, or `psql` inside Coolify's terminal on `supabase-db`. Migrated off
Lovable-managed Supabase in September 2026; that project (`kphkbmwycreriandedis`) is paused and
nothing references it — `scripts/migrate-to-vps/` holds the toolkit and a full account of how it was
done, including `06-verify-http.sh`, which verifies the whole stack over HTTP alone. Its row-count
assertions are a **post-import** check: once the store is trading they drift by design.

**A second application shares this database.** `wholesale.modessi.shop` is a separate React app
(private repo `tanviralamtusar/Modessi-Wholesale`, deployed as its own Coolify app) that reads
`products`, `product_variations`, `categories` and `wholesale_prices` **anonymously** — which is why
`wholesale_prices` carries an `"Anyone can view active wholesale prices"` SELECT policy. It holds
only the anon key and cannot write. Schema or RLS changes to those four tables break it, and it has
to be redeployed separately whenever the backend URL or anon key changes.

**Authorization is entirely in Postgres.** Every table has RLS; admin access is gated by
`public.has_role(auth.uid(), 'admin')` against `user_roles` (enum `app_role`: `admin` | `user`).
There is no application-layer fallback — treat policy changes with care.

Core tables: `products` / `product_variations` / `categories`, `orders` / `order_items`,
`draft_orders` (abandoned checkouts surfaced as "Incomplete Orders"), `cart_items`,
`wishlist_items`, `profiles`, `user_roles`, `admin_settings`, `landing_pages`, `home_page_content`,
`banners`, `coupons`, `wholesale_prices`, `sms_templates` / `sms_logs`, `contact_submissions`,
`reviews`.

### Edge functions (`supabase/functions`)

Self-hosted Edge Runtime runs [supabase/functions/main/index.ts](supabase/functions/main/index.ts)
as a single long-lived router that verifies the JWT and spawns a user worker per request. Consequences:

- **Deploying is a file copy**, not `supabase functions deploy`. The runtime serves whatever is in
  `/data/coolify/services/<uuid>/volumes/functions`, bind-mounted at `/home/deno/functions`.
  Individual functions reload per request; changes to `main/index.ts` need a container restart. Three
  traps, all of which have bitten:
  - **Coolify ships its own `main/index.ts`** (3917 bytes) and it must be overwritten with this
    repo's router, which carries `WORKER_TIMEOUT_MS = 150_000` and the `jose` JWT verification. On
    Coolify's default router `place-order`'s `EdgeRuntime.waitUntil` work is killed early.
  - `main/index.ts` and `hello/index.ts` are mounted as **individual files**, not just through the
    directory, so they must be written **in place** (`cat src > dest`) — replacing the inode with
    `mv`, or `rm` then create, does not propagate into the container. Every other function is a
    plain directory and can be `cp -r`'d.
  - `InvalidWorkerCreation: could not find an appropriate entrypoint` alongside
    `main function started` in the logs is **not** about the router — it is the per-request *user
    worker* failing because that function's directory is missing.
  - A file reading 4140 bytes on the host against 4252 in a Windows checkout is CRLF normalisation
    (112 lines x 1 byte), not truncation.
- **The router only checks that the JWT is signed**, driven by the `FUNCTIONS_VERIFY_JWT` and
  `FUNCTIONS_NO_VERIFY_JWT` env vars on the `supabase-edge-functions` container (`verify_jwt` in
  `supabase/config.toml` is documentation only — nothing reads it). The publishable anon key is a
  valid signed JWT and ships in the browser bundle, **so passing the router proves nothing about the
  caller.** Every function that spends money or touches customer data authorizes for itself via
  [`_shared/auth.ts`](supabase/functions/_shared/auth.ts): `requireAdmin` on the courier and history
  functions, `requireAdminOrInternal` (which also accepts the service-role key, for
  function-to-function calls) on `send-sms` and `send-order-email`. Add that guard to any new
  function unless it genuinely must be public.
- **Each request runs in a freshly spawned worker**, so module-level state does not survive between
  calls. Anything that needs to persist — caches, rate-limit counters — belongs in a table; see
  `courier_lookup_cache` and [`_shared/courierCache.ts`](supabase/functions/_shared/courierCache.ts).
- Secrets (courier keys, SMS credentials) are container env vars in Coolify. The Resend key and the
  order-email sender are the exception: they live in `admin_settings`
  (`resend_api_key`, `order_email_from`).
- Courier functions read `admin_settings` **first** and fall back to the environment, so Steadfast
  and Carrybee work with no env vars at all. The exception is
  [`courier-history`](supabase/functions/courier-history/index.ts), which reads
  `BDCOURIER_API_KEY` from the environment **only** and returns 400 without it — so that one
  variable must be set on the `supabase-edge-functions` container. Env changes need the container
  *recreated* (Coolify -> Actions -> Restart), not `docker restart`, since environment is fixed at
  creation.

`place-order` is the checkout path: it uses the service-role key so guests can order, responds
immediately, and defers SMS / email work to `EdgeRuntime.waitUntil` — which is why the router allows
a 150s worker timeout. It also deducts stock through the `apply_order_stock` RPC, but only *refuses*
an order when `admin_settings.stock_enforcement_enabled` is `'true'` (off by default). Courier
integrations (`steadfast-*`, `carrybee-courier`, `bdcourier` via `courier-history` /
`combined-courier-history`) are strictly rate-limited upstream, so they cache into
`courier_lookup_cache` and refuse to re-dispatch an order that already has a `tracking_number`.

### Deployment

The front end is a Docker build deployed by **Coolify**, which watches this repo's `main` and
builds [Dockerfile](Dockerfile): `npm install` then `npm run build` in a `node:22-alpine` stage,
with the result served by `nginx:1.27-alpine` using [nginx.conf](nginx.conf) (listening on **80** —
Coolify's "Ports Exposes" must say 80, not its 3000 default, or Traefik returns 502). `try_files
$uri /index.html` is what makes React Router deep links work.

`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are declared as `ARG`s in the Dockerfile
because Vite substitutes them at build time — including the `%VITE_SUPABASE_URL%` placeholders in
[index.html](index.html) for the favicon and `og:image`. In Coolify they must be marked as **build**
variables, not runtime-only, and changing either needs a redeploy rather than a restart. Editing
`.env` only affects local dev.

There is no GitHub Actions workflow and no `deploy` branch any more; the previous Hostinger
static-bundle pipeline was removed once Coolify took over. `dist/` is a local build artifact only.
Hostinger still serves DNS and email for `modessi.shop` (MX, SPF, DKIM, DMARC — untouched by the
migration); the `ftp` and `sales` records are dead leftovers.

The header, footer and home page logo is a **bundled import** (`@/assets/shop-logo.png`), not an
`admin_settings` value, so the admin Site Settings logo upload no longer affects them — only
`index.html`'s favicon and `og:image`, which come from storage. Because Coolify builds from git, a
new asset under `src/assets/` must be **committed**, or the build fails on the missing module while
Coolify keeps serving the last good image.

## Conventions

- TypeScript is deliberately loose (`strictNullChecks: false`, `noImplicitAny: false`) and
  `@typescript-eslint/no-unused-vars` is off. Don't tighten these globally as a side effect of
  another change. `npm run lint` still reports ~64 `no-explicit-any` errors in app code; that is the
  known baseline, not a regression you introduced.
- [eslint.config.js](eslint.config.js) has per-area blocks: `supabase/functions/**` lints as Deno
  (browser globals and `no-explicit-any` do not apply there) and `src/components/ui/**` is exempt
  from the empty-interface rule because those files are shadcn-generated.
- UI is shadcn/ui in [src/components/ui/](src/components/ui/) (generated — edit only when
  intentionally customizing) plus feature folders under `src/components/`. Toasts are `sonner`
  only — `<Sonner />` is the single mount in `App.tsx`. `src/hooks/use-toast.ts` and
  `src/components/ui/toaster.tsx` are the shadcn variant, left in place but unreferenced, so they
  no longer reach the bundle; don't reintroduce them.
- Admin pages are large single files (e.g. `AdminOrders.tsx` ~1900 lines) that hold their queries,
  dialogs, and mutations inline. Follow the local pattern rather than refactoring opportunistically.
- Phone numbers are Bangladeshi and normalized to local `01XXXXXXXXX` form (see `place-order`);
  currency is BDT and shipping is zoned `inside_dhaka` / `outside_dhaka`.
- Animations use framer-motion's `m` component, never `motion` — `App.tsx` wraps the tree in
  `<LazyMotion features={...domMax}>` so the feature bundle loads off the critical path. Importing
  `motion` anywhere pulls the whole library back into the entry chunk.
- Admin lists paginate through `usePagination` + `<DataPagination>`
  ([src/hooks/usePagination.ts](src/hooks/usePagination.ts),
  [src/components/admin/DataPagination.tsx](src/components/admin/DataPagination.tsx)) rather than
  per-page implementations.

## Known gaps and deliberate non-fixes

- **No database backups are configured.** Every order lives solely on the Coolify host, which is
  shared with ~16 other applications. Coolify's Backups + S3 Storage panels are the place to fix
  this; the database is ~25 MB. This is the largest outstanding risk in the setup.
- **39 product image URLs point at `https://modessi.shop/wp-content/...` and are already broken**,
  affecting 35 of 62 products. They predate the Supabase migration: Hostinger's SPA rewrite answers
  those paths with `index.html` (HTTP **200**, `Content-Type: text/html`), so a status check alone
  looks healthy — check `Content-Type` when validating images. Fixing this means re-uploading
  replacements into `shop-assets` and rewriting the rows; nothing in the migration caused it.
- **`npm run lint` reports 64 `no-explicit-any` errors.** Known baseline, not a regression.
- **`NotFound.tsx` is unrouted** — `*` deliberately falls through to the home page so stale ad links
  land on the storefront rather than a dead end.
- **`ProductLandingPage` injects raw HTML** for its video embed, bypassing the `parseIframeHtml`
  allowlist. That content is admin-only (`admin_settings`) and pasting an Elementor embed is the
  point of the field.
- **Stock enforcement is off** (`admin_settings.stock_enforcement_enabled = 'false'`). Stock is
  deducted but an order is never refused; oversells surface as negative stock in Inventory.
- `AUDIT.md` records a closed 34-finding security audit. Its line numbers have shifted, but each
  finding's `> **Fixed**` note still describes what the code does now.
