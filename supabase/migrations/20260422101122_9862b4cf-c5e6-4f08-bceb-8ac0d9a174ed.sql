ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_variation_id_fkey;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_variation_id_fkey FOREIGN KEY (variation_id) REFERENCES public.product_variations(id) ON DELETE SET NULL;

ALTER TABLE public.cart_items DROP CONSTRAINT IF EXISTS cart_items_variation_id_fkey;
ALTER TABLE public.cart_items ADD CONSTRAINT cart_items_variation_id_fkey FOREIGN KEY (variation_id) REFERENCES public.product_variations(id) ON DELETE CASCADE;