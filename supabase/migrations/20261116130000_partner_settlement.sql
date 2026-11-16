-- Partner (reseller) settlement: courier money per parcel, stock restore, and payments.
--
-- 1. orders.courier_*  Steadfast's delivery outcome per parcel, written by the new
--    steadfast-webhook function: status, cash collected, and Steadfast's delivery charge.
--    Needed to work out what Modessi owes a reseller for each delivered parcel.
-- 2. restore_order_stock  puts stock back for order lines (the reverse of apply_order_stock).
--    partner-api uses it when a reseller cancels or changes an order before it ships.
-- 3. partner_payments  money Modessi has paid a reseller. Either side records it (Modessi admin
--    page, or the reseller through partner-api); the reseller keeps a copy.
--
-- Owed to a partner per parcel (see src/lib/partnerSettlement.ts):
--   delivered   collected − wholesale_total − delivery charge
--   returned    − delivery charge (goods come back to Modessi, so no wholesale)
-- Balance = Σ owed − Σ partner_payments.

-- 1. Courier outcome on orders --------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS courier_status text,
  ADD COLUMN IF NOT EXISTS courier_cod_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS courier_delivery_charge numeric(10,2),
  ADD COLUMN IF NOT EXISTS courier_status_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS steadfast_sent_at timestamptz;

-- A new consignment means a new parcel: stamp when it was sent and clear the old courier state.
-- Done here rather than in steadfast-courier so that function keeps working with or without
-- this migration.
CREATE OR REPLACE FUNCTION public.stamp_steadfast_sent()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.steadfast_consignment_id IS NOT NULL
     AND NEW.steadfast_consignment_id IS DISTINCT FROM OLD.steadfast_consignment_id THEN
    NEW.steadfast_sent_at := now();
    NEW.courier_status := NULL;
    NEW.courier_cod_amount := NULL;
    NEW.courier_delivery_charge := NULL;
    NEW.courier_status_updated_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_stamp_steadfast_sent ON public.orders;
CREATE TRIGGER orders_stamp_steadfast_sent
  BEFORE UPDATE OF steadfast_consignment_id ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.stamp_steadfast_sent();

CREATE INDEX IF NOT EXISTS idx_orders_steadfast_consignment_id
  ON public.orders (steadfast_consignment_id)
  WHERE steadfast_consignment_id IS NOT NULL;

-- 2. Stock restore --------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restore_order_stock(p_items jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  item        jsonb;
  v_product   uuid;
  v_variation uuid;
  v_qty       integer;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    v_product   := NULLIF(item->>'productId', '')::uuid;
    v_variation := NULLIF(item->>'variationId', '')::uuid;
    v_qty       := COALESCE((item->>'quantity')::integer, 0);
    CONTINUE WHEN v_product IS NULL OR v_qty <= 0;

    IF v_variation IS NOT NULL THEN
      UPDATE public.product_variations SET stock = stock + v_qty WHERE id = v_variation;
    ELSE
      UPDATE public.products SET stock = stock + v_qty WHERE id = v_product;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.restore_order_stock(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_order_stock(jsonb) TO service_role;

-- 3. Payments to partners -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partner_payments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner    text NOT NULL,
  amount     numeric(10,2) NOT NULL CHECK (amount <> 0),
  paid_at    date NOT NULL DEFAULT CURRENT_DATE,
  note       text,
  recorded_by text NOT NULL DEFAULT 'modessi' CHECK (recorded_by IN ('modessi', 'partner')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partner_payments_partner_idx ON public.partner_payments (partner, paid_at);

ALTER TABLE public.partner_payments ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_payments TO service_role;
GRANT SELECT, INSERT, DELETE ON public.partner_payments TO authenticated;

DROP POLICY IF EXISTS "Admins can view partner payments" ON public.partner_payments;
CREATE POLICY "Admins can view partner payments"
  ON public.partner_payments FOR SELECT TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'));

DROP POLICY IF EXISTS "Admins can record partner payments" ON public.partner_payments;
CREATE POLICY "Admins can record partner payments"
  ON public.partner_payments FOR INSERT TO authenticated
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin') AND recorded_by = 'modessi');

DROP POLICY IF EXISTS "Admins can delete partner payments" ON public.partner_payments;
CREATE POLICY "Admins can delete partner payments"
  ON public.partner_payments FOR DELETE TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'));

-- partner_order_links: when the partner last changed the order (for the admin page).
ALTER TABLE public.partner_order_links
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;
