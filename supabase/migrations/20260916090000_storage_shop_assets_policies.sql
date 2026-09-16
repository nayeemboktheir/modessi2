-- Restore the RLS policies on storage.objects for the `shop-assets` bucket.
--
-- These existed on the Lovable-managed project but were lost in the September
-- 2026 migration: the import deliberately carried no `storage` DDL, because
-- self-hosted storage-api owns and versions that schema itself and the cloud
-- copy had object-versioning columns (archived_at, is_delete_marker,
-- is_versioned) that storage-api v1.44.2 does not have. Correct for the schema,
-- wrong for the policies - those are application-level.
--
-- Symptom without them: product and slider images still *display*, because the
-- bucket is public and reads bypass RLS on the public object path, but every
-- upload from the admin panel fails ("Failed to upload image"). Writes go
-- through the authenticated user's own session, not the service role, so they
-- need a policy.
--
-- MUST be run as a superuser (`supabase_admin`), not `postgres`: storage.objects
-- is owned by supabase_storage_admin, and creating a policy requires ownership.
--
--   psql -U supabase_admin -d postgres -f this-file.sql
--
-- Idempotent.

-- Public read. The bucket is public, so this mainly matters for API reads that
-- do not use the /object/public/ path.
DROP POLICY IF EXISTS "Anyone can view shop assets" ON storage.objects;
CREATE POLICY "Anyone can view shop assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'shop-assets');

-- Writes are admin-only, gated by the same helper the rest of the schema uses,
-- so there is one definition of "admin" across the whole database.
DROP POLICY IF EXISTS "Admins can upload shop assets" ON storage.objects;
CREATE POLICY "Admins can upload shop assets"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'shop-assets'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "Admins can update shop assets" ON storage.objects;
CREATE POLICY "Admins can update shop assets"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'shop-assets'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    bucket_id = 'shop-assets'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "Admins can delete shop assets" ON storage.objects;
CREATE POLICY "Admins can delete shop assets"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'shop-assets'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- Report what now applies, so a run that silently did nothing is visible.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
    FROM pg_policies
   WHERE schemaname = 'storage' AND tablename = 'objects'
     AND policyname LIKE '%shop assets%';
  RAISE NOTICE 'shop-assets policies on storage.objects: %', n;
  IF n <> 4 THEN
    RAISE EXCEPTION 'expected 4 shop-assets policies, found %', n;
  END IF;
END
$$;
