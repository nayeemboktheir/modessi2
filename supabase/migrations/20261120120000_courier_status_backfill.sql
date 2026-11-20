-- One-off: move orders whose Steadfast outcome is final but whose status was never moved on.
--
-- partner-api's status poll used to record courier_status without touching orders.status, and
-- because it usually ran before the webhook, the webhook then saw nothing new. Those orders sit at
-- 'shipped' (or earlier) next to a 'delivered' / 'cancelled' courier status, and partner-api no
-- longer re-asks about them since their courier outcome is final.
--
-- Same rules as _shared/steadfastStatus.ts (orderStatusFor / nextOrderStatus): only orders still
-- in flight are moved; anything an admin settled by hand (cancelled, returned, delivered) is kept.
-- `*_approval_pending` is not final and is left alone. Re-running it is harmless.

UPDATE public.orders
SET status = 'delivered'
WHERE status IN ('pending', 'processing', 'confirmed', 'shipped')
  AND courier_status IS NOT NULL
  AND courier_status NOT LIKE '%\_approval\_pending'
  AND (courier_status = 'delivered' OR courier_status LIKE 'partial\_delivered%');

UPDATE public.orders
SET status = 'returned'
WHERE status IN ('pending', 'processing', 'confirmed', 'shipped')
  AND courier_status IS NOT NULL
  AND courier_status NOT LIKE '%\_approval\_pending'
  AND courier_status LIKE 'cancelled%';
