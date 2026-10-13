import { useEffect } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { X, ShoppingBag, ArrowRight, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import {
  selectCartItems,
  selectCartTotal,
  selectIsCartOpen,
  closeCart,
  removeFromCart,
  updateQuantity
} from '@/store/slices/cartSlice';
import { CountUp } from '@/components/motion';
import { QuantityStepper } from './QuantityStepper';

const CartDrawer = () => {
  const items = useAppSelector(selectCartItems);
  const total = useAppSelector(selectCartTotal);
  const isOpen = useAppSelector(selectIsCartOpen);
  const dispatch = useAppDispatch();

  const formatPrice = (price: number) => {
    return `৳${price.toLocaleString('en-BD')}`;
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') dispatch(closeCart()); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, dispatch]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-ink/50 backdrop-blur-sm"
            onClick={() => dispatch(closeCart())}
          />

          {/* Drawer */}
          <m.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 300 }}
            className="fixed right-0 top-0 z-[70] flex h-full w-full max-w-md flex-col bg-surface-paper shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-line px-6 py-5">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-blush text-brand">
                  <ShoppingBag className="h-5 w-5" />
                </span>
                <h2 className="text-xl font-semibold text-ink">Your Cart</h2>
                <m.span key={items.length} initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 15 }} className="rounded-full bg-brand px-2 py-0.5 text-sm text-white">
                  {items.length}
                </m.span>
              </div>
              <m.button type="button" whileHover={{ rotate: 90 }} transition={{ duration: 0.2 }} onClick={() => dispatch(closeCart())} className="grid h-10 w-10 place-items-center rounded-full text-ink-soft hover:bg-surface-warm">
                <X className="h-5 w-5" />
              </m.button>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-5">
              {items.length === 0 ? (
                <m.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="flex h-full flex-col items-center justify-center text-center">
                  <div className="relative mb-6">
                    <span className="absolute inset-0 animate-ping rounded-full bg-brand-blush opacity-60" style={{ animationDuration: '2.4s' }} />
                    <span className="relative grid h-24 w-24 place-items-center rounded-full bg-brand-blush">
                      <ShoppingBag className="h-10 w-10 animate-float text-brand-soft" />
                    </span>
                  </div>
                  <h3 className="mb-2 text-lg font-medium text-ink">Your cart is empty</h3>
                  <p className="mb-6 text-ink-muted">
                    Start shopping to add items to your cart
                  </p>
                  <Link to="/products" onClick={() => dispatch(closeCart())} className="inline-flex rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white shadow-cta transition-colors hover:bg-brand-deep">
                    Browse Products
                  </Link>
                </m.div>
              ) : (
                <div className="space-y-3">
                  <AnimatePresence initial={false}>
                    {items.map((item, index) => {
                      const itemKey = item.variation?.id ? `${item.product.id}-${item.variation.id}` : item.product.id;
                      const displayPrice = item.variation?.price ?? item.product.price;

                      return (
                        <m.div
                          key={itemKey}
                          layout
                          initial={{ opacity: 0, x: 40 }}
                          animate={{ opacity: 1, x: 0, transition: { delay: Math.min(index, 6) * 0.05 } }}
                          exit={{ opacity: 0, x: -120, height: 0, marginTop: 0, paddingTop: 0, paddingBottom: 0, transition: { duration: 0.3 } }}
                          className="flex gap-4 rounded-2xl border border-line bg-white p-3 shadow-sm"
                        >
                          <img
                            loading="lazy"
                            decoding="async"
                            src={item.product.images[0]}
                            alt={item.product.name}
                            className="h-24 w-20 rounded-xl object-cover"
                          />
                          <div className="min-w-0 flex-1">
                            <h4 className="truncate font-medium text-ink">
                              {item.product.name}
                            </h4>
                            {item.variation && (
                              <p className="text-sm text-ink-muted">
                                {item.variation.name}
                              </p>
                            )}
                            <p className="mt-1 font-semibold text-brand">
                              {formatPrice(displayPrice)}
                            </p>
                            <div className="mt-2">
                              <QuantityStepper
                                size="sm"
                                value={item.quantity}
                                onDecrease={() => dispatch(updateQuantity({
                                  productId: item.product.id,
                                  variationId: item.variation?.id,
                                  quantity: item.quantity - 1
                                }))}
                                onIncrease={() => dispatch(updateQuantity({
                                  productId: item.product.id,
                                  variationId: item.variation?.id,
                                  quantity: item.quantity + 1
                                }))}
                              />
                            </div>
                          </div>
                          <button
                            type="button"
                            aria-label="Remove"
                            className="grid h-9 w-9 shrink-0 place-items-center self-start rounded-full text-ink-muted transition-colors hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => dispatch(removeFromCart({ productId: item.product.id, variationId: item.variation?.id }))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </m.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <m.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }} className="pb-safe space-y-4 border-t border-line bg-white p-6">
                <div className="flex items-center justify-between text-lg">
                  <span className="text-ink-muted">Subtotal</span>
                  <CountUp value={total} format={(v) => formatPrice(Math.round(v))} className="font-bold text-ink" />
                </div>
                <p className="text-sm text-ink-muted">
                  Shipping and taxes calculated at checkout
                </p>
                <div className="space-y-2">
                  <Link
                    to="/checkout"
                    onClick={() => dispatch(closeCart())}
                    className="shine-sweep group relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-brand font-semibold text-white shadow-cta transition-colors hover:bg-brand-deep"
                  >
                    Proceed to Checkout
                    <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </Link>
                  <Link
                    to="/cart"
                    onClick={() => dispatch(closeCart())}
                    className="flex h-12 w-full items-center justify-center rounded-full border border-line font-semibold text-ink-soft transition-colors hover:border-brand/40 hover:text-brand"
                  >
                    View Cart
                  </Link>
                </div>
              </m.div>
            )}
          </m.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CartDrawer;
