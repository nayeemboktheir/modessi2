-- Enable Realtime (postgres_changes) for the orders table.
--
-- Realtime only streams tables in the `supabase_realtime` publication; every table
-- is off by default. RLS still applies -- Realtime evaluates the SELECT policy per
-- subscriber, so with "Admins can manage all orders" / "Users can view their own
-- orders" and guest orders carrying user_id IS NULL, only admin sessions receive
-- these events. The storefront and the wholesale app hold the anon key and get nothing.
--
-- REPLICA IDENTITY FULL is required, not optional: without it an UPDATE carries no
-- old_record and a DELETE carries only the primary key, which leaves Realtime unable
-- to evaluate RLS against those events and it drops them. The cost is a full old row
-- in the WAL per update.

-- Guarded so the migration is re-runnable: ALTER PUBLICATION ... ADD TABLE errors
-- if the table is already a member of the publication.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
END $$;

ALTER TABLE public.orders REPLICA IDENTITY FULL;
