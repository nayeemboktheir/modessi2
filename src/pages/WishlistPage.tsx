import { Link } from 'react-router-dom';
import { AnimatePresence, m } from 'framer-motion';
import { Trash2, Heart, ArrowLeft, ShoppingBag } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { selectWishlistItems, removeFromWishlist } from '@/store/slices/wishlistSlice';
import { addToCart, openCart } from '@/store/slices/cartSlice';
import { toast } from 'sonner';
import { TiltCard } from '@/components/motion';

const WishlistPage = () => {
  const wishlistItems = useAppSelector(selectWishlistItems);
  const dispatch = useAppDispatch();

  const formatPrice = (price: number) => `৳${price.toLocaleString('en-BD')}`;

  const handleAddToCart = (product: typeof wishlistItems[0]) => {
    dispatch(addToCart({ product }));
    dispatch(openCart());
    toast.success('Added to cart!');
  };

  const handleRemove = (productId: string) => {
    dispatch(removeFromWishlist(productId));
    toast.success('Removed from wishlist');
  };

  return (
    <div className="min-h-screen bg-surface pb-16">
      <section className="border-b border-line bg-gradient-to-br from-brand-blush via-surface-warm to-surface">
        <div className="shell flex items-end justify-between gap-4 py-10 sm:py-12">
          <div>
            <m.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-3xl font-semibold tracking-[-0.025em] text-ink md:text-[40px]">
              My Wishlist
            </m.h1>
            <m.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="mt-2 text-ink-muted">
              {wishlistItems.length} {wishlistItems.length === 1 ? 'item' : 'items'} saved
            </m.p>
          </div>
          <m.span initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.2 }} className="hidden h-14 w-14 place-items-center rounded-2xl bg-white text-brand shadow-sm sm:grid">
            <Heart className="h-6 w-6 fill-current" />
          </m.span>
        </div>
      </section>

      <div className="shell mt-8">
        {wishlistItems.length === 0 ? (
          <m.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="py-16 text-center">
            <div className="relative mx-auto mb-6 h-28 w-28">
              <span className="absolute inset-0 animate-ping rounded-full bg-brand-blush opacity-60" style={{ animationDuration: '2.4s' }} />
              <span className="relative grid h-28 w-28 place-items-center rounded-full bg-brand-blush">
                <Heart className="h-12 w-12 animate-float text-brand-soft" />
              </span>
            </div>
            <h2 className="mb-2 text-xl font-semibold text-ink">
              Your wishlist is empty
            </h2>
            <p className="mb-6 text-ink-muted">
              Start adding items you love to your wishlist
            </p>
            <Link to="/products" className="group inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white shadow-cta transition-colors hover:bg-brand-deep">
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              Browse Products
            </Link>
          </m.div>
        ) : (
          <m.div layout className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 md:gap-6 xl:grid-cols-4">
            <AnimatePresence mode="popLayout">
              {wishlistItems.map((product, index) => (
                <m.div
                  key={product.id}
                  layout
                  initial={{ opacity: 0, y: 30, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1, transition: { delay: Math.min(index, 8) * 0.06 } }}
                  exit={{ opacity: 0, scale: 0.8, rotate: -4, transition: { duration: 0.3 } }}
                >
                  <TiltCard max={4} className="group">
                    <Link to={`/product/${product.slug}`} className="relative block aspect-[0.77] overflow-hidden rounded-2xl bg-surface-sand shadow-[0_4px_14px_-6px_rgba(74,46,39,0.12)] transition-shadow duration-500 group-hover:shadow-[0_22px_40px_-18px_rgba(110,25,50,0.45)]">
                      <img
                        loading="lazy"
                        decoding="async"
                        src={product.images[0]}
                        alt={product.name}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
                      />
                      <button
                        type="button"
                        aria-label="Remove"
                        onClick={(event) => { event.preventDefault(); handleRemove(product.id); }}
                        className="absolute right-2.5 top-2.5 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-ink-muted shadow-md transition-all hover:scale-110 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </Link>
                  </TiltCard>
                  <div className="px-1 pt-3">
                    <Link to={`/product/${product.slug}`}>
                      <h3 className="line-clamp-2 text-[13px] font-semibold text-ink transition-colors hover:text-brand sm:text-sm">
                        {product.name}
                      </h3>
                    </Link>
                    <div className="mt-1.5 flex items-baseline gap-2">
                      <span className="text-base font-bold text-brand">
                        {formatPrice(product.price)}
                      </span>
                      {product.originalPrice && (
                        <span className="text-[11px] text-ink-muted line-through">
                          {formatPrice(product.originalPrice)}
                        </span>
                      )}
                    </div>
                    <m.button
                      type="button"
                      whileTap={{ scale: 0.96 }}
                      onClick={() => handleAddToCart(product)}
                      className="mt-3 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full bg-brand text-xs font-semibold text-white shadow-[0_8px_18px_-6px_rgba(117,20,47,0.5)] transition-all hover:-translate-y-0.5 hover:bg-brand-deep sm:text-sm"
                    >
                      <ShoppingBag className="h-4 w-4" />
                      Add to Cart
                    </m.button>
                  </div>
                </m.div>
              ))}
            </AnimatePresence>
          </m.div>
        )}
      </div>
    </div>
  );
};

export default WishlistPage;
