-- Steadfast follow-ups, from Steadfast's API guide and webhook docs (Nov 2026).
--
-- 1. Wholesale parcels get the same courier outcome fields as `orders`, so steadfast-webhook can
--    record a delivered / cancelled wholesale parcel instead of ignoring it.
-- 2. Returned parcels: Steadfast's status_with_return_status_by_cid is the only call that says a
--    returned parcel is physically back (`cancelled_return_received`). steadfast-management's
--    `sync_returns` action stores that here and puts the stock back once, through
--    restock_returned_order() — `stock_restored_at` is the guard against doing it twice.
--    Only parcels whose cancellation lands after this migration are restocked automatically
--    (admin_settings.steadfast_restock_returns_since): older returns may already have been
--    restocked by hand. Set steadfast_restock_returns to 'false' to stop it entirely.
--    Partly delivered parcels are never restocked automatically: nothing says which items
--    came back.

-- 1. Wholesale courier outcome --------------------------------------------------------------------
ALTER TABLE public.wholesale_orders
  ADD COLUMN IF NOT EXISTS courier_status            text,
  ADD COLUMN IF NOT EXISTS courier_status_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS courier_cod_amount        numeric(10,2),
  ADD COLUMN IF NOT EXISTS courier_delivery_charge   numeric(10,2);

CREATE INDEX IF NOT EXISTS wholesale_orders_steadfast_consignment_id_idx
  ON public.wholesale_orders (steadfast_consignment_id)
  WHERE steadfast_consignment_id IS NOT NULL;

-- 2. Returns ---------------------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS courier_return_status text,
  ADD COLUMN IF NOT EXISTS stock_restored_at     timestamptz;

CREATE OR REPLACE FUNCTION public.restock_returned_order(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_items jsonb;
BEGIN
  -- Claim the order first; a second call (or a concurrent one) finds it already claimed.
  UPDATE public.orders SET stock_restored_at = now()
   WHERE id = p_order_id AND stock_restored_at IS NULL;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'productId', product_id, 'variationId', variation_id, 'quantity', quantity)), '[]'::jsonb)
    INTO v_items
    FROM public.order_items
   WHERE order_id = p_order_id;

  PERFORM public.restore_order_stock(v_items);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.restock_returned_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restock_returned_order(uuid) TO service_role;

INSERT INTO public.admin_settings (key, value)
VALUES
  ('steadfast_restock_returns', 'true'),
  ('steadfast_restock_returns_since', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
ON CONFLICT (key) DO NOTHING;
