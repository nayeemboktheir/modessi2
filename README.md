# Modessi

E-commerce storefront and admin panel. Vite + React + TypeScript, Tailwind and shadcn/ui on the
front end, self-hosted Supabase (Postgres, GoTrue auth, Storage, Edge Functions) on the back end.

## Local development

Requires Node.js 20+.

```sh
npm ci
cp .env.example .env    # then fill in the values
npm run dev             # http://localhost:8080
```

`.env` is gitignored and holds the Supabase gateway URL and anon key. The anon key is safe to ship
to the browser — row-level security is what actually guards the data.

```sh
npm run build    # production bundle into dist/
npm run lint
```

## Backend

The backend is a self-hosted Supabase stack running as a Coolify service, not a managed cloud
project. `VITE_SUPABASE_URL` points at that stack's Kong gateway, which fronts every sub-service:

| Path | Service |
|---|---|
| `/auth/v1` | GoTrue — email/password auth |
| `/rest/v1` | PostgREST — the tables in `supabase/migrations` |
| `/storage/v1` | Storage API, backed by MinIO (bucket: `shop-assets`) |
| `/functions/v1` | Edge Runtime — the functions in `supabase/functions` |

Studio (schema browser, SQL editor, log viewer) is exposed on its own subdomain by the same stack.

### Database

`supabase/migrations` holds the schema history. Regenerate the TypeScript types after any schema
change so `src/integrations/supabase/types.ts` stays in sync:

```sh
supabase gen types typescript --db-url "$SUPABASE_DB_URL" > src/integrations/supabase/types.ts
```

Authorization lives almost entirely in Postgres: every table has RLS enabled, and admin access is
gated by the `public.has_role(auth.uid(), 'admin')` helper against the `user_roles` table. There is
no application-layer authorization to fall back on, so treat policy changes with care.

### Edge functions

14 Deno functions in `supabase/functions` handle checkout (`place-order`), courier integrations
(Steadfast, CarryBee, BDCourier), SMS, transactional email, and server-side ad-pixel forwarding.

`supabase functions deploy` does **not** work against self-hosted Supabase — there is no management
API. The edge-runtime container serves whatever is in its `/home/deno/functions` mount, with
`supabase/functions/main/index.ts` acting as the router that spawns a worker per request. Deploy by
syncing the directory:

```sh
SSH_HOST=root@your-server FUNCTIONS_DIR=/data/coolify/.../volumes/functions \
  ./scripts/deploy-functions.sh
```

Function secrets (courier API keys, SMS provider credentials, the Resend key) are set as environment
variables on the `supabase-edge-functions` container in Coolify, not in this repo.

JWT verification is enforced by the router, not by `supabase/config.toml`. Functions listed in the
`FUNCTIONS_NO_VERIFY_JWT` env var are reachable without a token; everything else requires one.

## Deployment

The front end is a static bundle hosted on Hostinger. `.github/workflows/deploy.yml` is a manual
(`workflow_dispatch`) job that builds with the `VITE_SUPABASE_*` GitHub Actions secrets and force-pushes
`dist/` to the `deploy` branch, which Hostinger serves.

Because the Supabase URL and key are baked in at build time, changing backends means updating the
GitHub Actions secrets and re-running the workflow — not just editing `.env`.
