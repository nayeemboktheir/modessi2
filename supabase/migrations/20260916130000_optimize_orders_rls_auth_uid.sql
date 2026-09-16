-- The admin orders page got slow to load. The "orders" and "order_items" RLS
-- policies OR an admin check with a row-dependent condition:
--
--   has_role(auth.uid(), 'admin') OR auth.uid() = user_id
--
-- auth.uid() takes no columns, so on its own Postgres can fold it into a one-time
-- filter evaluated once per statement. But OR'd with a predicate that DOES reference
-- a column (user_id, or order_items' correlated EXISTS), the whole expression must be
-- evaluated per row -- which means has_role() re-runs its SELECT against user_roles
-- for every single order (and every order_item) scanned, not once for the request.
--
-- Wrapping auth.uid() as `(select auth.uid())` doesn't change what it returns, but it
-- turns the call into an inner subquery the planner can cache as an InitPlan and reuse
-- across every row, instead of a plain per-row function call. Same security semantics,
-- much less repeated work on a table this size. This also speeds up the exact-count
-- query on the same page (`select count(*) from orders`), which is filtered by the
-- same policies.

DROP POLICY IF EXISTS "Admins can manage all orders" ON public.orders;
CREATE POLICY "Admins can manage all orders" ON public.orders
  USING (public.has_role((select auth.uid()), 'admin'::public.app_role))
  WITH CHECK (public.has_role((select auth.uid()), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
CREATE POLICY "Users can view their own orders" ON public.orders
  FOR SELECT USING (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "Admins can manage all order items" ON public.order_items;
CREATE POLICY "Admins can manage all order items" ON public.order_items
  USING (public.has_role((select auth.uid()), 'admin'::public.app_role))
  WITH CHECK (public.has_role((select auth.uid()), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users can view their own order items" ON public.order_items;
CREATE POLICY "Users can view their own order items" ON public.order_items
  FOR SELECT USING ((EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_items.order_id AND orders.user_id = (select auth.uid())
  )));
