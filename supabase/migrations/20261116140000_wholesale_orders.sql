-- Wholesale orders, placed from wholesale.modessi.shop.
--
-- The wholesale site holds only the anon key, so it cannot write these tables. It places an
-- order through place_wholesale_order(), a SECURITY DEFINER function that prices every line
-- from wholesale_prices itself: the browser sends product, size and quantity only, never a
-- price. Admins read and work the orders from /admin/wholesale-prices -> Orders.
--
-- These are kept apart from `orders` on purpose: they are bulk B2B orders confirmed by phone,
-- with no delivery zone, courier dispatch, SMS, pixels or stock deduction, and mixing them into
-- `orders` would put them through all of that.

CREATE SEQUENCE IF NOT EXISTS public.wholesale_order_seq START 1001;

CREATE TABLE IF NOT EXISTS public.wholesale_orders (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number   text NOT NULL UNIQUE
                 DEFAULT ('WS-' || nextval('public.wholesale_order_seq')::text),
  buyer_name     text NOT NULL,
  shop_name      text,
  phone          text NOT NULL,
  address        text NOT NULL,
  notes          text,
  subtotal       numeric(12,2) NOT NULL DEFAULT 0,
  total_quantity integer NOT NULL DEFAULT 0,
  status         text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  admin_note     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wholesale_orders_created_at_idx ON public.wholesale_orders (created_at DESC);
CREATE INDEX IF NOT EXISTS wholesale_orders_status_idx ON public.wholesale_orders (status);
CREATE INDEX IF NOT EXISTS wholesale_orders_phone_idx ON public.wholesale_orders (phone);

-- Names, sizes and image are copied at order time so an order still reads correctly after a
-- product is renamed or deleted.
CREATE TABLE IF NOT EXISTS public.wholesale_order_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       uuid NOT NULL REFERENCES public.wholesale_orders(id) ON DELETE CASCADE,
  product_id     uuid REFERENCES public.products(id) ON DELETE SET NULL,
  variation_id   uuid REFERENCES public.product_variations(id) ON DELETE SET NULL,
  product_name   text NOT NULL,
  variation_name text,
  product_image  text,
  unit_price     numeric(12,2) NOT NULL,
  quantity       integer NOT NULL CHECK (quantity > 0),
  line_total     numeric(12,2) NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wholesale_order_items_order_id_idx ON public.wholesale_order_items (order_id);

DROP TRIGGER IF EXISTS wholesale_orders_set_updated_at ON public.wholesale_orders;
CREATE TRIGGER wholesale_orders_set_updated_at
  BEFORE UPDATE ON public.wholesale_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Admin-only. Granted explicitly: tables created on this stack get no default privileges.
-- anon gets nothing on the tables; it goes through place_wholesale_order() below.
ALTER TABLE public.wholesale_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wholesale_order_items ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wholesale_orders TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wholesale_order_items TO service_role;
GRANT SELECT, UPDATE, DELETE ON public.wholesale_orders TO authenticated;
GRANT SELECT, UPDATE, DELETE ON public.wholesale_order_items TO authenticated;

DROP POLICY IF EXISTS "Admins can manage wholesale orders" ON public.wholesale_orders;
CREATE POLICY "Admins can manage wholesale orders"
  ON public.wholesale_orders
  FOR ALL
  TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));

DROP POLICY IF EXISTS "Admins can manage wholesale order items" ON public.wholesale_order_items;
CREATE POLICY "Admins can manage wholesale order items"
  ON public.wholesale_order_items
  FOR ALL
  TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));

