import type { Product as StoreProduct } from '@/types';
import heroSlide1 from '@/assets/hero-slide-1.png';
import heroSlide2 from '@/assets/hero-slide-2.png';
import heroSlide3 from '@/assets/hero-slide-3.png';

export const PRODUCT_COLUMNS = 'id, name, price, original_price, images, slug, category_id, is_new, is_featured, rating, review_count, stock';

export type ProductRow = {
  id: string;
  name: string;
  price: number;
  original_price: number | null;
  images: string[];
  slug: string;
  category_id: string | null;
  is_new?: boolean;
  rating?: number;
  review_count?: number;
  stock?: number;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  description: string | null;
};

export type Banner = {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string;
  link_url: string | null;
};

export type HeroSlide = {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  link: string;
  image?: string;
  desktopImage?: string;
  mobileImage?: string;
};

export type Promo = {
  tagline?: string;
  title?: string;
  subtitle?: string;
  buttonText?: string;
  link?: string;
  image?: string;
  mobileImage?: string;
};

export type Feature = { icon?: string; title?: string; desc?: string };
export type Testimonial = { name?: string; location?: string; text?: string; rating?: number };

export type HomeContent = {
  header_promo?: { enabled?: boolean; text?: string };
  hero_slides?: { slides?: HeroSlide[] };
  promo_banners?: { banner1?: Promo; banner2?: Promo };
  featured_products?: { tagline?: string; title?: string; buttonText?: string };
  features_bar?: { items?: Feature[] };
  why_choose_us?: { tagline?: string; title?: string };
  testimonials?: { tagline?: string; title?: string; items?: Testimonial[] };
};

export const defaultSlides: HeroSlide[] = [
  { id: 'purple', eyebrow: 'MODESSI NEW SEASON', title: 'নিজের মতো সাজুন, প্রতিদিন', subtitle: 'নকশায় নিজস্বতা, ফ্যাব্রিকে আরাম এবং আপনাকে ঘিরে তৈরি প্রতিটি গল্প।', link: '/products', image: heroSlide1 },
  { id: 'green', eyebrow: 'THE COTTON EDIT', title: 'আরামের মাঝেও থাকুক আভিজাত্য', subtitle: 'দৈনন্দিন পোশাকে সহজ সুন্দর এক নতুন অনুভূতি।', link: '/products?category=rayon-cotton', image: heroSlide2 },
  { id: 'festive', eyebrow: 'FESTIVE COLLECTION', title: 'উৎসবের জন্য অনন্য একটি সাজ', subtitle: 'বিশেষ দিনের জন্য বেছে নিন যত্নে তৈরি আমাদের কালেকশন।', link: '/products?category=three-piece', image: heroSlide3 },
];

export const fallbackHeroImage = heroSlide1;

export const fallbackCategories: Category[] = [
  { id: 'all', name: 'সব কালেকশন', slug: '', image_url: null, description: null },
  { id: 'two', name: 'টু পিস', slug: 'two-piece', image_url: null, description: null },
  { id: 'three', name: 'থ্রি পিস', slug: 'three-piece', image_url: null, description: null },
  { id: 'saree', name: 'শাড়ি', slug: 'saree', image_url: null, description: null },
  { id: 'ready', name: 'রেডিমেড', slug: 'ready-made', image_url: null, description: null },
];

export const fallbackPromos: Promo[] = [
  { tagline: 'CASUAL COLLECTION', title: 'Comfort for Everyday Stories', subtitle: 'আরাম, রঙ ও সুন্দর নকশার প্রতিদিনের কালেকশন।', buttonText: 'শপ করুন', link: '/products?category=two-piece' },
  { tagline: 'FESTIVE EDIT', title: 'A special look for your special day', subtitle: 'উৎসবের সাজে থাকুন নিজের মতো উজ্জ্বল।', buttonText: 'এক্সপ্লোর করুন', link: '/products?category=three-piece' },
];

