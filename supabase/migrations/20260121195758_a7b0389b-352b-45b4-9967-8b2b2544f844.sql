-- Drop restrictive policies and recreate as permissive for draft_orders anonymous access
DROP POLICY IF EXISTS "Anyone can create draft orders" ON draft_orders;
DROP POLICY IF EXISTS "Anyone can update their draft orders" ON draft_orders;

-- Create PERMISSIVE policies for anonymous draft order access
CREATE POLICY "Anyone can create draft orders" 
ON draft_orders 
FOR INSERT 
TO public, anon, authenticated
WITH CHECK (true);

CREATE POLICY "Anyone can update draft orders by session" 
ON draft_orders 
FOR UPDATE 
TO public, anon, authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Anyone can read their draft orders by session" 
ON draft_orders 
FOR SELECT 
TO public, anon, authenticated
USING (true);