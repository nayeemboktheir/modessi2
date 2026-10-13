import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, m, useReducedMotion, type PanInfo } from 'framer-motion';
import {
  Heart,
  ShoppingBag,
  ChevronLeft,
  ChevronRight,
  Phone,
  CheckCircle2,
  Expand,
  X,
  Truck,
  ShieldCheck,
  RotateCcw,
  Zap,
} from 'lucide-react';
import ProductCard from '@/components/products/ProductCard';
import { fetchProductBySlug, fetchProducts } from '@/services/productService';
import { Product, ProductVariation } from '@/types';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { addToCart, openCart } from '@/store/slices/cartSlice';
import { toggleWishlist, selectWishlistItems } from '@/store/slices/wishlistSlice';
import { toast } from 'sonner';
import { useFacebookPixel } from '@/hooks/useFacebookPixel';
import { useServerTracking } from '@/hooks/useServerTracking';
import { supabase } from '@/integrations/supabase/client';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { Reveal, Stagger, StaggerItem, useCanHover, EASE_OUT } from '@/components/motion';
import { cn } from '@/lib/utils';

const ProductDetailPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const canHover = useCanHover();
  const [selectedImage, setSelectedImage] = useState(0);
  const [imageDirection, setImageDirection] = useState(1);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const [lightbox, setLightbox] = useState(false);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const [quantity, setQuantity] = useState(1);
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | undefined>(undefined);

  // Per-product link preview: without this every product shared the one generic
  // og:image and title from index.html, so all shared links looked identical.
  useDocumentMeta({
    title: product ? `${product.name} | Modessi` : undefined,
    description: product?.description?.slice(0, 160) || undefined,
    image: product?.images?.[0],
    type: 'product',
  });

  const dispatch = useAppDispatch();
  const wishlistItems = useAppSelector(selectWishlistItems);
  const { trackViewContent, trackAddToCartWithEventId, generateEventId, isReady } = useFacebookPixel();
  const { trackAddToCart: trackServerAddToCart, trackViewContent: trackServerViewContent } = useServerTracking();

  // Fetch social media settings for Call Now and Messenger buttons
  const { data: socialSettings } = useQuery({
    queryKey: ["product-social-settings"],
    queryFn: async () => {
      const keys = ["messenger_enabled", "messenger_page_id", "call_enabled", "call_number"];
      const { data, error } = await supabase
        .from("admin_settings")
        .select("key, value")
        .in("key", keys);

      if (error) throw error;

      const result = {
        messenger_enabled: false,
        messenger_page_id: "",
        call_enabled: false,
        call_number: "",
      };

      data?.forEach((item) => {
        if (item.key === "messenger_enabled") result.messenger_enabled = item.value === "true";
        if (item.key === "messenger_page_id") result.messenger_page_id = item.value;
        if (item.key === "call_enabled") result.call_enabled = item.value === "true";
        if (item.key === "call_number") result.call_number = item.value;
      });

      return result;
    },
    staleTime: 1000 * 60 * 5,
  });

  const isInWishlist = product ? wishlistItems.some((item) => item.id === product.id) : false;
  const hasVariations = product?.variations && product.variations.length > 0;

  // Track ViewContent when product loads - both browser pixel and CAPI
  useEffect(() => {
    if (product && isReady) {
      console.log('Firing ViewContent for product:', product.name);

      // Browser pixel
      trackViewContent({
        content_ids: [product.id],
        content_name: product.name,
        content_type: 'product',
        value: product.price,
        currency: 'BDT',
      });

      // Server-side CAPI
      trackServerViewContent({
        contentId: product.id,
        contentName: product.name,
        value: product.price,
        currency: 'BDT',
      });
    }
  }, [product, isReady, trackViewContent, trackServerViewContent]);

  useEffect(() => {
    const loadProduct = async () => {
      if (!slug) return;
      setIsLoading(true);
      try {
        const [productData, allProducts] = await Promise.all([
          fetchProductBySlug(slug),
          fetchProducts(),
        ]);
        setProduct(productData);
        // Do NOT auto-select variation - customer should select manually
        setSelectedVariation(undefined);
        setSelectedImage(0);
        if (productData) {
          setRelatedProducts(
            allProducts
              .filter((p) => p.category === productData.category && p.id !== productData.id)
              .slice(0, 4)
          );
        }
      } catch (error) {
        console.error('Failed to load product:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadProduct();
    window.scrollTo(0, 0);
  }, [slug]);

  // Phone-only sticky buy bar: appears once the main buttons scroll above the fold.
  useEffect(() => {
    const target = actionsRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => {
      setShowStickyBar(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [product]);

  useEffect(() => {
    if (!lightbox) return;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setLightbox(false); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [lightbox]);

  if (isLoading) {
    return (
      <div className="shell grid gap-8 py-10 lg:grid-cols-2 lg:gap-14">
        <div className="skeleton-shimmer aspect-square rounded-3xl" />
        <div className="space-y-4 pt-4">
          <div className="skeleton-shimmer h-8 w-3/4 rounded-lg" />
          <div className="skeleton-shimmer h-4 w-1/3 rounded" />
          <div className="skeleton-shimmer h-10 w-1/2 rounded-lg" />
          <div className="skeleton-shimmer h-24 w-full rounded-2xl" />
          <div className="grid grid-cols-2 gap-3">
            <div className="skeleton-shimmer h-12 rounded-full" />
            <div className="skeleton-shimmer h-12 rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center py-16">
        <m.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <h1 className="mb-5 text-2xl font-bold text-ink">Product Not Found</h1>
          <Link to="/products" className="inline-flex rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white shadow-cta transition-colors hover:bg-brand-deep">
            Back to Products
          </Link>
        </m.div>
      </div>
    );
  }

  const formatPrice = (price: number) => `৳${price.toLocaleString('en-BD')}`;

  // Get display price based on selected variation or base product
  const displayPrice = selectedVariation?.price ?? product.price;
  const displayOriginalPrice = selectedVariation?.original_price ?? product.originalPrice;
  const discountAmount = displayOriginalPrice ? displayOriginalPrice - displayPrice : 0;
  const currentStock = selectedVariation?.stock ?? product.stock;
  const imageCount = product.images.length;

  const handleAddToCart = () => {
    if (hasVariations && !selectedVariation) {
      toast.error('সাইজ সিলেক্ট করুন');
      return;
    }

    dispatch(addToCart({ product, quantity, variation: selectedVariation }));
    dispatch(openCart());
    // Track AddToCart event - both browser pixel and server CAPI
    const eventId = generateEventId('AddToCart');
    console.log('Firing AddToCart for product:', product.name, 'eventId:', eventId);

    // Browser pixel
    trackAddToCartWithEventId({
      content_ids: [product.id],
      content_name: product.name,
      content_type: 'product',
      value: displayPrice * quantity,
      currency: 'BDT',
    }, eventId);

    // Server-side CAPI (runs in parallel)
    trackServerAddToCart({
      contentId: product.id,
      contentName: product.name,
      value: displayPrice * quantity,
      quantity: quantity,
      currency: 'BDT',
    });

    toast.success('Added to cart!');
  };

  const handleBuyNow = () => {
    if (hasVariations && !selectedVariation) {
      toast.error('সাইজ সিলেক্ট করুন');
      return;
    }

    dispatch(addToCart({ product, quantity, variation: selectedVariation }));

    // Track AddToCart event - both browser pixel and server CAPI
    const eventId = generateEventId('AddToCart');
    console.log('Firing AddToCart (Buy Now) for product:', product.name, 'eventId:', eventId);

    // Browser pixel
    trackAddToCartWithEventId({
      content_ids: [product.id],
      content_name: product.name,
      content_type: 'product',
      value: displayPrice * quantity,
      currency: 'BDT',
    }, eventId);

    // Server-side CAPI (runs in parallel)
    trackServerAddToCart({
      contentId: product.id,
      contentName: product.name,
      value: displayPrice * quantity,
      quantity: quantity,
      currency: 'BDT',
    });

    navigate('/checkout');
  };

  const handleToggleWishlist = () => {
    dispatch(toggleWishlist(product));
    toast.success(isInWishlist ? 'Removed from wishlist' : 'Added to wishlist!');
  };

  const handleCallNow = () => {
    if (socialSettings?.call_number) {
      window.location.href = `tel:${socialSettings.call_number}`;
    }
  };

  const handleMessenger = () => {
    if (socialSettings?.messenger_page_id) {
      const link = socialSettings.messenger_page_id.trim();
      const url = link.startsWith("http") ? link : `https://${link}`;
      window.open(url, "_blank");
    }
  };

  const showImage = (next: number) => {
    setImageDirection(next > selectedImage ? 1 : -1);
    setSelectedImage((next + imageCount) % imageCount);
  };
  const onImagePan = (_: unknown, info: PanInfo) => {
    if (imageCount < 2) return;
    if (info.offset.x < -50) showImage(selectedImage + 1);
    else if (info.offset.x > 50) showImage(selectedImage - 1);
  };

  const infoItem = {
    hidden: { opacity: 0, y: 18 },
    show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE_OUT } },
  };

  return (
    <div className="min-h-screen bg-surface pb-24 md:pb-16">
      <div className="shell pt-6 sm:pt-8">
        {/* Breadcrumb */}
        <m.nav initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 text-sm">
          <ol className="flex items-center gap-2 text-ink-muted">
            <li><Link to="/" className="transition-colors hover:text-brand">Home</Link></li>
            <li className="text-ink-muted/50">›</li>
            <li><Link to="/products" className="transition-colors hover:text-brand">Products</Link></li>
            <li className="text-ink-muted/50">›</li>
            <li className="max-w-[200px] truncate text-ink">{product.name}</li>
          </ol>
          <Link to="/" className="group mt-2 inline-flex items-center gap-1 text-sm text-ink-muted transition-colors hover:text-brand">
            <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            Back To Home
          </Link>
        </m.nav>

        <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
          {/* Image Gallery */}
          <m.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, ease: EASE_OUT }} className="lg:sticky lg:top-24 lg:self-start">
            <m.div
              onPanEnd={onImagePan}
              style={{ touchAction: 'pan-y' }}
              className={cn('group relative mb-4 aspect-square overflow-hidden rounded-3xl bg-surface-sand shadow-[0_20px_50px_-30px_rgba(74,30,40,0.5)]', canHover && 'cursor-zoom-in')}
              onMouseMove={(event) => {
                if (!canHover || reduce) return;
                const rect = event.currentTarget.getBoundingClientRect();
                setZoom({ x: ((event.clientX - rect.left) / rect.width) * 100, y: ((event.clientY - rect.top) / rect.height) * 100 });
              }}
              onMouseLeave={() => setZoom(null)}
              onClick={() => { if (!canHover) setLightbox(true); }}
            >
              <AnimatePresence initial={false} custom={imageDirection} mode="popLayout">
                <m.img
                  key={selectedImage}
                  custom={imageDirection}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, x: imageDirection * 60 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, x: imageDirection * -60 }}
                  transition={{ duration: 0.45, ease: EASE_OUT }}
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                  src={product.images[selectedImage]}
                  alt={product.name}
                  draggable={false}
                  className="h-full w-full object-cover transition-transform duration-200 ease-out"
                  style={zoom ? { transform: 'scale(2)', transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
                />
              </AnimatePresence>

              {displayOriginalPrice && discountAmount > 0 && (
                <span className="shine-sweep absolute left-4 top-4 overflow-hidden rounded-full bg-brand px-3 py-1.5 text-xs font-bold text-white shadow-lg">
                  {discountAmount} ৳ off
                </span>
              )}

              <button type="button" aria-label="Fullscreen" onClick={(event) => { event.stopPropagation(); setLightbox(true); }} className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-ink-soft shadow-md backdrop-blur transition-all hover:scale-110 hover:text-brand">
                <Expand className="h-4 w-4" />
              </button>

              {/* Navigation Arrows */}
              {imageCount > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(event) => { event.stopPropagation(); showImage(selectedImage - 1); }}
                    className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow-md backdrop-blur-sm transition-all hover:scale-110 hover:bg-white sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={(event) => { event.stopPropagation(); showImage(selectedImage + 1); }}
                    className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow-md backdrop-blur-sm transition-all hover:scale-110 hover:bg-white sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5 sm:hidden">
                    {product.images.map((_, index) => (
                      <span key={index} className={cn('h-1.5 rounded-full bg-white shadow transition-all duration-300', index === selectedImage ? 'w-6' : 'w-1.5 opacity-60')} />
                    ))}
                  </div>
                </>
              )}
            </m.div>

            {/* Thumbnails - Horizontal Scroll Gallery */}
            {imageCount > 1 && (
              <div className="no-scrollbar flex gap-2.5 overflow-x-auto p-1">
                {product.images.map((image, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => showImage(index)}
                    className={cn('relative h-20 w-20 flex-shrink-0 rounded-2xl p-[3px] transition-opacity', selectedImage === index ? 'opacity-100' : 'opacity-60 hover:opacity-100')}
                  >
                    {selectedImage === index && (
                      <m.span layoutId="thumb-ring" className="absolute inset-0 rounded-2xl border-2 border-brand" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />
                    )}
                    <img loading="lazy" decoding="async" src={image} alt={`${product.name} ${index + 1}`} className="h-full w-full rounded-xl object-cover" />
                  </button>
                ))}
              </div>
            )}
          </m.div>

          {/* Product Info */}
          <m.div
            initial={reduce ? false : 'hidden'}
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.15 } } }}
            className="space-y-5"
          >
            {/* Title with wishlist */}
            <m.div variants={infoItem} className="flex items-start justify-between gap-4">
              <h1 className="text-2xl font-semibold leading-tight tracking-[-0.02em] text-ink md:text-[34px]">
                {product.name}
              </h1>
              <m.button
                type="button"
                whileTap={{ scale: 0.8 }}
                onClick={handleToggleWishlist}
                className={cn('grid h-11 w-11 flex-shrink-0 place-items-center rounded-full border transition-colors', isInWishlist ? 'border-brand/30 bg-brand-blush text-brand' : 'border-line text-ink-muted hover:border-brand/30 hover:text-brand')}
              >
                <m.span key={String(isInWishlist)} initial={isInWishlist && !reduce ? { scale: 0.3 } : false} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 12 }}>
                  <Heart className={cn('h-5 w-5', isInWishlist && 'fill-current')} />
                </m.span>
              </m.button>
            </m.div>

            {/* SKU */}
            <m.p variants={infoItem} className="text-sm text-ink-muted">
              <span className="font-medium">SKU:</span> {product.id.slice(0, 8).toUpperCase()}
            </m.p>

            {/* Price Section */}
            <m.div variants={infoItem} className="flex flex-wrap items-center gap-3 rounded-2xl bg-gradient-to-r from-brand-blush to-surface-warm px-5 py-4">
              <span className="text-sm font-medium text-ink-muted">PRICE:</span>
              <AnimatePresence mode="popLayout" initial={false}>
                <m.span key={displayPrice} initial={{ y: -14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 14, opacity: 0 }} className="text-[28px] font-bold text-brand">
                  {formatPrice(displayPrice)}
                </m.span>
              </AnimatePresence>
              {displayOriginalPrice && (
                <>
                  <span className="text-lg text-ink-muted line-through">
                    {formatPrice(displayOriginalPrice)}
                  </span>
                  <span className="rounded-full bg-[#6B8E23] px-2.5 py-0.5 text-xs font-semibold text-white">
                    {discountAmount} ৳ off
                  </span>
                </>
              )}
            </m.div>

            {/* Variation Selector */}
            {hasVariations && (
              <m.div variants={infoItem} className="space-y-3">
                <p className="text-sm text-ink-muted">
                  সাইজ নির্বাচন করুন: <span className="font-semibold text-ink">{selectedVariation?.name || ''}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {product.variations!.map((variation) => {
                    const selected = selectedVariation?.id === variation.id;
                    return (
                      <m.button
                        key={variation.id}
                        type="button"
                        whileTap={{ scale: 0.94 }}
                        onClick={() => setSelectedVariation(variation)}
                        className={cn('relative min-w-[64px] rounded-full border px-4 py-2.5 text-sm font-medium transition-colors', selected ? 'border-brand text-white' : 'border-line bg-white text-ink hover:border-brand')}
                      >
                        {selected && <m.span layoutId="pdp-variation" className="absolute inset-0 rounded-full bg-brand shadow-[0_8px_18px_-6px_rgba(117,20,47,0.5)]" transition={{ type: 'spring', stiffness: 450, damping: 32 }} />}
                        <span className="relative">{variation.name}</span>
                      </m.button>
                    );
                  })}
                </div>
              </m.div>
            )}

            {/* Stock Status */}
            <m.div variants={infoItem} className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-ink-muted">STATUS:</span>
                <span className={cn('inline-flex items-center gap-1.5 font-bold', currentStock > 0 ? 'text-[#6B8E23]' : 'text-destructive')}>
                  <span className={cn('h-2 w-2 rounded-full', currentStock > 0 ? 'animate-pulse bg-[#6B8E23]' : 'bg-destructive')} />
                  {currentStock > 0 ? 'In Stock' : 'Out of Stock'}
                </span>
              </div>
              {/* Happy Customers Badge */}
              <div className="flex items-center gap-2 text-sm text-ink-muted">
                <CheckCircle2 className="h-5 w-5 text-[#6B8E23]" />
                <span className="font-medium">14,360+ Happy Customers</span>
              </div>
            </m.div>

            {/* Short Description */}
            {product.short_description && (
              <m.p variants={infoItem} className="whitespace-pre-line leading-relaxed text-ink-soft">
                {product.short_description}
              </m.p>
            )}

            {/* Action Buttons */}
            <m.div variants={infoItem} ref={actionsRef} className="grid grid-cols-2 gap-3 pt-2">
              <m.button
                type="button"
                whileHover={reduce ? undefined : { y: -2 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-full border-2 border-brand bg-white font-semibold text-brand transition-colors hover:bg-brand-blush disabled:opacity-50"
                onClick={handleAddToCart}
                disabled={currentStock === 0}
              >
                <ShoppingBag className="h-4 w-4" />
                Add to Cart
              </m.button>
              <m.button
                type="button"
                whileHover={reduce ? undefined : { y: -2 }}
                whileTap={{ scale: 0.97 }}
                className="shine-sweep relative inline-flex h-[52px] w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-brand font-semibold text-white shadow-cta transition-colors hover:bg-brand-deep disabled:opacity-50"
                onClick={handleBuyNow}
                disabled={currentStock === 0}
              >
                <Zap className="h-4 w-4" />
                Buy Now
              </m.button>
            </m.div>

            {/* Call Now Button */}
            {socialSettings?.call_enabled && socialSettings?.call_number && (
              <m.button
                variants={infoItem}
                type="button"
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#6B8E23] font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[#556B2F]"
                onClick={handleCallNow}
              >
                <Phone className="h-4 w-4" />
                Call Now: {socialSettings.call_number}
              </m.button>
            )}

            {/* Messenger Button */}
            {socialSettings?.messenger_enabled && socialSettings?.messenger_page_id && (
              <m.button
                variants={infoItem}
                type="button"
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-line bg-white font-semibold text-ink transition-all hover:-translate-y-0.5 hover:border-[#0084FF]/40"
                onClick={handleMessenger}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-[#0084FF]">
                  <path d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.19 5.44 3.14 7.17.16.13.26.35.27.57l.05 1.78c.02.59.61.98 1.17.78l1.99-.8c.17-.07.36-.08.53-.04.9.24 1.87.37 2.85.37 5.64 0 10-4.13 10-9.7C22 6.13 17.64 2 12 2zm5.89 7.65l-2.83 4.47c-.44.7-1.36.89-2.03.42l-2.25-1.68c-.2-.15-.47-.15-.66 0l-3.04 2.3c-.4.31-.94-.15-.67-.58l2.83-4.47c.44-.7 1.36-.89 2.03-.42l2.25 1.68c.2.15.47.15.66 0l3.04-2.3c.4-.31.94.15.67.58z"/>
                </svg>
                ম্যাসেঞ্জার অর্ডার
              </m.button>
            )}

            {/* Trust strip — same promises as the home page */}
            <m.div variants={infoItem} className="grid grid-cols-3 gap-2 border-t border-line pt-5 text-center text-[11px] text-ink-muted sm:text-xs">
              {[
                { icon: Truck, title: 'সারা দেশে ডেলিভারি' },
                { icon: RotateCcw, title: 'সহজ এক্সচেঞ্জ' },
                { icon: ShieldCheck, title: 'মানের নিশ্চয়তা' },
              ].map(({ icon: Icon, title }) => (
                <div key={title} className="flex flex-col items-center gap-1.5">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-blush text-brand"><Icon className="h-4 w-4" /></span>
                  {title}
                </div>
              ))}
            </m.div>
          </m.div>
        </div>

        {/* Product Description - Only show if long_description exists */}
        {product.long_description && (
          <Reveal className="mt-14">
            <div className="border-b border-line">
              <span className="relative inline-block px-1 pb-3 text-base font-semibold text-brand">
                পন্যের বিবরণ
                <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand" />
              </span>
            </div>
            <div className="mt-6 rounded-3xl border border-line bg-white p-6 shadow-sm sm:p-8">
              <div className="prose prose-sm max-w-none whitespace-pre-line leading-7 text-ink-soft">
                {product.long_description}
              </div>
            </div>
          </Reveal>
        )}

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <section className="mt-16 border-t border-line pt-14">
            <Reveal>
              <p className="eyebrow">YOU MAY ALSO LIKE</p>
              <h2 className="mb-8 mt-1.5 text-2xl font-semibold text-ink sm:text-[28px]">Related Products</h2>
            </Reveal>
            <Stagger className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-4 md:gap-6">
              {relatedProducts.map((relatedProduct, index) => (
                <StaggerItem key={relatedProduct.id}>
                  <ProductCard product={relatedProduct} index={index} />
                </StaggerItem>
              ))}
            </Stagger>
          </section>
        )}
      </div>

      {/* Sticky buy bar — phones only */}
      <AnimatePresence>
        {showStickyBar && (
          <m.div
            initial={{ y: '120%' }}
            animate={{ y: 0 }}
            exit={{ y: '120%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 32 }}
            className="fixed inset-x-0 bottom-16 z-30 border-t border-line bg-surface-paper/95 px-4 py-3 shadow-[0_-10px_30px_-12px_rgba(74,30,40,0.25)] backdrop-blur-xl md:hidden"
          >
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-ink-muted">{product.name}</p>
                <p className="text-lg font-bold text-brand">{formatPrice(displayPrice)}</p>
              </div>
              <button type="button" onClick={handleAddToCart} disabled={currentStock === 0} aria-label="Add to Cart" className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-brand text-brand disabled:opacity-50">
                <ShoppingBag className="h-4 w-4" />
              </button>
              <button type="button" onClick={handleBuyNow} disabled={currentStock === 0} className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-brand px-5 text-sm font-semibold text-white shadow-cta disabled:opacity-50">
                <Zap className="h-4 w-4" />
                Buy Now
              </button>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {/* Fullscreen gallery */}
      <AnimatePresence>
        {lightbox && (
          <m.div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/95" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button type="button" aria-label="Close" onClick={() => setLightbox(false)} className="absolute right-4 top-4 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20">
              <X className="h-5 w-5" />
            </button>
            <m.img
              key={selectedImage}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, ease: EASE_OUT }}
              src={product.images[selectedImage]}
              alt={product.name}
              onPanEnd={onImagePan}
              style={{ touchAction: 'pinch-zoom' }}
              className="max-h-[88vh] max-w-[94vw] object-contain"
            />
            {imageCount > 1 && (
              <>
                <button type="button" onClick={() => showImage(selectedImage - 1)} className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"><ChevronLeft className="h-5 w-5" /></button>
                <button type="button" onClick={() => showImage(selectedImage + 1)} className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"><ChevronRight className="h-5 w-5" /></button>
                <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-sm text-white/70">{selectedImage + 1} / {imageCount}</p>
              </>
            )}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProductDetailPage;
