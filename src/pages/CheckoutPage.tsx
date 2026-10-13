import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { selectCartItems, selectCartTotal, clearCart, setCartItemVariation } from '@/store/slices/cartSlice';
import { useAuth } from '@/hooks/useAuth';
import { createOrder } from '@/services/orderService';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ShoppingBag, Truck, ArrowLeft, Loader2, CheckCircle, Banknote } from 'lucide-react';
import { AnimatePresence, m } from 'framer-motion';
import { CountUp, Reveal, Stagger, StaggerItem } from '@/components/motion';
import { ShippingMethodSelector, ShippingZone, SHIPPING_RATES } from '@/components/checkout/ShippingMethodSelector';
import { useFacebookPixel } from '@/hooks/useFacebookPixel';
import { useServerTracking } from '@/hooks/useServerTracking';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ProductVariation } from '@/types';

interface ShippingForm {
  name: string;
  phone: string;
  address: string;
}

// Generate or get session ID for tracking incomplete orders
const getSessionId = () => {
  let sessionId = localStorage.getItem('checkout_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('checkout_session_id', sessionId);
  }
  return sessionId;
};

// The draft's id is generated here rather than read back from the database:
// draft_orders carries other customers' PII, so anon has no SELECT policy on it.
// Keeping the id in localStorage is what lets a returning shopper keep updating the
// same draft instead of creating a new one on every visit.
// Rotated after a day so it always stays inside the window the RLS update policy
// allows; past that the row is read-only to anon and a stale id would just error.
const DRAFT_ID_TTL_MS = 24 * 60 * 60 * 1000;

const clearDraftOrderId = () => {
  localStorage.removeItem('checkout_draft_id');
  localStorage.removeItem('checkout_draft_id_at');
};

const getDraftOrderId = () => {
  const draftId = localStorage.getItem('checkout_draft_id');
  const createdAt = Number(localStorage.getItem('checkout_draft_id_at')) || 0;

  if (draftId && Date.now() - createdAt < DRAFT_ID_TTL_MS) {
    return draftId;
  }

  const freshId = crypto.randomUUID();
  localStorage.setItem('checkout_draft_id', freshId);
  localStorage.setItem('checkout_draft_id_at', String(Date.now()));
  return freshId;
};

const CheckoutPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user, isLoading: authLoading } = useAuth();
  const { isReady, setUserData } = useFacebookPixel();
  const { trackInitiateCheckout: trackServerCheckout } = useServerTracking();
  
  const cartItems = useAppSelector(selectCartItems);
  const cartTotal = useAppSelector(selectCartTotal);
  const hasTrackedCheckout = useRef(false);

  const [variationsByProductId, setVariationsByProductId] = useState<Record<string, ProductVariation[]>>({});
  const productIdsInCart = useMemo(
    () => Array.from(new Set(cartItems.map((i) => i.product.id))),
    [cartItems]
  );

  useEffect(() => {
    const loadVariations = async () => {
      if (productIdsInCart.length === 0) return;

      // Use already-available variations from cart items (if any)
      const preloaded: Record<string, ProductVariation[]> = {};
      for (const item of cartItems) {
        if (item.product.variations && item.product.variations.length > 0) {
          preloaded[item.product.id] = item.product.variations;
        }
      }

      try {
        const { data, error } = await supabase
          .from('product_variations')
          .select('id, product_id, name, price, original_price, stock, sort_order, is_active')
          .in('product_id', productIdsInCart)
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        if (error) throw error;

        const fetched: Record<string, ProductVariation[]> = {};
        (data || []).forEach((v: any) => {
          const pv: ProductVariation = {
            id: v.id,
            product_id: v.product_id,
            name: v.name,
            price: Number(v.price),
            original_price: v.original_price == null ? undefined : Number(v.original_price),
            stock: Number(v.stock),
            sort_order: Number(v.sort_order ?? 0),
            is_active: Boolean(v.is_active),
          };
          fetched[pv.product_id] = [...(fetched[pv.product_id] || []), pv];
        });

        setVariationsByProductId({ ...fetched, ...preloaded });
      } catch (e) {
        console.error('Failed to load variations for checkout:', e);
        setVariationsByProductId((prev) => ({ ...preloaded, ...prev }));
      }
    };

    loadVariations();
  }, [productIdsInCart, cartItems]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const draftOrderId = useRef<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [shippingZone, setShippingZone] = useState<ShippingZone>('outside_dhaka');

  const [shippingForm, setShippingForm] = useState<ShippingForm>({
    name: '',
    phone: '',
    address: '',
  });

  const shippingCost = SHIPPING_RATES[shippingZone];
  const total = cartTotal + shippingCost;

  // Load saved address if user is logged in
  useEffect(() => {
    const loadUserAddress = async () => {
      if (!user) return;
      
      const { data: addresses } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_default', true)
        .maybeSingle();
      
      if (addresses) {
        setShippingForm({
          name: addresses.name,
          phone: addresses.phone,
          address: `${addresses.street}, ${addresses.city}, ${addresses.district}`,
        });
      } else {
        // Load profile info if no default address
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, phone')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (profile) {
          setShippingForm(prev => ({
            ...prev,
            name: profile.full_name || '',
            phone: profile.phone || '',
          }));
        }
      }
    };
    
    loadUserAddress();
  }, [user]);

  // Redirect to cart if empty (only on initial load, not after order placed)
  const hasPlacedOrder = useRef(false);
  
  useEffect(() => {
    if (!authLoading && cartItems.length === 0 && !hasPlacedOrder.current) {
      navigate('/cart');
    }
  }, [cartItems, authLoading, navigate]);

  // Track InitiateCheckout event once (both client and server side with same event ID)
  // Also send user data if form is filled for better match quality
  useEffect(() => {
    if (isReady && cartItems.length > 0 && !hasTrackedCheckout.current) {
      console.log('Firing InitiateCheckout event (client + server) with shared event_id');
      
      const contentIds = cartItems.map(item => item.product.id);
      const numItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
      
      // Generate shared event ID for deduplication
      const eventId = `InitiateCheckout_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // Extract user data from form if available
      const nameParts = shippingForm.name.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      // Update client-side pixel with user data if available
      if (shippingForm.phone || firstName) {
        setUserData?.({
          phone: shippingForm.phone,
          firstName,
          lastName,
        });
      }
      
      // Client-side tracking with event ID
      if (window.fbq) {
        window.fbq('track', 'InitiateCheckout', {
          content_ids: contentIds,
          num_items: numItems,
          value: cartTotal,
          currency: 'BDT',
        }, { eventID: eventId });
      }
      
      // Server-side tracking via CAPI with same event ID and user data
      trackServerCheckout({
        contentIds,
        value: cartTotal,
        numItems,
        currency: 'BDT',
        eventId,
        userData: shippingForm.phone || firstName ? {
          phone: shippingForm.phone || undefined,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
        } : undefined,
      }).then(result => {
        console.log('[CAPI] InitiateCheckout result:', result);
      }).catch(err => {
        console.error('[CAPI] InitiateCheckout error:', err);
      });
      
      hasTrackedCheckout.current = true;
    }
  }, [isReady, cartItems, cartTotal, shippingForm, setUserData, trackServerCheckout]);

  // Track user data update when phone is entered (for better match quality)
  const hasTrackedPhoneUpdate = useRef(false);
  useEffect(() => {
    // Only track once when phone is filled with a valid number
    if (!hasTrackedPhoneUpdate.current && 
        shippingForm.phone && 
        /^(\+?880)?01[3-9]\d{8}$/.test(shippingForm.phone.replace(/\s/g, '')) &&
        cartItems.length > 0) {
      
      const nameParts = shippingForm.name.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      // Update client-side pixel with user data
      setUserData?.({
        phone: shippingForm.phone,
        firstName,
        lastName,
      });
      
      console.log('Updated Facebook Pixel with user data for better matching');
      hasTrackedPhoneUpdate.current = true;
    }
  }, [shippingForm.phone, shippingForm.name, cartItems.length, setUserData]);

  // Save draft order when form changes
  const saveDraftOrder = useCallback(async () => {
    if (cartItems.length === 0) return;
    
    const sessionId = getSessionId();
    const addressParts = shippingForm.address.split(',').map(p => p.trim());
    
    const draftData = {
      session_id: sessionId,
      user_id: user?.id || null,
      shipping_name: shippingForm.name || null,
      shipping_phone: shippingForm.phone || null,
      shipping_street: addressParts[0] || null,
      shipping_district: addressParts[1] || null,
      shipping_city: addressParts[2] || null,
      items: cartItems.map(item => ({
        id: item.product.id,
        name: item.product.name,
        price: item.product.price,
        quantity: item.quantity,
        image: item.product.images[0] || null,
      })),
      subtotal: cartTotal,
      shipping_cost: shippingCost,
      total: total,
    };

    // Upsert on the client-generated id: the first save inserts, later ones update.
    // No read-back is involved, so this works without a SELECT policy for anon.
    const draftId = getDraftOrderId();
    draftOrderId.current = draftId;

    const { error } = await supabase
      .from('draft_orders')
      .upsert({ id: draftId, ...draftData }, { onConflict: 'id' });

    if (error) {
      console.error('Error saving draft order:', error);
    }
  }, [cartItems, shippingForm, user, cartTotal, shippingCost, total]);

  // Debounced save on form change
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      saveDraftOrder();
    }, 1000); // Save after 1 second of no changes
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [shippingForm, cartItems, saveDraftOrder]);

  const formatPrice = (price: number) => {
    return `৳${price.toLocaleString('en-BD')}`;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setShippingForm(prev => ({ ...prev, [name]: value }));
  };

  const validateForm = (): boolean => {
    if (!shippingForm.name.trim()) {
      toast.error("Name is required");
      return false;
    }
    if (!shippingForm.phone.trim() || !/^(\+?880)?01[3-9]\d{8}$/.test(shippingForm.phone.replace(/\s/g, ''))) {
      toast.error("Valid Bangladesh phone number is required");
      return false;
    }
    if (!shippingForm.address.trim()) {
      toast.error("Address is required");
      return false;
    }

    // Require size selection for products that have variations
    const missingSize = cartItems.find((item) => {
      const variations = variationsByProductId[item.product.id] || item.product.variations || [];
      return variations.length > 0 && !item.variation;
    });

    if (missingSize) {
      toast.error("সাইজ নির্বাচন করুন", {
        description: `${missingSize.product.name} - এর সাইজ সিলেক্ট করুন`,
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    
    try {
      // Extract first and last name from full name
      const nameParts = shippingForm.name.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      // Update client-side pixel with user data for better matching
      setUserData?.({
        phone: shippingForm.phone,
        firstName,
        lastName,
      });
      
      const order = await createOrder({
        userId: user?.id || null,
        items: cartItems,
        shippingAddress: {
          name: shippingForm.name,
          phone: shippingForm.phone,
          address: shippingForm.address,
        },
        paymentMethod: 'cod',
        shippingZone: shippingZone,
      });
      
      // Mark draft order as converted
      if (draftOrderId.current) {
        await supabase
          .from('draft_orders')
          .update({ 
            is_converted: true, 
            converted_at: new Date().toISOString() 
          })
          .eq('id', draftOrderId.current);
      }
      
      // Clear session and draft ids so the next checkout starts a fresh draft — the
      // converted one is no longer writable by anon.
      localStorage.removeItem('checkout_session_id');
      clearDraftOrderId();
      draftOrderId.current = null;
      
      // Mark as order placed before clearing cart to prevent redirect
      hasPlacedOrder.current = true;
      
      // Prepare items data for tracking on confirmation page
      const orderItems = cartItems.map(item => ({
        productId: item.product.id,
        productName: item.product.name,
        price: item.product.price,
        quantity: item.quantity,
      }));
      
      dispatch(clearCart());
      
      // Navigate to confirmation page with order details including items for tracking
      navigate('/order-confirmation', {
        state: {
          orderNumber: order.orderNumber || order.id,
          customerName: shippingForm.name,
          phone: shippingForm.phone,
          total: total,
          items: orderItems,
          numItems: cartItems.reduce((sum, item) => sum + item.quantity, 0),
          city: shippingZone === 'inside_dhaka' ? 'dhaka' : 'bangladesh',
          district: shippingZone === 'inside_dhaka' ? 'dhaka' : undefined,
        },
        replace: true, // Replace to prevent back navigation to checkout
      });
    } catch (error) {
      console.error('Order error:', error);
      const msg =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : JSON.stringify(error);
      toast.error("অর্ডার করতে সমস্যা হয়েছে", {
        description: msg || "আবার চেষ্টা করুন।",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  const fieldClass = 'h-12 rounded-xl border-line bg-surface px-4 text-base transition-all focus-visible:border-brand focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-brand/10 focus-visible:ring-offset-0 sm:text-sm';
  const card = 'rounded-3xl border border-line bg-white p-5 shadow-[0_18px_40px_-30px_rgba(74,30,40,0.35)] sm:p-7';
  const steps = ['Cart', 'Checkout', 'Confirmation'];

  return (
    <div className="min-h-screen bg-surface pb-12">
      {/* Header */}
      <section className="border-b border-line bg-gradient-to-br from-brand-blush via-surface-warm to-surface">
        <div className="shell py-8 sm:py-10">
          <Link to="/cart" className="group mb-4 inline-flex items-center gap-2 text-sm text-ink-muted transition-colors hover:text-brand">
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Back to Cart
          </Link>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <m.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-3xl font-semibold tracking-[-0.025em] text-ink sm:text-[40px]">Checkout</m.h1>
              {!user && (
                <p className="mt-2 text-ink-muted">
                  Checking out as guest.{' '}
                  <Link to="/auth" className="font-semibold text-brand hover:underline">
                    Sign in
                  </Link>{' '}
                  to track your orders.
                </p>
              )}
            </div>

            {/* Progress */}
            <ol className="flex items-center gap-2 text-xs font-semibold">
              {steps.map((step, index) => {
                const done = index < 1;
                const active = index === 1;
                return (
                  <li key={step} className="flex items-center gap-2">
                    <m.span
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.1 + index * 0.12, type: 'spring', stiffness: 400, damping: 20 }}
                      className={'grid h-7 w-7 place-items-center rounded-full ' + (done ? 'bg-brand text-white' : active ? 'bg-brand text-white ring-4 ring-brand/15' : 'bg-white text-ink-muted ring-1 ring-line')}
                    >
                      {done ? <CheckCircle className="h-4 w-4" /> : index + 1}
                    </m.span>
                    <span className={active || done ? 'text-ink' : 'text-ink-muted'}>{step}</span>
                    {index < steps.length - 1 && (
                      <span className="relative mx-1 h-0.5 w-6 overflow-hidden rounded-full bg-line sm:w-10">
                        {done && <m.span initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.3, duration: 0.6 }} className="absolute inset-0 origin-left bg-brand" />}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </section>

      <div className="shell mt-8">
        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 lg:grid-cols-3 lg:gap-8">
            {/* Left Column - Forms */}
            <Stagger immediate stagger={0.12} delay={0.1} className="space-y-6 lg:col-span-2">
              {/* Shipping Information */}
              <StaggerItem className={card}>
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-blush">
                    <Truck className="h-5 w-5 text-brand" />
                  </div>
                  <h2 className="text-xl font-semibold text-ink">Delivery Information</h2>
                </div>

                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-ink-soft">Full Name *</Label>
                      <Input
                        id="name"
                        name="name"
                        placeholder="Enter your full name"
                        value={shippingForm.name}
                        onChange={handleInputChange}
                        required
                        className={fieldClass}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-ink-soft">Phone Number *</Label>
                      <Input
                        id="phone"
                        name="phone"
                        placeholder="01XXX-XXXXXX"
                        value={shippingForm.phone}
                        onChange={handleInputChange}
                        required
                        inputMode="tel"
                        className={fieldClass}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address" className="text-ink-soft">Full Address *</Label>
                    <Input
                      id="address"
                      name="address"
                      placeholder="House no, Road, Area, City, District"
                      value={shippingForm.address}
                      onChange={handleInputChange}
                      required
                      className={fieldClass}
                    />
                  </div>

                  {/* Shipping Method Selector */}
                  <ShippingMethodSelector
                    address={shippingForm.address}
                    selectedZone={shippingZone}
                    onZoneChange={setShippingZone}
                  />
                </div>
              </StaggerItem>

              {/* Payment Method - Fixed COD */}
              <StaggerItem className={card}>
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-blush">
                    <Banknote className="h-5 w-5 text-brand" />
                  </div>
                  <h2 className="text-xl font-semibold text-ink">Payment Method</h2>
                </div>

                <div className="flex items-center gap-4 rounded-2xl border-2 border-brand bg-brand-blush/60 p-4">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-brand shadow-sm">
                    <Banknote className="h-5 w-5" />
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-ink">Cash on Delivery</p>
                    <p className="text-sm text-ink-muted">Pay when you receive your order</p>
                  </div>
                  <CheckCircle className="h-5 w-5 text-brand" />
                </div>
              </StaggerItem>
            </Stagger>

            {/* Right Column - Order Summary */}
            <div className="lg:col-span-1">
              <Reveal direction="left" delay={0.2} className={card + ' sticky top-24'}>
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-blush">
                    <ShoppingBag className="h-5 w-5 text-brand" />
                  </div>
                  <h2 className="text-xl font-semibold text-ink">Order Summary</h2>
                </div>

                {/* Cart Items */}
                <div className="mb-6 max-h-64 space-y-4 overflow-y-auto pr-1">
                  {cartItems.map((item) => {
                    const itemKey = item.variation?.id
                      ? `${item.product.id}-${item.variation.id}`
                      : item.product.id;
                    const displayPrice = item.variation?.price ?? item.product.price;
                    const variations = variationsByProductId[item.product.id] || item.product.variations || [];

                    return (
                      <div key={itemKey} className="flex gap-3">
                        <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-surface-sand">
                          <img
                            loading="lazy"
                            decoding="async"
                            src={item.product.images[0] || '/placeholder.svg'}
                            alt={item.product.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm font-medium text-ink">{item.product.name}</p>

                          {variations.length > 0 && (
                            <div className="mt-2">
                              <Select
                                value={item.variation?.id}
                                onValueChange={(variationId) => {
                                  const v = variations.find((x) => x.id === variationId);
                                  if (!v) return;
                                  dispatch(
                                    setCartItemVariation({
                                      productId: item.product.id,
                                      fromVariationId: item.variation?.id,
                                      variation: v,
                                    })
                                  );
                                }}
                              >
                                <SelectTrigger className={'h-8 rounded-lg text-xs ' + (item.variation ? '' : 'border-brand/50 ring-2 ring-brand/10')}>
                                  <SelectValue placeholder="সাইজ নির্বাচন করুন" />
                                </SelectTrigger>
                                <SelectContent>
                                  {variations.map((v) => (
                                    <SelectItem key={v.id} value={v.id}>
                                      {v.name} — ৳{Number(v.price).toLocaleString('en-BD')}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          <p className="mt-2 text-sm text-ink-muted">Qty: {item.quantity}</p>
                        </div>
                        <p className="text-sm font-semibold text-ink">
                          {formatPrice(displayPrice * item.quantity)}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <Separator className="my-4 bg-line" />

                {/* Pricing */}
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-ink-muted">Subtotal</span>
                    <span className="font-medium text-ink">{formatPrice(cartTotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-muted">
                      Shipping ({shippingZone === 'inside_dhaka' ? 'Inside Dhaka' : 'Outside Dhaka'})
                    </span>
                    <AnimatePresence mode="popLayout" initial={false}>
                      <m.span key={shippingCost} initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 10, opacity: 0 }} className="font-medium text-ink">
                        {formatPrice(shippingCost)}
                      </m.span>
                    </AnimatePresence>
                  </div>
                </div>

                <Separator className="my-4 bg-line" />

                <div className="mb-6 flex items-center justify-between">
                  <span className="text-lg font-semibold text-ink">Total</span>
                  <CountUp value={total} format={(v) => formatPrice(Math.round(v))} className="text-2xl font-bold text-brand" />
                </div>

                <m.button
                  type="submit"
                  whileTap={{ scale: 0.98 }}
                  className="shine-sweep relative flex h-14 w-full items-center justify-center overflow-hidden rounded-full bg-brand text-base font-semibold text-white shadow-cta transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={isSubmitting || cartItems.length === 0}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>Place Order • {formatPrice(total)}</>
                  )}
                </m.button>

                <p className="mt-4 text-center text-xs text-ink-muted">
                  By placing your order, you agree to our Terms of Service and Privacy Policy.
                </p>
              </Reveal>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CheckoutPage;
