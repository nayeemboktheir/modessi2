import { useCallback, useEffect, useState, type FormEvent, type MouseEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight, ChevronLeft, ChevronRight, Facebook, Gift, Heart, Instagram,
  LayoutDashboard, Mail, MapPin, Menu, Phone, RotateCcw, Search, ShieldCheck,
  ShoppingBag, Star, Truck, User, X, Youtube,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { addToCart, openCart, selectCartCount, toggleCart } from '@/store/slices/cartSlice';
import { selectWishlistItems, toggleWishlist } from '@/store/slices/wishlistSlice';
import type { Product as CartProduct } from '@/types';
import heroSlide1 from '@/assets/hero-slide-1.jpg';
import heroSlide2 from '@/assets/hero-slide-2.jpg';
import heroSlide3 from '@/assets/hero-slide-3.jpg';
import shopLogo from '@/assets/shop-logo.png';
import { toast } from 'sonner';

const PRODUCT_COLUMNS = 'id, name, price, original_price, images, slug, category_id, is_new, is_featured, rating, review_count, stock';

type Product = {
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

type Category = {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  description: string | null;
};

type Banner = {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string;
  link_url: string | null;
};

type HeroSlide = {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  link: string;
  image?: string;
  desktopImage?: string;
  mobileImage?: string;
};

type Promo = {
  tagline?: string;
  title?: string;
  subtitle?: string;
  buttonText?: string;
  link?: string;
  image?: string;
  mobileImage?: string;
};

type Feature = { icon?: string; title?: string; desc?: string };
type Testimonial = { name?: string; location?: string; text?: string; rating?: number };

type HomeContent = {
  header_promo?: { enabled?: boolean; text?: string };
  hero_slides?: { slides?: HeroSlide[] };
  promo_banners?: { banner1?: Promo; banner2?: Promo };
  featured_products?: { tagline?: string; title?: string; buttonText?: string };
  features_bar?: { items?: Feature[] };
  why_choose_us?: { tagline?: string; title?: string };
  testimonials?: { tagline?: string; title?: string; items?: Testimonial[] };
};

const defaultSlides: HeroSlide[] = [
  { id: 'purple', eyebrow: 'MODESSI NEW SEASON', title: 'নিজের মতো সাজুন, প্রতিদিন', subtitle: 'নকশায় নিজস্বতা, ফ্যাব্রিকে আরাম এবং আপনাকে ঘিরে তৈরি প্রতিটি গল্প।', link: '/products', image: heroSlide1 },
  { id: 'green', eyebrow: 'THE COTTON EDIT', title: 'আরামের মাঝেও থাকুক আভিজাত্য', subtitle: 'দৈনন্দিন পোশাকে সহজ সুন্দর এক নতুন অনুভূতি।', link: '/products?category=rayon-cotton', image: heroSlide2 },
  { id: 'festive', eyebrow: 'FESTIVE COLLECTION', title: 'উৎসবের জন্য অনন্য একটি সাজ', subtitle: 'বিশেষ দিনের জন্য বেছে নিন যত্নে তৈরি আমাদের কালেকশন।', link: '/products?category=three-piece', image: heroSlide3 },
];

const fallbackCategories: Category[] = [
  { id: 'all', name: 'সব কালেকশন', slug: '', image_url: null, description: null },
  { id: 'two', name: 'টু পিস', slug: 'two-piece', image_url: null, description: null },
  { id: 'three', name: 'থ্রি পিস', slug: 'three-piece', image_url: null, description: null },
  { id: 'saree', name: 'শাড়ি', slug: 'saree', image_url: null, description: null },
  { id: 'ready', name: 'রেডিমেড', slug: 'ready-made', image_url: null, description: null },
];

const fallbackPromos: Promo[] = [
  { tagline: 'CASUAL COLLECTION', title: 'Comfort for Everyday Stories', subtitle: 'আরাম, রঙ ও সুন্দর নকশার প্রতিদিনের কালেকশন।', buttonText: 'শপ করুন', link: '/products?category=two-piece' },
  { tagline: 'FESTIVE EDIT', title: 'A special look for your special day', subtitle: 'উৎসবের সাজে থাকুন নিজের মতো উজ্জ্বল।', buttonText: 'এক্সপ্লোর করুন', link: '/products?category=three-piece' },
];

const fallbackFeatures: Feature[] = [
  { icon: 'Gift', title: 'নির্বাচিত ডিজাইন', desc: 'ট্রেন্ডি ও এক্সক্লুসিভ' },
  { icon: 'RotateCcw', title: 'সহজ এক্সচেঞ্জ', desc: 'সাপোর্ট টিম সবসময় পাশে' },
  { icon: 'Truck', title: 'সারা দেশে ডেলিভারি', desc: 'নিরাপদে পৌঁছে যাবে' },
  { icon: 'Shield', title: 'মানের নিশ্চয়তা', desc: 'প্রতিটি পণ্যে কোয়ালিটি চেক' },
];

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function parseContent(rows: Array<{ section_key: string; content: unknown }>): HomeContent {
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

function money(price: number) {
  return '৳' + price.toLocaleString('en-BD');
}

function cartProduct(product: Product): CartProduct {
  return {
    id: product.id, name: product.name, slug: product.slug, description: '', price: product.price,
    originalPrice: product.original_price || undefined, images: product.images || [], category: '',
    rating: product.rating || 0, reviewCount: product.review_count || 0, stock: product.stock ?? 1,
  };
}

function iconFor(name?: string): LucideIcon {
  const icons: Record<string, LucideIcon> = { Gift, RotateCcw, Truck, Shield: ShieldCheck, ShieldCheck };
  return icons[name || ''] || ShieldCheck;
}

export default function FashionHomePage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user, isAdmin } = useAuth();
  const cartCount = useAppSelector(selectCartCount);
  const wishlistItems = useAppSelector(selectWishlistItems);
  const [content, setContent] = useState<HomeContent>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [featured, setFeatured] = useState<Product[]>([]);
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [recent, setRecent] = useState<Product[]>([]);
  const [legacyBanners, setLegacyBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [slideIndex, setSlideIndex] = useState(0);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

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
        if (featuredData.data) setFeatured(featuredData.data as Product[]);
        if (newData.data) setNewArrivals(newData.data as Product[]);
        if (recentData.data) setRecent(recentData.data as Product[]);
      } catch (error) {
        console.error('Unable to load homepage:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const slides = content.hero_slides?.slides?.length
    ? content.hero_slides.slides
    : legacyBanners.length
      ? legacyBanners.map((banner, index) => ({ id: banner.id, eyebrow: index === 0 ? 'MODESSI COLLECTION' : 'NEW SEASON', title: banner.title, subtitle: banner.subtitle || '', link: banner.link_url || '/products', image: banner.image_url }))
      : defaultSlides;
  const current = slides[slideIndex] || slides[0];
  const products = featured.length ? featured : newArrivals.length ? newArrivals : recent;
  const newProducts = newArrivals.length ? newArrivals : products;
  const categoryItems = categories.length ? categories.slice(0, 8) : fallbackCategories;
  const promos = [content.promo_banners?.banner1 || fallbackPromos[0], content.promo_banners?.banner2 || fallbackPromos[1]];
  const features = content.features_bar?.items?.length ? content.features_bar.items.slice(0, 4) : fallbackFeatures;
  const testimonials = (content.testimonials?.items || []).filter((item) => item.name && item.text).slice(0, 4);

  useEffect(() => {
    if (slides.length < 2 || reducedMotion) return;
    const timer = window.setInterval(() => setSlideIndex((value) => (value + 1) % slides.length), 6500);
    return () => window.clearInterval(timer);
  }, [slides.length, reducedMotion]);

  useEffect(() => {
    if (slideIndex >= slides.length) setSlideIndex(0);
  }, [slideIndex, slides.length]);

  const goNext = useCallback(() => setSlideIndex((value) => (value + 1) % slides.length), [slides.length]);
  const goPrevious = useCallback(() => setSlideIndex((value) => (value - 1 + slides.length) % slides.length), [slides.length]);
  const goCategory = (slug: string) => navigate(slug ? '/products?category=' + slug : '/products');

  const addProduct = (product: Product, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if ((product.stock ?? 1) <= 0) {
      toast.error('এই পণ্যটি এখন স্টকে নেই');
      return;
    }
    dispatch(addToCart({ product: cartProduct(product), quantity: 1 }));
    dispatch(openCart());
    toast.success('কার্টে যোগ করা হয়েছে');
  };

  const saveProduct = (product: Product, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const saved = wishlistItems.some((item) => item.id === product.id);
    dispatch(toggleWishlist(cartProduct(product)));
    toast.success(saved ? 'উইশলিস্ট থেকে সরানো হয়েছে' : 'উইশলিস্টে যোগ করা হয়েছে');
  };

  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigate(query.trim() ? '/products?search=' + encodeURIComponent(query.trim()) : '/products');
    setSearchOpen(false);
    setMobileMenu(false);
  };

  const campaign = Boolean(current.desktopImage || current.mobileImage);
  const desktopImage = current.desktopImage || current.image || heroSlide1;
  const mobileImage = current.mobileImage || desktopImage;

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#fcfaf7] text-[#382c2a]">
      {content.header_promo?.enabled !== false && <div className="bg-[#8e1837] text-white"><div className="mx-auto flex h-8 max-w-[1280px] items-center justify-center px-4 text-center text-[10px] font-semibold tracking-wide sm:text-xs">{content.header_promo?.text || 'সারা বাংলাদেশে ডেলিভারি · মানসম্মত পোশাকের নিশ্চয়তা'}</div></div>}

      <header className="sticky top-0 z-50 border-b border-[#e9e0d8] bg-[#fffdfa]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[70px] max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-6 lg:h-[76px] lg:px-8">
          <button type="button" aria-label="মেনু খুলুন" onClick={() => setMobileMenu((value) => !value)} className="grid h-10 w-10 place-items-center rounded-full text-[#523a3a] transition hover:bg-[#f5ece8] lg:hidden">{mobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
          <Link to="/" aria-label="Modessi home" className="shrink-0"><img src={shopLogo} alt="Modessi" className="h-10 w-auto sm:h-11" /></Link>
          <nav className="hidden items-center gap-6 text-[13px] font-semibold text-[#5c4b48] lg:flex"><Link to="/" className="text-[#941e3d]">হোম</Link><Link to="/products">সব কালেকশন</Link><Link to="/products?category=three-piece">থ্রি পিস</Link><Link to="/products?category=saree">শাড়ি</Link><Link to="/products?category=ready-made">রেডিমেড</Link><Link to="/about">Modessi গল্প</Link><Link to="/contact">যোগাযোগ</Link></nav>
          <div className="flex items-center gap-1 text-[#4b403d]"><button type="button" aria-label="পণ্য খুঁজুন" onClick={() => setSearchOpen((value) => !value)} className="grid h-9 w-9 place-items-center rounded-full transition hover:bg-[#f5ece8]"><Search className="h-[19px] w-[19px]" /></button><Link to={user ? (isAdmin ? '/admin' : '/my-account') : '/auth'} aria-label="অ্যাকাউন্ট" className="hidden h-9 w-9 place-items-center rounded-full transition hover:bg-[#f5ece8] sm:grid">{user && isAdmin ? <LayoutDashboard className="h-[19px] w-[19px]" /> : <User className="h-[19px] w-[19px]" />}</Link><Link to="/wishlist" aria-label="উইশলিস্ট" className="relative grid h-9 w-9 place-items-center rounded-full transition hover:bg-[#f5ece8]"><Heart className={'h-[19px] w-[19px] ' + (wishlistItems.length ? 'fill-[#941e3d] text-[#941e3d]' : '')} />{wishlistItems.length > 0 && <span className="absolute right-0 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-[#941e3d] px-1 text-[9px] text-white">{wishlistItems.length}</span>}</Link><button type="button" aria-label="কার্ট" onClick={() => dispatch(toggleCart())} className="relative grid h-9 w-9 place-items-center rounded-full transition hover:bg-[#f5ece8]"><ShoppingBag className="h-[19px] w-[19px]" />{cartCount > 0 && <span className="absolute right-0 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-[#941e3d] px-1 text-[9px] text-white">{cartCount}</span>}</button></div>
        </div>
        {searchOpen && <form onSubmit={search} className="border-t border-[#e9e0d8] bg-[#fffdfa]"><div className="mx-auto flex max-w-[720px] gap-2 px-4 py-3 sm:px-6"><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="আপনার পছন্দের পণ্য খুঁজুন" className="h-11 min-w-0 flex-1 rounded-full border border-[#d9cdc4] bg-white px-5 text-sm outline-none focus:border-[#941e3d]" /><button type="submit" className="inline-flex h-11 items-center gap-2 rounded-full bg-[#941e3d] px-5 text-sm font-semibold text-white">খুঁজুন <Search className="h-4 w-4" /></button></div></form>}
        {mobileMenu && <nav className="grid grid-cols-2 gap-x-8 gap-y-1 border-t border-[#e9e0d8] bg-[#fffdfa] px-5 py-4 text-sm font-semibold text-[#5c4b48] lg:hidden"><Link to="/" onClick={() => setMobileMenu(false)} className="py-2 text-[#941e3d]">হোম</Link><Link to="/products" onClick={() => setMobileMenu(false)} className="py-2">সব কালেকশন</Link><Link to="/products?category=three-piece" onClick={() => setMobileMenu(false)} className="py-2">থ্রি পিস</Link><Link to="/products?category=saree" onClick={() => setMobileMenu(false)} className="py-2">শাড়ি</Link><Link to="/products?category=ready-made" onClick={() => setMobileMenu(false)} className="py-2">রেডিমেড</Link><Link to="/about" onClick={() => setMobileMenu(false)} className="py-2">Modessi গল্প</Link><Link to="/contact" onClick={() => setMobileMenu(false)} className="py-2">যোগাযোগ</Link><Link to={user ? '/my-account' : '/auth'} onClick={() => setMobileMenu(false)} className="py-2">আমার অ্যাকাউন্ট</Link></nav>}
      </header>

      <main>
        <section className="relative isolate overflow-hidden"><article className={'relative overflow-hidden ' + (campaign ? 'min-h-[490px] bg-[#342026] sm:min-h-[550px]' : 'grid min-h-[490px] bg-[#f2ebe3] lg:grid-cols-[1.04fr_0.96fr]')}>
          {campaign && <><picture className="absolute inset-0"><source media="(max-width: 639px)" srcSet={mobileImage} /><img src={desktopImage} alt={current.title} className="h-full w-full object-cover" fetchPriority="high" /></picture><div className="absolute inset-0 bg-gradient-to-r from-[#241719]/95 via-[#241719]/60 to-transparent" /></>}
          <HeroCopy hero={current} light={campaign} onExplore={() => navigate(current.link)} />
          {!campaign && <div className="relative min-h-[320px] overflow-hidden bg-[#ddcdc1] lg:order-2"><picture className="absolute inset-0"><source media="(max-width: 639px)" srcSet={mobileImage} /><img src={desktopImage} alt={current.title} className="h-full w-full object-cover object-[50%_30%]" fetchPriority="high" /></picture></div>}
          <HeroButtons index={slideIndex} slides={slides} onPrevious={goPrevious} onNext={goNext} onSelect={setSlideIndex} />
        </article></section>

        <section className="border-y border-[#eee6df] bg-white"><div className="mx-auto max-w-[1280px] px-4 py-5 sm:px-6 lg:px-8">{loading ? <CircleSkeleton /> : <div className="flex gap-5 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{categoryItems.map((category, index) => <button key={category.id} type="button" onClick={() => goCategory(category.slug)} className="group min-w-[78px] flex-1 text-center sm:min-w-[94px]"><CategoryVisual category={category} index={index} rounded /><span className="mt-2 block whitespace-nowrap text-[11px] font-semibold text-[#5f514e] group-hover:text-[#941e3d] sm:text-xs">{category.name}</span></button>)}</div>}</div></section>

        <section className="bg-[#fcfaf7] px-4 py-10 sm:px-6 sm:py-14 lg:px-8"><div className="mx-auto grid max-w-[1280px] gap-5 lg:grid-cols-2">{promos.map((promo, index) => <PromoCard key={index} promo={promo} index={index} onOpen={() => navigate(promo.link || '/products')} />)}</div></section>

        <section className="bg-[#fcfaf7] px-4 pb-12 sm:px-6 sm:pb-16 lg:px-8"><div className="mx-auto max-w-[1280px]"><Heading eyebrow={content.featured_products?.tagline || 'নতুন যা এসেছে'} title={content.featured_products?.title || 'এই সপ্তাহের পছন্দ'} action={content.featured_products?.buttonText || 'সব দেখুন'} onAction={() => navigate('/products')} />{loading ? <ProductSkeleton /> : products.length ? <ProductGrid products={products.slice(0, 5)} wishlist={wishlistItems.map((item) => item.id)} onOpen={(slug) => navigate('/product/' + slug)} onAdd={addProduct} onSave={saveProduct} /> : <EmptyProducts />}</div></section>

        <section className="border-y border-[#eee5de] bg-[#f7f1eb] px-4 py-12 sm:px-6 sm:py-16 lg:px-8"><div className="mx-auto max-w-[1280px]"><Heading eyebrow="আপনার পছন্দ অনুযায়ী" title="ক্যাটাগরি অনুযায়ী দেখুন" action="সব ক্যাটাগরি" onAction={() => navigate('/products')} /><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{categoryItems.slice(0, 5).map((category, index) => <button key={category.id} type="button" onClick={() => goCategory(category.slug)} className="group relative aspect-[0.82] overflow-hidden rounded-2xl bg-[#e8dbd1] text-left shadow-[0_5px_16px_rgba(74,46,39,0.06)]"><CategoryVisual category={category} index={index} /><span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#2f2021]/85 via-[#2f2021]/28 to-transparent px-4 pb-4 pt-12 text-white"><strong className="block text-sm sm:text-base">{category.name}</strong><small className="mt-1 inline-flex items-center gap-1 text-[11px] text-white/80">শপ করুন <ArrowRight className="h-3 w-3" /></small></span></button>)}</div></div></section>

        <section className="bg-white px-4 py-12 sm:px-6 sm:py-16 lg:px-8"><div className="mx-auto max-w-[1280px]"><div className="mx-auto max-w-lg text-center"><p className="text-[11px] font-bold tracking-[0.15em] text-[#9a3f57]">{content.why_choose_us?.tagline || 'MODESSI PROMISE'}</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-[#392d2b] sm:text-3xl">{content.why_choose_us?.title || 'কেন Modessi?'}</h2><span className="mx-auto mt-4 block h-0.5 w-10 bg-[#941e3d]" /></div><div className="mt-10 grid divide-y divide-[#eadfd7] sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">{features.map((feature, index) => <TrustFeature key={(feature.title || 'feature') + index} feature={feature} />)}</div></div></section>

        <section className="bg-[#fcfaf7] px-4 pb-12 sm:px-6 sm:pb-16 lg:px-8"><div className="mx-auto max-w-[1280px]"><article className="relative overflow-hidden rounded-[1.75rem] bg-[#7f1c3a] px-7 py-10 text-white sm:px-12 sm:py-14"><div className="absolute -right-16 -top-20 h-72 w-72 rounded-full border-[32px] border-white/10" /><div className="relative max-w-xl"><p className="text-[11px] font-bold tracking-[0.16em] text-[#f6c8d4]">STORY OF MODESSI</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">পোশাকের চেয়েও বেশি, নিজের একটি অনুভূতি</h2><p className="mt-5 max-w-lg text-sm leading-6 text-white/80">বাংলাদেশী নারীর প্রতিদিনের আরাম, আত্মবিশ্বাস এবং নিজস্ব স্টাইলকে ঘিরেই আমাদের পথচলা। যত্নে বাছাই করা প্রতিটি নকশা আপনাকে নিজের মতো করে তুলে ধরে।</p><Link to="/about" className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/60 px-5 py-2.5 text-xs font-bold transition hover:bg-white hover:text-[#7f1c3a]">আমাদের গল্প জানুন <ArrowRight className="h-3.5 w-3.5" /></Link></div></article></div></section>

        {newProducts.length > 0 && <section className="bg-[#f7f1eb] px-4 py-12 sm:px-6 sm:py-16 lg:px-8"><div className="mx-auto max-w-[1280px]"><Heading eyebrow="নতুন সংযোজন" title="আপনার জন্য নতুন এসেছে" action="আরও দেখুন" onAction={() => navigate('/products')} /><ProductGrid products={newProducts.slice(0, 5)} wishlist={wishlistItems.map((item) => item.id)} onOpen={(slug) => navigate('/product/' + slug)} onAdd={addProduct} onSave={saveProduct} /></div></section>}

        {testimonials.length > 0 && <section className="bg-[#fcfaf7] px-4 py-12 sm:px-6 sm:py-16 lg:px-8"><div className="mx-auto max-w-[1280px]"><Heading eyebrow={content.testimonials?.tagline || 'WHAT OUR CUSTOMERS SAY'} title={content.testimonials?.title || 'ক্রেতাদের ভালোবাসার কথা'} action="সব রিভিউ" onAction={() => navigate('/products')} /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{testimonials.map((item, index) => <TestimonialCard key={(item.name || '') + index} item={item} />)}</div></div></section>}

        {products.length > 0 && <section className="border-y border-[#eee5de] bg-white px-4 py-7 sm:px-6 lg:px-8"><div className="mx-auto flex max-w-[1280px] flex-col gap-5 sm:flex-row sm:items-center"><div className="shrink-0"><p className="text-sm font-bold text-[#982342]">#ModessiLooks</p><h2 className="mt-0.5 text-lg font-semibold text-[#463733]">আমাদের কমিউনিটি থেকে</h2></div><div className="flex flex-1 gap-2 overflow-hidden">{products.slice(0, 6).map((product) => product.images[0] && <img key={product.id} src={product.images[0]} alt={product.name} className="h-16 w-16 shrink-0 rounded-xl object-cover sm:h-[76px] sm:w-[76px]" loading="lazy" />)}</div><a href="https://instagram.com" target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-[#b64e68] px-4 py-2.5 text-xs font-bold text-[#941e3d] transition hover:bg-[#941e3d] hover:text-white">Instagram দেখুন <ArrowRight className="h-3.5 w-3.5" /></a></div></section>}

        <section className="bg-[#f0e7df] px-4 py-11 sm:px-6 lg:px-8"><div className="mx-auto max-w-2xl text-center"><p className="text-[11px] font-bold tracking-[0.14em] text-[#994057]">MODESSI LETTER</p><h2 className="mt-2 text-xl font-semibold text-[#493a36] sm:text-2xl">সর্বশেষ কালেকশন ও অফার আপডেট পেতে সাবস্ক্রাইব করুন</h2><form className="mx-auto mt-5 flex max-w-xl rounded-full bg-white p-1.5 shadow-[0_6px_20px_rgba(89,57,44,0.08)]" onSubmit={(event) => { event.preventDefault(); toast.success('আপনার আগ্রহ নথিভুক্ত করা হয়েছে'); }}><input required aria-label="ইমেইল বা ফোন নম্বর" placeholder="আপনার ইমেইল বা ফোন নম্বর" className="min-w-0 flex-1 rounded-full bg-transparent px-4 text-xs outline-none placeholder:text-[#a99a92]" /><button type="submit" className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#941e3d] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#74142e] sm:px-6">সাবস্ক্রাইব <ArrowRight className="hidden h-3.5 w-3.5 sm:block" /></button></form></div></section>
      </main>

      <footer className="bg-[#fffdfa] pt-11 text-[#6d5e58]"><div className="mx-auto grid max-w-[1280px] gap-9 px-4 pb-10 sm:px-6 md:grid-cols-[1.3fr_0.8fr_0.9fr_1fr] lg:px-8"><div><img src={shopLogo} alt="Modessi" className="h-12 w-auto" loading="lazy" /><p className="mt-4 max-w-xs text-xs leading-5 text-[#7e706a]">বাংলাদেশী নারীর জন্য আরামদায়ক, মানসম্মত ও সমসাময়িক পোশাকের নির্ভরযোগ্য ঠিকানা।</p><div className="mt-4 flex gap-2"><FooterSocial icon={Facebook} label="Facebook" /><FooterSocial icon={Instagram} label="Instagram" /><FooterSocial icon={Youtube} label="YouTube" /></div></div><FooterColumn title="দ্রুত লিংক" links={[['সব কালেকশন', '/products'], ['থ্রি পিস', '/products?category=three-piece'], ['শাড়ি', '/products?category=saree'], ['আমাদের গল্প', '/about']]} /><FooterColumn title="কাস্টমার সেবা" links={[['আমার অ্যাকাউন্ট', '/my-account'], ['ডেলিভারি তথ্য', '/contact'], ['রিটার্ন পলিসি', '/contact'], ['সচরাচর জিজ্ঞাসা', '/contact']]} /><div><h3 className="text-sm font-bold text-[#4c3d38]">যোগাযোগ</h3><ul className="mt-4 space-y-3 text-xs"><li className="flex gap-2"><Phone className="h-4 w-4 shrink-0 text-[#96213f]" /><a href="tel:01812-345678">01812-345678</a></li><li className="flex gap-2"><Mail className="h-4 w-4 shrink-0 text-[#96213f]" /><a href="mailto:support@modessi.com">support@modessi.com</a></li><li className="flex gap-2"><MapPin className="h-4 w-4 shrink-0 text-[#96213f]" /><span>ঢাকা, বাংলাদেশ</span></li></ul></div></div><div className="border-t border-[#eee5de]"><div className="mx-auto flex max-w-[1280px] flex-col gap-2 px-4 py-4 text-[10px] text-[#9d8f88] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8"><span>© {new Date().getFullYear()} Modessi. All rights reserved.</span><span>Designed with <span className="text-[#9e2646]">♥</span> for stronger women</span></div></div></footer>
    </div>
  );
}

function HeroCopy({ hero, light, onExplore }: { hero: HeroSlide; light: boolean; onExplore: () => void }) {
  return <div className={'relative z-10 flex items-center px-7 py-10 sm:px-12 lg:px-16 ' + (light ? 'min-h-[490px] sm:min-h-[550px]' : 'min-h-[390px] lg:order-1 lg:min-h-[520px]')}><div className="max-w-[490px]"><p className={'text-[11px] font-bold tracking-[0.17em] ' + (light ? 'text-[#f4c4d0]' : 'text-[#a35668]')}>{hero.eyebrow}</p><h1 className={'mt-3 text-[38px] font-semibold leading-[1.13] tracking-[-0.04em] sm:text-5xl lg:text-[56px] ' + (light ? 'text-white' : 'text-[#352824]')}>{hero.title}</h1><p className={'mt-5 max-w-md text-sm leading-6 sm:text-[15px] ' + (light ? 'text-white/82' : 'text-[#6e6059]')}>{hero.subtitle}</p><button type="button" onClick={onExplore} className={'mt-7 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold shadow-[0_10px_24px_rgba(111,19,46,0.18)] transition hover:-translate-y-0.5 ' + (light ? 'bg-white text-[#871a38] hover:bg-[#f9e8ec]' : 'bg-[#941e3d] text-white hover:bg-[#76142e]')}>এখনই দেখুন <ArrowRight className="h-4 w-4" /></button><div className={'mt-9 grid max-w-sm grid-cols-3 gap-3 border-t pt-5 text-xs ' + (light ? 'border-white/20 text-white/72' : 'border-[#d9cec4] text-[#776961]')}><span><strong className={'block text-sm ' + (light ? 'text-white' : 'text-[#44342f]')}>নির্বাচিত</strong> ডিজাইন</span><span><strong className={'block text-sm ' + (light ? 'text-white' : 'text-[#44342f]')}>সারা দেশ</strong> ডেলিভারি</span><span><strong className={'block text-sm ' + (light ? 'text-white' : 'text-[#44342f]')}>সহজ</strong> এক্সচেঞ্জ</span></div></div></div>;
}

function HeroButtons({ index, slides, onPrevious, onNext, onSelect }: { index: number; slides: HeroSlide[]; onPrevious: () => void; onNext: () => void; onSelect: (value: number) => void }) {
  if (slides.length < 2) return null;
  return <><button type="button" aria-label="আগের স্লাইড" onClick={onPrevious} className="absolute left-4 top-1/2 z-20 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#8b1c3c] shadow-sm"><ChevronLeft className="h-5 w-5" /></button><button type="button" aria-label="পরের স্লাইড" onClick={onNext} className="absolute right-4 top-1/2 z-20 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#8b1c3c] shadow-sm"><ChevronRight className="h-5 w-5" /></button><div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 gap-1.5">{slides.map((slide, value) => <button key={slide.id} type="button" aria-label={(value + 1) + ' নম্বর স্লাইড'} aria-current={value === index} onClick={() => onSelect(value)} className={'h-1.5 rounded-full transition-all ' + (value === index ? 'w-7 bg-[#951f40]' : 'w-1.5 bg-[#951f40]/40')} />)}</div></>;
}

function CategoryVisual({ category, index, rounded = false }: { category: Category; index: number; rounded?: boolean }) {
  const shades = ['from-[#e8d3cb] to-[#f3e8de]', 'from-[#d6e2d2] to-[#eff2e4]', 'from-[#f0ddc6] to-[#f7eee1]', 'from-[#ded4e7] to-[#f0eaf1]', 'from-[#e9d9cd] to-[#f7eee6]'];
  if (category.image_url) return <span className={rounded ? 'mx-auto block h-[72px] w-[72px] overflow-hidden rounded-full border-2 border-[#f5ebe6] bg-white p-0.5 sm:h-[84px] sm:w-[84px]' : 'absolute inset-0 block'}><img src={category.image_url} alt={rounded ? '' : category.name} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" loading="lazy" /></span>;
  return <span className={rounded ? 'mx-auto grid h-[72px] w-[72px] place-items-center rounded-full border-2 border-[#f5ebe6] bg-gradient-to-br text-xl font-semibold text-[#8e4458] sm:h-[84px] sm:w-[84px] ' + shades[index % shades.length] : 'absolute inset-0 grid place-items-center bg-gradient-to-br text-5xl font-semibold text-[#9c5362] ' + shades[index % shades.length]}>{category.name.slice(0, 1)}</span>;
}

function PromoCard({ promo, index, onOpen }: { promo: Promo; index: number; onOpen: () => void }) {
  const hasImage = Boolean(promo.image || promo.mobileImage);
  const tone = index === 0 ? 'from-[#f3e7d6] via-[#eedcc5] to-[#ddc4a7]' : 'from-[#f5dfe1] via-[#f2d1d7] to-[#dfabb8]';
  return <button type="button" onClick={onOpen} className={'group relative min-h-[246px] overflow-hidden rounded-[1.5rem] bg-gradient-to-r p-7 text-left sm:min-h-[270px] sm:p-9 ' + tone}>{hasImage && <picture className="absolute inset-y-0 right-0 block w-[48%]">{promo.mobileImage && <source media="(max-width: 639px)" srcSet={promo.mobileImage} />}<img src={promo.image || promo.mobileImage} alt="" className="h-full w-full object-cover object-[50%_30%] transition duration-700 group-hover:scale-105" loading="lazy" /></picture>}<span className="relative z-10 block max-w-[260px]"><small className="text-[10px] font-bold tracking-[0.16em] text-[#7e655a]">{promo.tagline || 'MODESSI COLLECTION'}</small><strong className="mt-2 block text-2xl font-semibold leading-[1.12] tracking-[-0.03em] text-[#45312c] sm:text-[29px]">{promo.title || 'নতুন একটি সুন্দর গল্প'}</strong><span className="mt-3 block text-xs leading-5 text-[#66524a]">{promo.subtitle || 'আপনার পছন্দের জন্য বাছাই করা নতুন ডিজাইন।'}</span><span className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-[#4d332b] px-4 py-2.5 text-xs font-bold text-white transition group-hover:bg-[#871a38]">{promo.buttonText || 'দেখুন'} <ArrowRight className="h-3.5 w-3.5" /></span></span></button>;
}

function Heading({ eyebrow, title, action, onAction }: { eyebrow: string; title: string; action: string; onAction: () => void }) {
  return <div className="mb-7 flex items-end justify-between gap-4 sm:mb-8"><div><p className="text-[11px] font-bold tracking-[0.14em] text-[#9c4359]">{eyebrow}</p><h2 className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-[#392d29] sm:text-[29px]">{title}</h2></div><button type="button" onClick={onAction} className="mb-1 inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[#941e3d] hover:underline">{action} <ArrowRight className="h-3.5 w-3.5" /></button></div>;
}

function ProductGrid({ products, wishlist, onOpen, onAdd, onSave }: { products: Product[]; wishlist: string[]; onOpen: (slug: string) => void; onAdd: (product: Product, event: MouseEvent<HTMLButtonElement>) => void; onSave: (product: Product, event: MouseEvent<HTMLButtonElement>) => void }) {
  return <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-5 lg:grid-cols-5">{products.map((product) => <ProductCard key={product.id} product={product} saved={wishlist.includes(product.id)} onOpen={() => onOpen(product.slug)} onAdd={onAdd} onSave={onSave} />)}</div>;
}

function ProductCard({ product, saved, onOpen, onAdd, onSave }: { product: Product; saved: boolean; onOpen: () => void; onAdd: (product: Product, event: MouseEvent<HTMLButtonElement>) => void; onSave: (product: Product, event: MouseEvent<HTMLButtonElement>) => void }) {
  const discount = product.original_price && product.original_price > product.price ? Math.round((product.original_price - product.price) * 100 / product.original_price) : null;
  return <article onClick={onOpen} className="group cursor-pointer"><div className="relative aspect-[0.77] overflow-hidden rounded-2xl bg-[#efe6e0]">{product.images[0] ? <img src={product.images[0]} alt="" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none'; }} /> : <div className="grid h-full place-items-center bg-gradient-to-br from-[#f0ddd9] to-[#e5cfc1] px-5 text-center text-sm font-semibold text-[#8d4556]">{product.name}</div>}{(product.is_new || discount) && <span className="absolute left-2.5 top-2.5 rounded-full bg-[#a51e42] px-2 py-1 text-[9px] font-bold text-white">{discount ? '-' + discount + '%' : 'নতুন'}</span>}<button type="button" aria-label="উইশলিস্টে যোগ করুন" onClick={(event) => onSave(product, event)} className="absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full bg-white/92 text-[#8b1e3b] shadow-sm transition sm:opacity-0 sm:group-hover:opacity-100"><Heart className={'h-4 w-4 ' + (saved ? 'fill-current' : '')} /></button><button type="button" onClick={(event) => onAdd(product, event)} className="absolute inset-x-3 bottom-3 inline-flex h-10 translate-y-0 items-center justify-center gap-1.5 rounded-full bg-[#941e3d] text-xs font-bold text-white shadow-[0_8px_18px_rgba(117,20,47,0.25)] transition hover:bg-[#76142e] sm:translate-y-14 sm:group-hover:translate-y-0"><ShoppingBag className="h-3.5 w-3.5" /> কার্টে যোগ করুন</button></div><h3 className="mt-3 line-clamp-1 text-xs font-semibold text-[#4f413d] sm:text-sm">{product.name}</h3><div className="mt-1 flex items-center gap-1"><div className="flex text-[#eaa52c]">{Array.from({ length: 5 }).map((_, index) => <Star key={index} className={'h-2.5 w-2.5 ' + (index < Math.round(product.rating || 4) ? 'fill-current' : '')} />)}</div><span className="text-[10px] text-[#a0938d]">({product.review_count || 0})</span></div><div className="mt-1.5 flex items-baseline gap-2"><strong className="text-sm text-[#951f40] sm:text-base">{money(product.price)}</strong>{product.original_price && product.original_price > product.price && <span className="text-[10px] text-[#a69a94] line-through">{money(product.original_price)}</span>}</div></article>;
}

function TrustFeature({ feature }: { feature: Feature }) {
  const Icon = iconFor(feature.icon);
  return <div className="flex flex-col items-center px-5 py-7 text-center sm:py-3"><span className="grid h-11 w-11 place-items-center rounded-full bg-[#faeef0] text-[#9a2444]"><Icon className="h-5 w-5" /></span><h3 className="mt-3 text-sm font-bold text-[#564440]">{feature.title}</h3><p className="mt-1 text-xs text-[#92837d]">{feature.desc}</p></div>;
}

function TestimonialCard({ item }: { item: Testimonial }) {
  return <article className="rounded-2xl border border-[#ece2db] bg-white p-5 shadow-[0_5px_18px_rgba(70,46,41,0.04)]"><div className="flex gap-0.5 text-[#efa62f]">{Array.from({ length: 5 }).map((_, index) => <Star key={index} className={'h-3.5 w-3.5 ' + (index < (item.rating || 5) ? 'fill-current' : '')} />)}</div><p className="mt-3 min-h-[66px] text-sm leading-6 text-[#675955]">“{item.text}”</p><div className="mt-5 flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#f7e8e9] text-xs font-bold text-[#9b2a46]">{item.name?.slice(0, 1)}</span><span><strong className="block text-xs text-[#4c3e3a]">{item.name}</strong><small className="text-[11px] text-[#9b8c85]">{item.location}</small></span></div></article>;
}

function CircleSkeleton() {
  return <div className="flex justify-center gap-5">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-20 w-20 animate-pulse rounded-full bg-[#f2ebe5]" />)}</div>;
}

function ProductSkeleton() {
  return <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-5 lg:grid-cols-5">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="animate-pulse"><div className="aspect-[0.77] rounded-2xl bg-[#eee6e0]" /><div className="mt-3 h-3 w-3/4 rounded bg-[#eee6e0]" /><div className="mt-2 h-3 w-1/2 rounded bg-[#eee6e0]" /></div>)}</div>;
}

function EmptyProducts() {
  return <div className="rounded-2xl border border-dashed border-[#d9ccc2] bg-[#fffdfa] px-6 py-12 text-center"><ShoppingBag className="mx-auto h-7 w-7 text-[#a97480]" /><p className="mt-3 text-sm font-semibold text-[#5f4d48]">নতুন কালেকশন খুব শিগগিরই আসছে</p><p className="mt-1 text-xs text-[#978883]">সব পণ্য দেখতে আমাদের কালেকশন পেজে যান।</p></div>;
}

function FooterSocial({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return <a href="https://www.facebook.com/messages/t/282687191604098/" target="_blank" rel="noreferrer" aria-label={label} className="grid h-8 w-8 place-items-center rounded-full bg-[#f4e8e5] text-[#84203c] transition hover:bg-[#941e3d] hover:text-white"><Icon className="h-4 w-4" /></a>;
}

function FooterColumn({ title, links }: { title: string; links: [string, string][] }) {
  return <div><h3 className="text-sm font-bold text-[#4c3d38]">{title}</h3><ul className="mt-4 space-y-2.5">{links.map(([label, href]) => <li key={label}><Link to={href} className="text-xs transition hover:text-[#96213f]">{label}</Link></li>)}</ul></div>;
}
