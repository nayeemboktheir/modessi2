-- Wholesale orders can be 'returned', like `orders`: steadfast-webhook marks a wholesale parcel
-- Steadfast cancelled (it comes back to Modessi) as returned rather than leaving it 'shipped'.

ALTER TABLE public.wholesale_orders DROP CONSTRAINT IF EXISTS wholesale_orders_status_check;
ALTER TABLE public.wholesale_orders
  ADD CONSTRAINT wholesale_orders_status_check
  CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'returned', 'cancelled'));
