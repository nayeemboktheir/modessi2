-- Reseller (partner) orders, e.g. Maxora Outlet.
--
-- A reseller sells Modessi products on its own site and sends those orders here through the
-- partner-api edge function. Modessi packs and ships them like any other order (order_source
-- = the partner's name) and collects the COD. One row per order that came from a partner:
-- it stops the same order being created twice, and keeps the money figures needed to settle
-- with the partner:
--
--   cod_amount       what the customer pays Modessi's courier for this parcel
--   wholesale_total  Modessi's wholesale price × quantity for the parcel, at the time it came in
--
-- Owed to the partner for a delivered parcel = cod_amount − wholesale_total − delivery charge.

CREATE TABLE IF NOT EXISTS public.partner_order_links (
  partner              text NOT NULL,
  partner_order_id     text NOT NULL,
  partner_order_number text,
  order_id             uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  cod_amount           numeric(10,2) NOT NULL DEFAULT 0,
  wholesale_total      numeric(10,2),
  created_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (partner, partner_order_id)
);

-- Written only by partner-api with the service-role key; admins may read it. Granted
-- explicitly: tables created on this stack get no default privileges.
ALTER TABLE public.partner_order_links ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_order_links TO service_role;
GRANT SELECT ON public.partner_order_links TO authenticated;

DROP POLICY IF EXISTS "Admins can view partner order links" ON public.partner_order_links;
CREATE POLICY "Admins can view partner order links"
  ON public.partner_order_links
  FOR SELECT
  TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'));

COMMENT ON TABLE public.partner_order_links IS
  'Orders sent in by a reseller site (partner-api). cod_amount = what Modessi collects; wholesale_total = Modessi cost of the parcel.';
