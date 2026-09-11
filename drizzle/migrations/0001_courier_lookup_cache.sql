-- Shared cache for paid courier lookups.
--
-- combined-courier-history and courier-history each kept their cache in a module-level
-- Map. Under the self-hosted router every request runs in a freshly spawned worker, so
-- that Map was always empty: the "24 hour cache" and the 2s rate limiter never applied
-- and every admin page load re-billed the BDCourier API once per visible order.
--
-- A table survives the worker, so the cache actually caches.

CREATE TABLE IF NOT EXISTS public.courier_lookup_cache (
  cache_key  text PRIMARY KEY,
  payload    jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_courier_lookup_cache_fetched_at
  ON public.courier_lookup_cache (fetched_at);

-- Contains third-party data about customers, so it is service-role only: RLS on with
-- no policies means anon and authenticated can read nothing, while the service-role
-- key used by the edge functions bypasses RLS as usual.
ALTER TABLE public.courier_lookup_cache ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.courier_lookup_cache TO service_role;

COMMENT ON TABLE public.courier_lookup_cache IS
  'Cross-worker cache for BDCourier lookups. Keyed by <source>_<normalised phone>; entries are refreshed by the edge functions once older than their TTL.';