import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { Heart, ShoppingBag, Star, Eye, Zap } from 'lucide-react';
import { Product, ProductVariation } from '@/types';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { addToCart, openCart } from '@/store/slices/cartSlice';
import { toggleWishlist, selectWishlistItems } from '@/store/slices/wishlistSlice';
import { toast } from 'sonner';
import { useFacebookPixel } from '@/hooks/useFacebookPixel';
import { useServerTracking } from '@/hooks/useServerTracking';
import { TiltCard, EASE_OUT } from '@/components/motion';
import { cn } from '@/lib/utils';

interface ProductCardProps {
  product: Product;
  index?: number;
  /** Cycle through the product's photos inside the card. */
  slideImages?: boolean;
}

const ProductCard = ({ product, index = 0, slideImages = false }: ProductCardProps) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const wishlistItems = useAppSelector(selectWishlistItems);
  const { trackAddToCartWithEventId, generateEventId } = useFacebookPixel();
  const { trackAddToCart: trackServerAddToCart } = useServerTracking();
  const isInWishlist = wishlistItems.some((item) => item.id === product.id);
  const [burst, setBurst] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);

  // State for selected variation - no auto-select, customer must choose manually
  const hasVariations = product.variations && product.variations.length > 0;
  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | undefined>(undefined);

  // Sold out when the selected variation (or, with no variations, the product) has no
  // stock. Nothing downstream checks this — place-order deducts but does not refuse —
  // so the UI must not offer an item it cannot fulfil.
  const activeStock = selectedVariation?.stock ?? product.stock;
  const isSoldOut = typeof activeStock === 'number' && activeStock <= 0;


  // Get display price based on variation or base price
  const displayPrice = selectedVariation?.price ?? product.price;
  const displayOriginalPrice = selectedVariation?.original_price ?? product.originalPrice;
  const discount = product.discount
    || (displayOriginalPrice && displayOriginalPrice > displayPrice ? Math.round(((displayOriginalPrice - displayPrice) * 100) / displayOriginalPrice) : 0);

  const primaryImage = !imageFailed && product.images?.[0];
  const hoverImage = product.images?.[1];

  // Photo slideshow (opt-in per section): step to the next photo every 3s, and on
  // reaching the last one walk back to the first, then forward again.
  const imageCount = product.images?.length || 0;
  const slideshow = slideImages && imageCount > 1;
  const [slide, setSlide] = useState(0);
  const slideDirection = useRef<1 | -1>(1);
  useEffect(() => {
    if (!slideshow || reduce) return;
    const timer = window.setInterval(() => {
      setSlide((current) => {
        if (current >= imageCount - 1) slideDirection.current = -1;
        else if (current <= 0) slideDirection.current = 1;
        return current + slideDirection.current;
      });
    }, 3000);
    return () => window.clearInterval(timer);
  }, [slideshow, reduce, imageCount]);

  const formatPrice = (price: number) => {
    return `৳${price.toLocaleString('en-BD')}`;
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // If product has variations but none selected, show error
    if (hasVariations && !selectedVariation) {
      toast.error('সাইজ সিলেক্ট করুন');
      return;
    }
    if (isSoldOut) {
      toast.error('এই পণ্যটি স্টকে নেই');
      return;
    }


    dispatch(addToCart({ product, variation: selectedVariation }));
    dispatch(openCart());

    // Track AddToCart event - both browser pixel and server CAPI
    const eventId = generateEventId('AddToCart');
    console.log('Firing AddToCart from ProductCard:', product.name, 'eventId:', eventId);

    // Browser pixel
    trackAddToCartWithEventId({
      content_ids: [product.id],
      content_name: product.name,
      content_type: 'product',
      value: displayPrice,
      currency: 'BDT',
    }, eventId);

    // Server-side CAPI (runs in parallel)
    trackServerAddToCart({
      contentId: product.id,
      contentName: product.name,
      value: displayPrice,
      quantity: 1,
      currency: 'BDT',
    });

    toast.success('Added to cart!');
  };

  const handleBuyNow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // If product has variations but none selected, show error
    if (hasVariations && !selectedVariation) {
      toast.error('সাইজ সিলেক্ট করুন');
      return;
    }
    if (isSoldOut) {
      toast.error('এই পণ্যটি স্টকে নেই');
      return;
    }


    // Add to cart and navigate to checkout
    dispatch(addToCart({ product, variation: selectedVariation }));

    // Track AddToCart event - both browser pixel and server CAPI
    const eventId = generateEventId('AddToCart');
    console.log('Firing AddToCart (Buy Now) from ProductCard:', product.name, 'eventId:', eventId);

    // Browser pixel
    trackAddToCartWithEventId({
      content_ids: [product.id],
      content_name: product.name,
      content_type: 'product',
      value: displayPrice,
      currency: 'BDT',
    }, eventId);

    // Server-side CAPI (runs in parallel)
    trackServerAddToCart({
      contentId: product.id,
      contentName: product.name,
      value: displayPrice,
      quantity: 1,
      currency: 'BDT',
    });

    navigate('/checkout');
  };

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isInWishlist) setBurst((value) => value + 1);
    dispatch(toggleWishlist(product));
    toast.success(isInWishlist ? 'Removed from wishlist' : 'Added to wishlist!');
  };

  const handleVariationClick = (e: React.MouseEvent, variation: ProductVariation) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedVariation(variation);
  };

  return (
    <m.div
      initial={reduce ? false : { opacity: 0, y: 30, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.15 }}
      // Delay cycles across a row instead of growing with the list, so item 20
      // does not wait two seconds to appear.
      transition={{ duration: 0.6, delay: (index % 5) * 0.07, ease: EASE_OUT }}
      className="h-full"
    >
      <TiltCard max={4} className="h-full">
        <Link to={`/product/${product.slug}`} className="group flex h-full flex-col">
          {/* Image */}
          <div className="relative aspect-[0.77] overflow-hidden rounded-2xl bg-surface-sand shadow-[0_4px_14px_-6px_rgba(74,46,39,0.12)] transition-shadow duration-500 group-hover:shadow-[0_22px_40px_-18px_rgba(110,25,50,0.45)]">
            {primaryImage && slideshow ? (
              // Photo track: slides one photo every few seconds, forward then back.
              <div
                className="flex h-full w-full transition-transform duration-700 ease-out"
                style={{ transform: `translateX(-${slide * 100}%)` }}
              >
                {product.images.map((image, imageIndex) => (
                  <img
                    key={image + imageIndex}
                    src={image}
                    alt={imageIndex === 0 ? product.name : ''}
                    aria-hidden={imageIndex === 0 ? undefined : true}
                    className="h-full w-full shrink-0 object-cover"
                    loading="lazy"
                    onError={imageIndex === 0 ? () => setImageFailed(true) : undefined}
                  />
                ))}
              </div>
            ) : primaryImage ? (
              <>
                <img
                  src={primaryImage}
                  alt={product.name}
                  className={cn('h-full w-full object-cover transition-all duration-700 ease-out group-hover:scale-[1.06]', hoverImage && 'sm:group-hover:opacity-0')}
                  loading="lazy"
                  onError={() => setImageFailed(true)}
                />
                {hoverImage && (
                  <img
                    src={hoverImage}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 hidden h-full w-full scale-[1.06] object-cover opacity-0 transition-all duration-700 ease-out group-hover:scale-100 group-hover:opacity-100 sm:block"
                    loading="lazy"
                    onError={(event) => { event.currentTarget.style.display = 'none'; }}
                  />
                )}
              </>
            ) : (
              <div className="grid h-full place-items-center bg-gradient-to-br from-brand-blush to-surface-sand px-5 text-center text-sm font-semibold text-brand-soft">
                {product.name}
              </div>
            )}

            {/* Badges */}
            <div className="absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
              {discount > 0 && (
                <span className="shine-sweep relative overflow-hidden rounded-full bg-brand px-2.5 py-1 text-[10px] font-bold text-white shadow-md">-{discount}%</span>
              )}
              {product.isNew && (
                <span className="rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold text-brand shadow-sm">নতুন</span>
              )}
              {isSoldOut && (
                <span className="rounded-full bg-ink/80 px-2.5 py-1 text-[10px] font-bold text-white">স্টক নেই</span>
              )}
            </div>

            {/* Quick actions */}
            <div className="absolute right-2.5 top-2.5 flex flex-col gap-2">
              <button
                type="button"
                aria-label="উইশলিস্টে যোগ করুন"
                onClick={handleToggleWishlist}
                className={cn(
                  'relative grid h-9 w-9 place-items-center rounded-full bg-white/95 text-brand shadow-md backdrop-blur transition-all duration-300 hover:scale-110',
                  !isInWishlist && 'sm:translate-x-3 sm:opacity-0 sm:group-hover:translate-x-0 sm:group-hover:opacity-100',
                )}
              >
                <m.span key={burst} initial={burst && !reduce ? { scale: 0.4 } : false} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 12 }}>
                  <Heart className={cn('h-4 w-4', isInWishlist && 'fill-current')} />
                </m.span>
                <AnimatePresence>
                  {burst > 0 && !reduce && (
                    <m.span
                      key={'ring' + burst}
                      initial={{ scale: 0.6, opacity: 0.7 }}
                      animate={{ scale: 2, opacity: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      className="pointer-events-none absolute inset-0 rounded-full border-2 border-brand"
                    />
                  )}
                </AnimatePresence>
              </button>
              <span
                role="presentation"
                className="hidden h-9 w-9 translate-x-3 place-items-center rounded-full bg-white/95 text-ink-soft opacity-0 shadow-md transition-all delay-75 duration-300 group-hover:translate-x-0 group-hover:opacity-100 sm:grid"
              >
                <Eye className="h-4 w-4" />
              </span>
            </div>

            {/* Add to Cart / Buy Now — always visible on phones, slides up on hover on desktop */}
            {!hasVariations && (
              <div className="absolute inset-x-2 bottom-2 flex gap-1.5 transition-all duration-500 ease-out sm:translate-y-[130%] sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={isSoldOut}
                  className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-full bg-white/95 text-[11px] font-bold text-brand shadow-md backdrop-blur transition-colors hover:bg-white disabled:opacity-60 sm:h-10 sm:text-xs"
                >
                  <ShoppingBag className="h-3.5 w-3.5" />
                  <span className="sm:hidden">কার্ট</span>
                  <span className="hidden sm:inline">{isSoldOut ? 'স্টক নেই' : 'কার্টে যোগ করুন'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleBuyNow}
                  disabled={isSoldOut}
                  className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-full bg-brand text-[11px] font-bold text-white shadow-[0_8px_18px_rgba(117,20,47,0.3)] transition-colors hover:bg-brand-deep disabled:opacity-60 sm:h-10 sm:text-xs"
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span className="sm:hidden">কিনুন</span>
                  <span className="hidden sm:inline">এখনই কিনুন</span>
                </button>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex flex-1 flex-col px-1 pt-3">
            {product.category && (
              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">{product.category}</p>
            )}

            <h3 className="line-clamp-2 text-[13px] font-semibold leading-snug text-ink transition-colors group-hover:text-brand sm:text-sm">
              {product.name}
            </h3>

            <div className="mt-1 flex items-center gap-1">
              <div className="flex text-gold">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className={cn('h-3 w-3', i < Math.floor(product.rating || 0) ? 'fill-current' : 'text-ink-muted/30')} />
                ))}
              </div>
              <span className="text-[10px] text-ink-muted">({product.reviewCount || 0})</span>
            </div>

            {/* Variations Selector - Compact Size Display */}
            {hasVariations && (
              <div className="mt-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="shrink-0 text-[11px] font-medium text-ink-muted">Size:</span>
                  {product.variations!.map((variation) => {
                    // Extract just the number from the size name (e.g., "Size 36" -> "36")
                    const sizeNumber = variation.name.replace(/[^0-9]/g, '') || variation.name;
                    const selected = selectedVariation?.id === variation.id;
                    return (
                      <button
                        key={variation.id}
                        type="button"
                        onClick={(e) => handleVariationClick(e, variation)}
                        className={cn('relative h-7 min-w-[30px] rounded-lg border px-1.5 text-xs font-semibold transition-colors', selected ? 'border-brand text-white' : 'border-line bg-white text-ink hover:border-brand')}
                        title={variation.name}
                      >
                        {selected && (
                          <m.span layoutId={'size-' + product.id} className="absolute inset-0 rounded-[7px] bg-brand" transition={{ type: 'spring', stiffness: 500, damping: 34 }} />
                        )}
                        <span className="relative">{sizeNumber}</span>
                      </button>
                    );
                  })}
                </div>
                {/* Free Delivery Badge */}
                {selectedVariation && (selectedVariation.name.toLowerCase().includes('5kg') ||
                  selectedVariation.name.includes('৫কেজি') ||
                  selectedVariation.name === '5 KG') && (
                  <p className="mt-1 text-xs font-medium text-emerald-600">🚚 ফ্রি ডেলিভারি</p>
                )}
              </div>
            )}

            {/* Price */}
            <div className="mt-1.5 flex items-baseline gap-2">
              <AnimatePresence mode="popLayout" initial={false}>
                <m.strong
                  key={displayPrice}
                  initial={{ y: -10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 10, opacity: 0 }}
                  className="text-[15px] font-bold text-brand sm:text-base"
                >
                  {formatPrice(displayPrice)}
                </m.strong>
              </AnimatePresence>
              {displayOriginalPrice && displayOriginalPrice > displayPrice && (
                <span className="text-[11px] text-ink-muted line-through">{formatPrice(displayOriginalPrice)}</span>
              )}
            </div>

            {/* Add to Cart / Buy Now Buttons for products with variations */}
            {hasVariations && (
              <div className="relative z-10 mt-3 flex gap-2">
                <button
                  type="button"
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-brand/30 bg-white px-2 py-2.5 text-xs font-semibold text-brand transition-all hover:-translate-y-0.5 hover:border-brand hover:shadow-md disabled:opacity-60"
                  onClick={handleAddToCart}
                  disabled={isSoldOut}
                  title={isSoldOut ? 'স্টকে নেই' : 'কার্টে যোগ করুন'}
                >
                  <ShoppingBag className="h-4 w-4 shrink-0" />
                  <span>কার্ট</span>
                </button>
                <button
                  type="button"
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brand px-2 py-2.5 text-xs font-semibold text-white shadow-[0_8px_18px_-6px_rgba(117,20,47,0.5)] transition-all hover:-translate-y-0.5 hover:bg-brand-deep disabled:opacity-60"
                  onClick={handleBuyNow}
                  disabled={isSoldOut}
                  title={isSoldOut ? 'স্টকে নেই' : 'এখনই কিনুন'}
                >
                  <Zap className="h-4 w-4 shrink-0" />
                  <span>কিনুন</span>
                </button>
              </div>
            )}
          </div>
        </Link>
      </TiltCard>
    </m.div>
  );
};

/** Matching placeholder while products load. */
export const ProductCardSkeleton = () => (
  <div>
    <div className="skeleton-shimmer aspect-[0.77] rounded-2xl" />
    <div className="skeleton-shimmer mt-3 h-3 w-3/4 rounded" />
    <div className="skeleton-shimmer mt-2 h-3 w-1/2 rounded" />
  </div>
);

export default ProductCard;
