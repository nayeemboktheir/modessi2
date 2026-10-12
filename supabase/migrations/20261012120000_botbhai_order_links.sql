-- BotBhai (chat.botbhai.net) order sync bookkeeping.
--
-- Orders move both ways: website orders are mirrored to BotBhai, and orders the
-- BotBhai chatbot takes are imported here. One row per order that has crossed over,
-- keyed by BotBhai's order_number, is what stops an order being imported twice and
-- stops an order we pushed from coming back to us as an "import".

CREATE TABLE IF NOT EXISTS public.botbhai_order_links (
  botbhai_order_number text PRIMARY KEY,
  order_id             uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  direction            text NOT NULL CHECK (direction IN ('pushed', 'imported')),
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- Written only by the botbhai-sync and place-order edge functions with the
-- service-role key, which bypasses RLS; admins may read it. Granted explicitly:
-- tables created from Studio on this stack get no default privileges, and
-- bypassing RLS does not bypass a missing GRANT.
ALTER TABLE public.botbhai_order_links ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.botbhai_order_links TO service_role;
GRANT SELECT ON public.botbhai_order_links TO authenticated;

DROP POLICY IF EXISTS "Admins can view botbhai order links" ON public.botbhai_order_links;
CREATE POLICY "Admins can view botbhai order links"
  ON public.botbhai_order_links
  FOR SELECT
  TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'));

COMMENT ON TABLE public.botbhai_order_links IS
  'Maps Modessi orders to BotBhai order numbers. direction = pushed (website order mirrored to BotBhai) or imported (BotBhai chatbot order created here).';

-- Automatic pushes from place-order (order mirror + stock) are opt-in.
INSERT INTO public.admin_settings (key, value)
VALUES ('botbhai_auto_sync', 'false')
ON CONFLICT (key) DO NOTHING;
