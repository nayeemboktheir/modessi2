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

- **Routing** — every route is declared eagerly in [src/App.tsx](src/App.tsx) (no lazy loading, no
  nested route configs). Admin pages are wrapped inline as `<AdminLayout><AdminX /></AdminLayout>`;
  a couple of routes (`/admin/order-protection`, `/admin/landing-video-settings`) deliberately skip
  the layout. `*` falls through to the home page, so `NotFound.tsx` is unused.
- **Two state systems coexist.** Redux Toolkit ([src/store/](src/store/)) holds cart and wishlist,
  which persist to `localStorage` inside the slices themselves; TanStack Query holds all
  server-derived data. Most pages call Supabase directly through `useQuery` rather than going
  through [src/services/](src/services/) — the service layer (`productService`, `orderService`,
  `adminService`) is partial, so check whether a helper exists before adding a duplicate query.
- **Auth** — [src/hooks/useAuth.tsx](src/hooks/useAuth.tsx) is a context provider over Supabase
  GoTrue that also resolves `isAdmin` by querying `user_roles`, with a 5-minute module-level cache.
  `AdminLayout` gates admin routes on it, but that is convenience only: real authorization is RLS.
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
- **JWT verification is the router's job**, driven by the `FUNCTIONS_VERIFY_JWT` and
  `FUNCTIONS_NO_VERIFY_JWT` env vars on the `supabase-edge-functions` container.
  `verify_jwt` in `supabase/config.toml` is documentation only — nothing reads it.
- Secrets (courier keys, SMS credentials, Resend key) are container env vars in Coolify, not in
  this repo.

`place-order` is the checkout path: it uses the service-role key so guests can order, responds
immediately, and defers SMS / courier / pixel work to `EdgeRuntime.waitUntil` — which is why the
router allows a 150s worker timeout. Courier integrations (`steadfast-*`, `carrybee-courier`,
`bdcourier` via `courier-history` / `combined-courier-history`) cache aggressively and self-rate-limit
because the upstream APIs are strict.

### Deployment

The front end is a static bundle on Hostinger. `.github/workflows/deploy.yml` is manual
(`workflow_dispatch`): it builds with the `VITE_SUPABASE_*` GitHub Actions secrets and force-pushes
`dist/` to the `deploy` branch. Because the Supabase URL and key are baked in at build time,
pointing at a different backend means updating those secrets and re-running the workflow — editing
`.env` only affects local dev.

## Conventions

- TypeScript is deliberately loose (`strictNullChecks: false`, `noImplicitAny: false`) and
  `@typescript-eslint/no-unused-vars` is off. Don't tighten these globally as a side effect of
  another change.
- UI is shadcn/ui in [src/components/ui/](src/components/ui/) (generated — edit only when
  intentionally customizing) plus feature folders under `src/components/`. Toasts come in two
  flavors: the shadcn `useToast` and `sonner`; both are mounted.
- Admin pages are large single files (e.g. `AdminOrders.tsx` ~1900 lines) that hold their queries,
  dialogs, and mutations inline. Follow the local pattern rather than refactoring opportunistically.
- Phone numbers are Bangladeshi and normalized to local `01XXXXXXXXX` form (see `place-order`);
  currency is BDT and shipping is zoned `inside_dhaka` / `outside_dhaka`.
