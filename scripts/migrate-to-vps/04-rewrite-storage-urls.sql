-- Repoint absolute storage URLs from the old Lovable project to the new stack.
--
-- Run with:  psql -v src=https://OLD.supabase.co -v dst=https://api.modessi.shop -v bucket=shop-assets
--
-- Only the exact public-object prefix is rewritten. Legacy WordPress images on
-- https://modessi.shop/wp-content/... are left alone on purpose: they are served
-- by Hostinger and have nothing to do with this migration.
--
-- Idempotent: re-running finds nothing left to change.
\set old_prefix :src '/storage/v1/object/public/' :bucket '/'
\set new_prefix :dst '/storage/v1/object/public/' :bucket '/'

\echo '  rewriting' :'old_prefix' '->' :'new_prefix'

begin;

-- order_items.product_image - historical order thumbnails (~6,745 rows)
update order_items
   set product_image = replace(product_image, :'old_prefix', :'new_prefix')
 where product_image like :'old_prefix' || '%';
\echo '  order_items.product_image rows updated:'
select count(*) as still_on_old_host from order_items where product_image like :'old_prefix' || '%';

-- products.images is text[] - rewrite element-wise (~113 elements over 27 rows)
update products
   set images = (
     select array_agg(replace(elem, :'old_prefix', :'new_prefix') order by ord)
       from unnest(images) with ordinality as u(elem, ord)
   )
 where array_to_string(images, ',') like '%' || :'old_prefix' || '%';
\echo '  products.images rows still on old host:'
select count(*) as still_on_old_host from products where array_to_string(images,',') like '%' || :'old_prefix' || '%';

-- admin_settings: favicon_url, shop_logo_url, site_logo (3 rows)
update admin_settings
   set value = replace(value, :'old_prefix', :'new_prefix')
 where value like '%' || :'old_prefix' || '%';
\echo '  admin_settings rows still on old host:'
select count(*) as still_on_old_host from admin_settings where value like '%' || :'old_prefix' || '%';

-- Catch anything the audit above did not anticipate, so it surfaces loudly
-- instead of silently pointing at a project that may get deleted.
\echo '  --- any remaining references to the old project anywhere obvious ---'
select 'categories.image_url' as loc, count(*) from categories where image_url like '%' || :'src' || '%'
union all select 'banners.image_url', count(*) from banners where image_url like '%' || :'src' || '%'
union all select 'home_page_content.content', count(*) from home_page_content where content::text like '%' || :'src' || '%'
union all select 'landing_pages.sections', count(*) from landing_pages where coalesce(sections::text,'') like '%' || :'src' || '%'
union all select 'products.long_description', count(*) from products where coalesce(long_description,'') like '%' || :'src' || '%'
union all select 'profiles.avatar_url', count(*) from profiles where coalesce(avatar_url,'') like '%' || :'src' || '%'
union all select 'reviews.images', count(*) from reviews where coalesce(array_to_string(images,','),'') like '%' || :'src' || '%';

commit;
