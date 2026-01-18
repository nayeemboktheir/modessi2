-- Deduplicate product_variations by (product_id, normalized name)
-- but first remap foreign key references (order_items, cart_items) to the kept row.

WITH ranked AS (
  SELECT
    id,
    product_id,
    lower(btrim(name)) AS norm_name,
    ROW_NUMBER() OVER (
      PARTITION BY product_id, lower(btrim(name))
      ORDER BY created_at ASC, id ASC
    ) AS rn,
    FIRST_VALUE(id) OVER (
      PARTITION BY product_id, lower(btrim(name))
      ORDER BY created_at ASC, id ASC
    ) AS keep_id
  FROM public.product_variations
), dups AS (
  SELECT id AS dup_id, keep_id
  FROM ranked
  WHERE rn > 1
)
-- 1) Remap order_items
UPDATE public.order_items oi
SET variation_id = d.keep_id
FROM dups d
WHERE oi.variation_id = d.dup_id;

WITH ranked AS (
  SELECT
    id,
    product_id,
    lower(btrim(name)) AS norm_name,
    ROW_NUMBER() OVER (
      PARTITION BY product_id, lower(btrim(name))
      ORDER BY created_at ASC, id ASC
    ) AS rn,
    FIRST_VALUE(id) OVER (
      PARTITION BY product_id, lower(btrim(name))
      ORDER BY created_at ASC, id ASC
    ) AS keep_id
  FROM public.product_variations
), dups AS (
  SELECT id AS dup_id, keep_id
  FROM ranked
  WHERE rn > 1
)
-- 2) Remap cart_items
UPDATE public.cart_items ci
SET variation_id = d.keep_id
FROM dups d
WHERE ci.variation_id = d.dup_id;

-- 3) Delete the now-unreferenced duplicates
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY product_id, lower(btrim(name))
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.product_variations
)
DELETE FROM public.product_variations pv
USING ranked r
WHERE pv.id = r.id
  AND r.rn > 1;

-- 4) Enforce uniqueness going forward
CREATE UNIQUE INDEX IF NOT EXISTS product_variations_unique_product_name
ON public.product_variations (product_id, lower(btrim(name)));