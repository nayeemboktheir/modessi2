-- The courier's own tracking page for a parcel.
--
-- Steadfast's create_order returns `consignment.tracking_link` (https://steadfast.com.bd/tl/<hash>),
-- which cannot be rebuilt from the tracking code, so steadfast-courier stores it here when it books
-- the parcel. carrybee-courier stores its order-track URL in the same column, so the admin and the
-- customer's My Account page link to the right courier without guessing from the code's shape.
-- Rows booked before this migration stay NULL and fall back to src/lib/trackingUrl.ts.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tracking_link text;

ALTER TABLE public.wholesale_orders
  ADD COLUMN IF NOT EXISTS tracking_link text;
