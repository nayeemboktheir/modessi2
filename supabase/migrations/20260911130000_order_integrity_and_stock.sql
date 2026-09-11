-- Order-number uniqueness, payment CHECK constraints that match the UI, an atomic
-- order-edit path, and real stock accounting.

-- ---------------------------------------------------------------------------
-- 1. Collision-free order numbers
-- ---------------------------------------------------------------------------
-- The old generator used LPAD(FLOOR(RANDOM() * 10000)) against a UNIQUE constraint
-- on order_number: only 10,000 values per day, so by the birthday bound a shop doing
-- ~100 orders/day had a ~40% chance of a collision every day. A collision made the
-- INSERT fail and the customer saw "Failed to place order".

CREATE SEQUENCE IF NOT EXISTS public.order_number_seq;

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only assign when the caller left it blank, so an explicitly supplied number
  -- (imports, backfills) is preserved.
  IF NEW.order_number IS NULL OR btrim(NEW.order_number) = '' THEN
    NEW.order_number := 'ORD-'
      || TO_CHAR(NOW(), 'YYYYMMDD')
      || '-'
      || LPAD(nextval('public.order_number_seq')::text, 5, '0');
  END IF;

  RETURN NEW;
END;
$$;

-- Two identical BEFORE INSERT triggers were attached, so the function ran twice per
-- insert. Keep one.
DROP TRIGGER IF EXISTS generate_order_number_trigger ON public.orders;

-- Start the sequence past any number already in use so existing rows can't clash.
SELECT setval(
  'public.order_number_seq',
  GREATEST(
    (
      SELECT COALESCE(MAX(NULLIF(regexp_replace(order_number, '^.*-', ''), '')::bigint), 0)
      FROM public.orders
      WHERE order_number ~ '^ORD-[0-9]{8}-[0-9]+$'
    ),
    1
  )
);

-- ---------------------------------------------------------------------------
-- 2. Payment CHECK constraints that match what the admin UI offers
-- ---------------------------------------------------------------------------
-- place-order writes 'partial' for advance payments and OrderEditDialog offers
-- bKash / Nagad / bank transfer, none of which the original constraints allowed —
-- every such write failed.

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status = ANY (ARRAY['pending', 'partial', 'paid', 'failed', 'refunded']));

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method = ANY (ARRAY['cod', 'bkash', 'nagad', 'bank', 'stripe']));

-- ---------------------------------------------------------------------------
-- 3. Atomic order edit
-- ---------------------------------------------------------------------------
-- OrderEditDialog updated the order, deleted its items and re-inserted them as three
-- separate requests. A failure between them left an order whose total described items
-- that no longer existed. A function body is a single transaction, so this cannot
-- half-apply.

CREATE OR REPLACE FUNCTION public.admin_update_order_with_items(
  p_order_id uuid,
  p_order jsonb,
  p_items jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.orders SET
    shipping_name        = COALESCE(p_order->>'shipping_name', shipping_name),
    shipping_phone       = COALESCE(p_order->>'shipping_phone', shipping_phone),
    shipping_street      = COALESCE(p_order->>'shipping_street', shipping_street),
    shipping_city        = COALESCE(p_order->>'shipping_city', shipping_city),
    shipping_district    = COALESCE(p_order->>'shipping_district', shipping_district),
    shipping_postal_code = p_order->>'shipping_postal_code',
    payment_method       = COALESCE(p_order->>'payment_method', payment_method),
    payment_status       = COALESCE(p_order->>'payment_status', payment_status),
    shipping_cost        = COALESCE((p_order->>'shipping_cost')::numeric, shipping_cost),
    discount             = COALESCE((p_order->>'discount')::numeric, discount),
    subtotal             = COALESCE((p_order->>'subtotal')::numeric, subtotal),
    total                = COALESCE((p_order->>'total')::numeric, total),
    notes                = p_order->>'notes'
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_order_id USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM public.order_items WHERE order_id = p_order_id;

  INSERT INTO public.order_items (
    order_id, product_id, variation_id, product_name, variation_name,
    product_image, price, quantity
  )
  SELECT
    p_order_id,
    NULLIF(item->>'product_id', '')::uuid,
    NULLIF(item->>'variation_id', '')::uuid,
    item->>'product_name',
    item->>'variation_name',
    item->>'product_image',
    (item->>'price')::numeric,
    (item->>'quantity')::integer
  FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) AS item;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_order_with_items(uuid, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_order_with_items(uuid, jsonb, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Stock accounting
-- ---------------------------------------------------------------------------
-- Nothing ever decremented stock: it was a display-only number typed in by hand, so
-- overselling was unbounded. This deducts sold quantities under a row lock, which
-- makes concurrent checkouts safe.
--
-- Enforcement is deliberately opt-in. Existing stock figures were never maintained
-- against real sales, so refusing orders on them today would reject good business.
-- Set admin_settings.stock_enforcement_enabled = 'true' once the numbers are trusted;
-- until then stock simply goes negative, which surfaces the oversell in Inventory.

CREATE OR REPLACE FUNCTION public.apply_order_stock(
  p_items jsonb,
  p_enforce boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  item        jsonb;
  v_product   uuid;
  v_variation uuid;
  v_qty       integer;
  v_available integer;
  shortfalls  jsonb := '[]'::jsonb;
  v_name      text;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    v_product   := NULLIF(item->>'productId', '')::uuid;
    v_variation := NULLIF(item->>'variationId', '')::uuid;
    v_qty       := COALESCE((item->>'quantity')::integer, 0);

    -- Custom/non-catalogue line items carry no product id and hold no stock.
    CONTINUE WHEN v_product IS NULL OR v_qty <= 0;

    IF v_variation IS NOT NULL THEN
      SELECT stock, name INTO v_available, v_name
      FROM public.product_variations
      WHERE id = v_variation
      FOR UPDATE;
    ELSE
      SELECT stock, name INTO v_available, v_name
      FROM public.products
      WHERE id = v_product
      FOR UPDATE;
    END IF;

    CONTINUE WHEN v_available IS NULL;

    IF v_available < v_qty THEN
      shortfalls := shortfalls || jsonb_build_object(
        'name', v_name,
        'requested', v_qty,
        'available', v_available
      );
    END IF;

    IF v_variation IS NOT NULL THEN
      UPDATE public.product_variations SET stock = stock - v_qty WHERE id = v_variation;
    ELSE
      UPDATE public.products SET stock = stock - v_qty WHERE id = v_product;
    END IF;
  END LOOP;

  -- Raising here rolls back every decrement made above, so a rejected order leaves
  -- stock untouched.
  IF p_enforce AND jsonb_array_length(shortfalls) > 0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK:%', shortfalls::text USING ERRCODE = '23514';
  END IF;

  RETURN shortfalls;
END;
$$;

-- Called only by place-order with the service-role key; granted explicitly rather
-- than relying on whatever default privileges this stack happens to have.
REVOKE ALL ON FUNCTION public.apply_order_stock(jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_order_stock(jsonb, boolean) TO service_role;