export const fallbackFeatures: Feature[] = [
  { icon: 'Gift', title: 'নির্বাচিত ডিজাইন', desc: 'ট্রেন্ডি ও এক্সক্লুসিভ' },
  { icon: 'RotateCcw', title: 'সহজ এক্সচেঞ্জ', desc: 'সাপোর্ট টিম সবসময় পাশে' },
  { icon: 'Truck', title: 'সারা দেশে ডেলিভারি', desc: 'নিরাপদে পৌঁছে যাবে' },
  { icon: 'Shield', title: 'মানের নিশ্চয়তা', desc: 'প্রতিটি পণ্যে কোয়ালিটি চেক' },
];

/** Soft fills for categories that have no image yet. */
export const categoryShades = ['from-[#e8d3cb] to-[#f3e8de]', 'from-[#d6e2d2] to-[#eff2e4]', 'from-[#f0ddc6] to-[#f7eee1]', 'from-[#ded4e7] to-[#f0eaf1]', 'from-[#e9d9cd] to-[#f7eee6]'];

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

export function parseContent(rows: Array<{ section_key: string; content: unknown }>): HomeContent {
  const result: HomeContent = {};

  rows.forEach((row) => {
    if (!record(row.content)) return;
    if (row.section_key === 'header_promo') {
      result.header_promo = { enabled: typeof row.content.enabled === 'boolean' ? row.content.enabled : undefined, text: text(row.content.text) };
    }
    if (row.section_key === 'hero_slides' && Array.isArray(row.content.slides)) {
      result.hero_slides = {
        slides: row.content.slides.filter(record).map((slide, index) => ({
          id: text(slide.id) || String(index),
          eyebrow: text(slide.badge) || 'MODESSI COLLECTION',
          title: text(slide.title) || defaultSlides[index % defaultSlides.length].title,
          subtitle: text(slide.subtitle) || defaultSlides[index % defaultSlides.length].subtitle,
          link: text(slide.link) || '/products',
          image: text(slide.image),
          desktopImage: text(slide.desktopImage),
          mobileImage: text(slide.mobileImage),
        })),
      };
    }
    if (row.section_key === 'promo_banners') {
      result.promo_banners = { banner1: parsePromo(row.content.banner1), banner2: parsePromo(row.content.banner2) };
    }
    if (row.section_key === 'featured_products') {
      result.featured_products = { tagline: text(row.content.tagline), title: text(row.content.title), buttonText: text(row.content.buttonText) };
    }
    if (row.section_key === 'features_bar' && Array.isArray(row.content.items)) {
      result.features_bar = { items: row.content.items.filter(record).map((item) => ({ icon: text(item.icon), title: text(item.title), desc: text(item.desc) })) };
    }
    if (row.section_key === 'why_choose_us') {
      result.why_choose_us = { tagline: text(row.content.tagline), title: text(row.content.title) };
    }
    if (row.section_key === 'testimonials' && Array.isArray(row.content.items)) {
      result.testimonials = {
        tagline: text(row.content.tagline),
        title: text(row.content.title),
        items: row.content.items.filter(record).map((item) => ({
          name: text(item.name),
          location: text(item.location),
          text: text(item.text),
          rating: typeof item.rating === 'number' ? item.rating : undefined,
        })),
      };
    }
  });

  return result;
}

function parsePromo(value: unknown): Promo | undefined {
  if (!record(value)) return undefined;
  return {
    tagline: text(value.tagline), title: text(value.title), subtitle: text(value.subtitle),
    buttonText: text(value.buttonText), link: text(value.link), image: text(value.image), mobileImage: text(value.mobileImage),
  };
}

/** Converts a home-page row into the shape the shared ProductCard and the cart use. */
export function toStoreProduct(product: ProductRow, categoryName = ''): StoreProduct {
  return {
    id: product.id, name: product.name, slug: product.slug, description: '', price: product.price,
    originalPrice: product.original_price || undefined, images: product.images || [], category: categoryName,
    rating: product.rating || 0, reviewCount: product.review_count || 0, stock: product.stock ?? 1,
    isNew: product.is_new,
  };
}
