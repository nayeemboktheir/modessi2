import { Link } from 'react-router-dom';
import { AnimatePresence, m } from 'framer-motion';
import { Trash2, ArrowLeft, ArrowRight, ShoppingBag, Truck } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import {
  selectCartItems,
  selectCartTotal,
  removeFromCart,
  updateQuantity,
  clearCart
} from '@/store/slices/cartSlice';
import { toast } from 'sonner';
import { QuantityStepper } from '@/components/cart/QuantityStepper';
import { CountUp, Reveal } from '@/components/motion';

const FREE_SHIPPING_AT = 2000;

const CartPage = () => {
  const cartItems = useAppSelector(selectCartItems);
  const total = useAppSelector(selectCartTotal);
  const dispatch = useAppDispatch();

  const formatPrice = (price: number) => `৳${price.toLocaleString('en-BD')}`;
  const money = (value: number) => formatPrice(Math.round(value));

  const shippingCost = total >= FREE_SHIPPING_AT ? 0 : 100;
  const grandTotal = total + shippingCost;

  const handleRemove = (productId: string, variationId?: string) => {
    dispatch(removeFromCart({ productId, variationId }));
    toast.success('Item removed from cart');
  };

  return (
    <div className="min-h-screen bg-surface pb-16">
      <section className="border-b border-line bg-gradient-to-br from-brand-blush via-surface-warm to-surface">
        <div className="shell py-10 sm:py-12">
          <m.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-3xl font-semibold tracking-[-0.025em] text-ink md:text-[40px]">
            শপিং কার্ট
          </m.h1>
          <m.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="mt-2 text-ink-muted">
            আপনার কার্টে {cartItems.length}টি পণ্য আছে
          </m.p>
        </div>
      </section>

      <div className="shell mt-8">
        {cartItems.length === 0 ? (
          <m.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="py-16 text-center">
            <div className="relative mx-auto mb-6 h-28 w-28">
              <span className="absolute inset-0 animate-ping rounded-full bg-brand-blush opacity-60" style={{ animationDuration: '2.4s' }} />
              <span className="relative grid h-28 w-28 place-items-center rounded-full bg-brand-blush">
                <ShoppingBag className="h-12 w-12 animate-float text-brand-soft" />
              </span>
            </div>
            <h2 className="mb-2 text-xl font-semibold text-ink">
              আপনার কার্ট খালি
            </h2>
            <p className="mb-6 text-ink-muted">
              এখনও কোনো পণ্য যোগ করেননি
            </p>
            <Link to="/products" className="group inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white shadow-cta transition-colors hover:bg-brand-deep">
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              কেনাকাটা করুন
            </Link>
          </m.div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Cart Items */}
            <div className="space-y-3 lg:col-span-2">
              <AnimatePresence initial={false}>
                {cartItems.map((item, index) => {
                  const itemKey = item.variation?.id ? `${item.product.id}-${item.variation.id}` : item.product.id;
                  const displayPrice = item.variation?.price ?? item.product.price;
                  const originalPrice = item.variation?.original_price ?? item.product.originalPrice;

                  return (
                    <m.div
                      key={itemKey}
                      layout
                      initial={{ opacity: 0, y: 24 }}
                      animate={{ opacity: 1, y: 0, transition: { delay: Math.min(index, 6) * 0.08 } }}
                      exit={{ opacity: 0, x: -160, transition: { duration: 0.3 } }}
                      className="group flex gap-4 rounded-3xl border border-line bg-white p-4 shadow-sm transition-shadow hover:shadow-[0_18px_40px_-24px_rgba(110,25,50,0.4)]"
                    >
                      <Link to={`/product/${item.product.slug}`} className="shrink-0 overflow-hidden rounded-2xl">
                        <img
                          loading="lazy"
                          decoding="async"
                          src={item.product.images[0]}
                          alt={item.product.name}
                          className="h-28 w-24 object-cover transition-transform duration-500 group-hover:scale-105 md:h-36 md:w-32"
                        />
                      </Link>
                      <div className="min-w-0 flex-1">
                        <Link to={`/product/${item.product.slug}`}>
                          <h3 className="line-clamp-2 font-medium text-ink transition-colors hover:text-brand">
                            {item.product.name}
                          </h3>
                        </Link>
                        {item.variation && (
                          <p className="mt-0.5 text-sm font-medium text-brand">
                            {item.variation.name}
                          </p>
                        )}
                        <p className="mt-1 text-sm text-ink-muted">
                          {item.product.category}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-lg font-bold text-brand">
                            {formatPrice(displayPrice)}
                          </span>
                          {originalPrice && (
                            <span className="text-sm text-ink-muted line-through">
                              {formatPrice(originalPrice)}
                            </span>
                          )}
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                          <QuantityStepper
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

                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-ink">
                              {formatPrice(displayPrice * item.quantity)}
                            </span>
                            <button
                              type="button"
                              aria-label="Remove"
                              onClick={() => handleRemove(item.product.id, item.variation?.id)}
                              className="grid h-9 w-9 place-items-center rounded-full text-ink-muted transition-colors hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </m.div>
                  );
                })}
              </AnimatePresence>

              <div className="flex justify-between pt-4">
                <Link to="/products" className="group inline-flex items-center gap-2 rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold text-ink-soft transition-colors hover:border-brand/40 hover:text-brand">
                  <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                  Continue Shopping
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    dispatch(clearCart());
                    toast.success('Cart cleared');
                  }}
                  className="rounded-full px-4 py-2.5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/5"
                >
                  Clear Cart
                </button>
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <Reveal direction="left" className="sticky top-24 rounded-3xl border border-line bg-white p-6 shadow-[0_24px_50px_-30px_rgba(74,30,40,0.4)]">
                <h2 className="mb-6 text-xl font-semibold text-ink">
                  Order Summary
                </h2>

                <div className="space-y-4 border-b border-line pb-6">
                  <div className="flex justify-between text-ink-muted">
                    <span>Subtotal ({cartItems.length} items)</span>
                    <CountUp value={total} format={money} />
                  </div>
                  <div className="flex justify-between text-ink-muted">
                    <span>Shipping</span>
                    <span>{shippingCost === 0 ? 'Free' : formatPrice(shippingCost)}</span>
                  </div>
                  <div>
                    {shippingCost > 0 && (
                      <p className="mb-2 flex items-center gap-1.5 text-sm text-brand">
                        <Truck className="h-4 w-4" />
                        Add {formatPrice(FREE_SHIPPING_AT - total)} more for free shipping!
                      </p>
                    )}
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-sand">
                      <m.div
                        className="h-full rounded-full bg-gradient-to-r from-brand to-gold"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (total / FREE_SHIPPING_AT) * 100)}%` }}
                        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-between py-6 text-lg font-bold text-ink">
                  <span>Total</span>
                  <CountUp value={grandTotal} format={money} className="text-brand" />
                </div>

                <Link to="/checkout" className="shine-sweep group relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-brand font-semibold text-white shadow-cta transition-colors hover:bg-brand-deep">
                  Proceed to Checkout
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Link>

                <p className="mt-4 text-center text-xs text-ink-muted">
                  Taxes and shipping calculated at checkout
                </p>
              </Reveal>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CartPage;
