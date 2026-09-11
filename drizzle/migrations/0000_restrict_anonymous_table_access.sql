-- Close two anonymous-access holes.
--
-- 1. draft_orders was readable and writable by anon with USING (true), exposing the
--    name, phone, address and cart of every customer who ever started checkout.
-- 2. orders / order_items accepted anonymous INSERT, letting a client bypass the
--    validation and pricing in the place-order function entirely.

-- ---------------------------------------------------------------------------
-- draft_orders
-- ---------------------------------------------------------------------------

-- Anonymous shoppers must still be able to create and update their own draft while
-- filling in the checkout form, but they never need to read one back: the client now
-- generates the draft's UUID itself and keeps it in localStorage (see CheckoutPage).
-- With no SELECT policy for anon, an unknown id cannot be enumerated or read.

DROP POLICY IF EXISTS "Anyone can read their draft orders by session" ON public.draft_orders;
DROP POLICY IF EXISTS "Anyone can update draft orders by session" ON public.draft_orders;
DROP POLICY IF EXISTS "Anyone can create draft orders" ON public.draft_orders;
DROP POLICY IF EXISTS "Anyone can update their draft orders" ON public.draft_orders;

CREATE POLICY "Anon can create a draft order"
ON public.draft_orders
FOR INSERT
TO anon, authenticated
WITH CHECK (is_converted IS NOT TRUE);

-- Scoped to the row's own lifetime so a leaked id cannot be used to rewrite an old
-- or already-converted draft.
CREATE POLICY "Anon can update an unconverted draft order"
ON public.draft_orders
FOR UPDATE
TO anon, authenticated
USING (
  is_converted IS NOT TRUE
  AND created_at > now() - interval '2 days'
)
WITH CHECK (created_at > now() - interval '2 days');

-- Admins keep full access through the existing
-- "Admins can manage all draft orders" policy (FOR ALL, has_role check).

-- ---------------------------------------------------------------------------
-- orders / order_items
-- ---------------------------------------------------------------------------

-- Orders are created exclusively by the place-order edge function, which uses the
-- service-role key and therefore bypasses RLS. Nothing in the browser inserts here,
-- so the anonymous INSERT policies only ever served as a bypass.

DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can create order items" ON public.order_items;

-- Admins retain INSERT via "Admins can manage all orders" / "Admins can manage all
-- order items"; customers retain SELECT on their own rows.