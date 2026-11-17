-- Steadfast dispatch for wholesale orders.
--
-- Admins can now send a wholesale order to Steadfast from /admin/wholesale-prices?tab=orders.
-- The steadfast-courier function records the consignment here (keyed on `wholesaleOrderId`)
-- and refuses to dispatch an order that already has a tracking_number, as it does for `orders`.

ALTER TABLE public.wholesale_orders
  ADD COLUMN IF NOT EXISTS tracking_number          text,
  ADD COLUMN IF NOT EXISTS steadfast_consignment_id text,
  ADD COLUMN IF NOT EXISTS courier_sent_at          timestamptz;

CREATE INDEX IF NOT EXISTS wholesale_orders_tracking_number_idx
  ON public.wholesale_orders (tracking_number)
  WHERE tracking_number IS NOT NULL;
