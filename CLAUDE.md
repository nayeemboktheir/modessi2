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
SSH_HOST=root@server FUNCTIONS_DIR=/data/coolify/.../volumes/functions ./scripts/deploy-functions.sh
```

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

- **Deploying is an rsync**, not `supabase functions deploy`. Individual functions reload per
  request; changes to `main/index.ts` need a container restart.
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
