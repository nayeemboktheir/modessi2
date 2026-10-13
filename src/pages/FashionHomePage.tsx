import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { HomeHero } from '@/components/home/HomeHero';
import { CategoryRail } from '@/components/home/CategorySections';
import { CategoryShowcase } from '@/components/home/CategoryShowcase';
import { ProductShelf } from '@/components/home/ProductShelf';
import { PromoDuo } from '@/components/home/PromoDuo';
import { Newsletter, StorySection, TestimonialMarquee, TrustSection } from '@/components/home/BrandSections';
import {
  PRODUCT_COLUMNS,
  defaultSlides,
  fallbackCategories,
  fallbackFeatures,
  fallbackPromos,
  parseContent,
  toStoreProduct,
  type Banner,
  type Category,
  type HeroSlide,
  type HomeContent,
  type ProductRow,
} from '@/components/home/content';

export default function FashionHomePage() {
  const navigate = useNavigate();
  const [content, setContent] = useState<HomeContent>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [featured, setFeatured] = useState<ProductRow[]>([]);
  const [newArrivals, setNewArrivals] = useState<ProductRow[]>([]);
  const [recent, setRecent] = useState<ProductRow[]>([]);
  const [legacyBanners, setLegacyBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [home, banners, categoryData, featuredData, newData, recentData] = await Promise.all([
          supabase.from('home_page_content').select('*'),
          supabase.from('banners').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
          supabase.from('categories').select('*').order('sort_order', { ascending: true }),
          supabase.from('products').select(PRODUCT_COLUMNS).eq('is_featured', true).eq('is_active', true).limit(10),
          supabase.from('products').select(PRODUCT_COLUMNS).eq('is_new', true).eq('is_active', true).limit(10),
          supabase.from('products').select(PRODUCT_COLUMNS).eq('is_active', true).order('created_at', { ascending: false }).limit(10),
        ]);
        if (home.data) setContent(parseContent(home.data));
        if (banners.data) setLegacyBanners(banners.data as Banner[]);
        if (categoryData.data) setCategories(categoryData.data as Category[]);
        if (featuredData.data) setFeatured(featuredData.data as ProductRow[]);
        if (newData.data) setNewArrivals(newData.data as ProductRow[]);
        if (recentData.data) setRecent(recentData.data as ProductRow[]);
      } catch (error) {
        console.error('Unable to load homepage:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const configuredSlides = (content.hero_slides?.slides || []).filter((slide) => Boolean(slide.image || slide.desktopImage || slide.mobileImage));
  const slides = configuredSlides.length
    ? configuredSlides
    : legacyBanners.length
      ? legacyBanners.map((banner, index): HeroSlide => ({ id: banner.id, eyebrow: index === 0 ? 'MODESSI COLLECTION' : 'NEW SEASON', title: banner.title, subtitle: banner.subtitle || '', link: banner.link_url || '/products', image: banner.image_url }))
      : defaultSlides;

  const categoryName = (id: string | null) => categories.find((category) => category.id === id)?.name || '';
  const asStore = (rows: ProductRow[]) => rows.map((row) => toStoreProduct(row, categoryName(row.category_id)));

  const products = featured.length ? featured : newArrivals.length ? newArrivals : recent;
  const newProducts = newArrivals.length ? newArrivals : products;
  const categoryItems = categories.length ? categories.slice(0, 8) : fallbackCategories;
  const promos = [content.promo_banners?.banner1 || fallbackPromos[0], content.promo_banners?.banner2 || fallbackPromos[1]];
  const features = content.features_bar?.items?.length ? content.features_bar.items.slice(0, 4) : fallbackFeatures;
  const testimonials = (content.testimonials?.items || []).filter((item) => item.name && item.text).slice(0, 4);
  const storyImages = [...products, ...recent].map((product) => product.images?.[0]).filter(Boolean).filter((image, index, all) => all.indexOf(image) === index).slice(0, 3);
  // Photos for the promise grid: skip the ones the story section already shows.
  const allImages = [...products, ...newProducts, ...recent].map((product) => product.images?.[0]).filter(Boolean).filter((image, index, all) => all.indexOf(image) === index);
  const trustImages = allImages.filter((image) => !storyImages.includes(image)).slice(0, 4);

  const goCategory = (slug: string) => navigate(slug ? '/products?category=' + slug : '/products');

  return (
    <div className="bg-surface text-ink">
      <HomeHero slides={slides} loading={loading} onExplore={(link) => navigate(link)} />

      <CategoryRail categories={categoryItems} loading={loading} onSelect={goCategory} />

      <ProductShelf
        eyebrow={content.featured_products?.tagline || 'নতুন যা এসেছে'}
        title={content.featured_products?.title || 'এই সপ্তাহের পছন্দ'}
        action={content.featured_products?.buttonText || 'সব দেখুন'}
        onAction={() => navigate('/products')}
        products={asStore(products.slice(0, 5))}
        loading={loading}
      />

      <PromoDuo promos={promos} onOpen={(link) => navigate(link)} />

      <CategoryShowcase categories={categoryItems} onSelect={goCategory} onAll={() => navigate('/products')} />

      {newProducts.length > 0 && (
        <ProductShelf
          eyebrow="নতুন সংযোজন"
          title="আপনার জন্য নতুন এসেছে"
          action="আরও দেখুন"
          onAction={() => navigate('/products')}
          products={asStore(newProducts.slice(0, 5))}
        />
      )}

      <TrustSection
        tagline={content.why_choose_us?.tagline || 'MODESSI PROMISE'}
        title={content.why_choose_us?.title || 'কেন Modessi?'}
        features={features}
        images={trustImages.length ? trustImages : allImages.slice(0, 4)}
      />

      <StorySection images={storyImages} />

      {testimonials.length > 0 && (
        <TestimonialMarquee
          tagline={content.testimonials?.tagline || 'WHAT OUR CUSTOMERS SAY'}
          title={content.testimonials?.title || 'ক্রেতাদের ভালোবাসার কথা'}
          items={testimonials}
        />
      )}

      <Newsletter />
    </div>
  );
}
