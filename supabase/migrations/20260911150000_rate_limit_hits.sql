-- Cross-worker rate limiting for the genuinely public edge functions
-- (place-order and the three ad-pixel forwarders). Each request runs in a fresh
-- worker, so counters have to live in the database to mean anything.

CREATE TABLE IF NOT EXISTS public.rate_limit_hits (
  bucket       text NOT NULL,
  identifier   text NOT NULL,
  window_start timestamptz NOT NULL,
  hits         integer NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, identifier, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_hits_window_start
  ON public.rate_limit_hits (window_start);

GRANT ALL ON public.rate_limit_hits TO service_role;

ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.rate_limit_hits IS
  'Fixed-window request counters for public edge functions. Written only by the service role via public.rate_limit_hit().';

-- Returns TRUE when the caller is within the limit for the current window.
CREATE OR REPLACE FUNCTION public.rate_limit_hit(
  p_bucket text,
  p_identifier text,
  p_window_seconds integer,
  p_limit integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_window_start timestamptz;
  v_hits integer;
BEGIN
  v_window_start := to_timestamp(
    floor(extract(epoch FROM now()) / GREATEST(p_window_seconds, 1)) * GREATEST(p_window_seconds, 1)
  );

  INSERT INTO public.rate_limit_hits (bucket, identifier, window_start, hits)
  VALUES (p_bucket, p_identifier, v_window_start, 1)
  ON CONFLICT (bucket, identifier, window_start)
  DO UPDATE SET hits = public.rate_limit_hits.hits + 1
  RETURNING hits INTO v_hits;

  -- Opportunistic cleanup; cheap because it is indexed and rarely matches.
  IF random() < 0.01 THEN
    DELETE FROM public.rate_limit_hits WHERE window_start < now() - interval '1 day';
  END IF;

  RETURN v_hits <= p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.rate_limit_hit(text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rate_limit_hit(text, text, integer, integer) TO service_role;