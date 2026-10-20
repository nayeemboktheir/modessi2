-- BotBhai webhook deliveries, for dedupe.
--
-- BotBhai retries a delivery (same X-BotBhai-Delivery id) until it gets a 2xx, and
-- may deliver the same event more than once. The botbhai-webhook function claims
-- each delivery id here before acting on it, and releases the claim if processing
-- fails so BotBhai's retry is processed rather than skipped.

CREATE TABLE IF NOT EXISTS public.botbhai_webhook_deliveries (
  delivery_id  text PRIMARY KEY,
  event        text NOT NULL,
  order_number text,
  received_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS botbhai_webhook_deliveries_received_at_idx
  ON public.botbhai_webhook_deliveries (received_at);

-- Written only by the botbhai-webhook edge function with the service-role key;
-- admins may read it. Granted explicitly: tables on this stack get no default
-- privileges, and bypassing RLS does not bypass a missing GRANT.
ALTER TABLE public.botbhai_webhook_deliveries ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.botbhai_webhook_deliveries TO service_role;
GRANT SELECT ON public.botbhai_webhook_deliveries TO authenticated;

DROP POLICY IF EXISTS "Admins can view botbhai webhook deliveries" ON public.botbhai_webhook_deliveries;
CREATE POLICY "Admins can view botbhai webhook deliveries"
  ON public.botbhai_webhook_deliveries
  FOR SELECT
  TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'));

COMMENT ON TABLE public.botbhai_webhook_deliveries IS
  'X-BotBhai-Delivery ids already processed by the botbhai-webhook function, so retried or repeated deliveries are ignored.';

-- Order sync runs automatically both ways: website orders are mirrored as they are
-- placed, and chatbot orders arrive through the webhook. The switch on /admin/botbhai
-- still turns it off; the manual Import / Push buttons work either way.
INSERT INTO public.admin_settings (key, value)
VALUES ('botbhai_auto_sync', 'true')
ON CONFLICT (key) DO UPDATE SET value = 'true', updated_at = now();