-- place_wholesale_order(p_buyer, p_items)
--
--   p_buyer  {"name", "shop_name"?, "phone", "address", "notes"?}
--   p_items  [{"product_id", "variation_id"?, "quantity"}, ...]
--
-- Unit price = the variation's own active wholesale price, else the product's. A line with no
-- wholesale price is refused, as is an inactive product or size. Each product's total quantity
-- must reach the highest min_quantity among its lines. Error messages are Bangla because the
-- wholesale site shows them to the buyer as-is.
CREATE OR REPLACE FUNCTION public.place_wholesale_order(p_buyer jsonb, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name     text := btrim(coalesce(p_buyer->>'name', ''));
  v_shop     text := nullif(btrim(coalesce(p_buyer->>'shop_name', '')), '');
  v_phone    text := regexp_replace(coalesce(p_buyer->>'phone', ''), '\D', '', 'g');
  v_address  text := btrim(coalesce(p_buyer->>'address', ''));
  v_notes    text := nullif(btrim(coalesce(p_buyer->>'notes', '')), '');
  v_order    public.wholesale_orders;
  v_short    record;
  v_line     record;
  v_subtotal numeric(12,2) := 0;
  v_qty      integer := 0;
BEGIN
  -- Phone to local 01XXXXXXXXX, as place-order does.
  IF v_phone LIKE '880%' THEN v_phone := substr(v_phone, 4); END IF;
  IF length(v_phone) = 10 AND v_phone LIKE '1%' THEN v_phone := '0' || v_phone; END IF;

  IF length(v_name) < 2 OR length(v_name) > 100 THEN
    RAISE EXCEPTION 'আপনার নাম লিখুন';
  END IF;
  IF v_phone !~ '^01[3-9][0-9]{8}$' THEN
    RAISE EXCEPTION 'সঠিক মোবাইল নম্বর দিন (01XXXXXXXXX)';
  END IF;
  IF length(v_address) < 5 OR length(v_address) > 500 THEN
    RAISE EXCEPTION 'পূর্ণ ঠিকানা লিখুন';
  END IF;
  IF length(coalesce(v_shop, '')) > 120 OR length(coalesce(v_notes, '')) > 1000 THEN
    RAISE EXCEPTION 'দোকানের নাম বা নোট অনেক বড়';
  END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_items) = 0
     OR jsonb_array_length(p_items) > 100 THEN
    RAISE EXCEPTION 'কার্টে কোনো প্রোডাক্ট নেই';
  END IF;

  -- The function is callable anonymously; this caps how fast one number can fill the queue.
  IF (SELECT count(*) FROM public.wholesale_orders
      WHERE phone = v_phone AND created_at > now() - interval '1 hour') >= 5 THEN
    RAISE EXCEPTION 'এই নম্বর থেকে অনেকগুলো অর্ডার হয়েছে। কিছুক্ষণ পর চেষ্টা করুন বা আমাদের কল করুন।';
  END IF;

  DROP TABLE IF EXISTS _ws_lines;
  CREATE TEMP TABLE _ws_lines ON COMMIT DROP AS
  WITH raw AS (
    SELECT
      (e->>'product_id')::uuid                         AS product_id,
      nullif(e->>'variation_id', '')::uuid              AS variation_id,
      (e->>'quantity')::integer                         AS quantity
    FROM jsonb_array_elements(p_items) AS e
  ),
  merged AS (
    SELECT product_id, variation_id, sum(quantity)::integer AS quantity
    FROM raw
    GROUP BY product_id, variation_id
  )
  SELECT
    m.product_id,
    m.variation_id,
    m.quantity,
    p.name                                              AS product_name,
    p.is_active                                         AS product_active,
    p.images[1]                                         AS product_image,
    v.name                                              AS variation_name,
    v.product_id                                        AS variation_product_id,
    v.is_active                                         AS variation_active,
    coalesce(wv.wholesale_price, wb.wholesale_price)    AS unit_price,
    coalesce(wv.min_quantity, wb.min_quantity, 1)       AS min_quantity
  FROM merged m
  LEFT JOIN public.products p            ON p.id = m.product_id
  LEFT JOIN public.product_variations v  ON v.id = m.variation_id
  LEFT JOIN public.wholesale_prices wv   ON wv.product_id = m.product_id
                                        AND wv.variation_id = m.variation_id
                                        AND m.variation_id IS NOT NULL
                                        AND wv.is_active
  LEFT JOIN public.wholesale_prices wb   ON wb.product_id = m.product_id
                                        AND wb.variation_id IS NULL
                                        AND wb.is_active;

  FOR v_line IN SELECT * FROM _ws_lines LOOP
    IF v_line.product_id IS NULL OR v_line.product_name IS NULL OR NOT coalesce(v_line.product_active, false) THEN
      RAISE EXCEPTION 'একটি প্রোডাক্ট আর পাওয়া যাচ্ছে না। কার্ট থেকে সরিয়ে আবার চেষ্টা করুন।';
    END IF;
    IF v_line.variation_id IS NOT NULL AND (
         v_line.variation_product_id IS DISTINCT FROM v_line.product_id
         OR NOT coalesce(v_line.variation_active, false)) THEN
      RAISE EXCEPTION '"%" এর একটি সাইজ আর পাওয়া যাচ্ছে না', v_line.product_name;
    END IF;
    IF v_line.quantity IS NULL OR v_line.quantity < 1 OR v_line.quantity > 10000 THEN
      RAISE EXCEPTION '"%" এর পরিমাণ সঠিক নয়', v_line.product_name;
    END IF;
    IF v_line.unit_price IS NULL THEN
      RAISE EXCEPTION '"%" এর পাইকারি মূল্য এখনো যোগ করা হয়নি', v_line.product_name;
    END IF;
  END LOOP;

  SELECT product_name, sum(quantity) AS qty, max(min_quantity) AS need
  INTO v_short
  FROM _ws_lines
  GROUP BY product_id, product_name
  HAVING sum(quantity) < max(min_quantity)
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION '"%" সর্বনিম্ন % পিস অর্ডার করতে হবে', v_short.product_name, v_short.need;
  END IF;

  SELECT coalesce(sum(unit_price * quantity), 0), coalesce(sum(quantity), 0)
  INTO v_subtotal, v_qty
  FROM _ws_lines;

  INSERT INTO public.wholesale_orders
    (buyer_name, shop_name, phone, address, notes, subtotal, total_quantity)
  VALUES
    (v_name, v_shop, v_phone, v_address, v_notes, v_subtotal, v_qty)
  RETURNING * INTO v_order;

  INSERT INTO public.wholesale_order_items
    (order_id, product_id, variation_id, product_name, variation_name, product_image,
     unit_price, quantity, line_total)
  SELECT
    v_order.id, product_id, variation_id, product_name, variation_name, product_image,
    unit_price, quantity, unit_price * quantity
  FROM _ws_lines
  ORDER BY product_name, variation_name;

  RETURN jsonb_build_object(
    'id',             v_order.id,
    'order_number',   v_order.order_number,
    'subtotal',       v_order.subtotal,
    'total_quantity', v_order.total_quantity
  );
END;
$$;

REVOKE ALL ON FUNCTION public.place_wholesale_order(jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_wholesale_order(jsonb, jsonb) TO anon, authenticated, service_role;

COMMENT ON TABLE public.wholesale_orders IS
  'Orders placed on wholesale.modessi.shop through place_wholesale_order(). Admin-only; anon has no table access.';
