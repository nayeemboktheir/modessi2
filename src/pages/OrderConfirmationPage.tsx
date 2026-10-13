import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useRef } from 'react';
import { CheckCircle, Package, Phone, Home, Truck, ArrowRight } from 'lucide-react';
import { m, useReducedMotion } from 'framer-motion';
import { CountUp, Stagger, StaggerItem, EASE_OUT } from '@/components/motion';
import { useFacebookPixel } from '@/hooks/useFacebookPixel';
import { useServerTracking } from '@/hooks/useServerTracking';

interface OrderItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
}

interface OrderDetails {
  orderNumber: string;
  customerName?: string;
  phone?: string;
  total?: number;
  items?: OrderItem[];
  numItems?: number;
  city?: string;
  district?: string;
  fromLandingPage?: boolean;
  landingPageSlug?: string;
}

// Generate a unique event ID for deduplication between Pixel and CAPI
const generateEventId = () => {
  return `purchase_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
};

const OrderConfirmationPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as OrderDetails | null;

  const purchaseEventIdRef = useRef<string | null>(null);
  const hasSentServerPurchaseRef = useRef(false);
  const hasSentPixelPurchaseRef = useRef(false);

  // Refs only survive the mount. `location.state` survives a browser reload, so a
  // refresh of this page re-ran both effects with a fresh eventId and reported the
  // same sale to Meta/TikTok/GA again — dedup could not catch it because the ids
  // differed. Marking the order in sessionStorage makes the guard outlive the mount.
  const purchaseAlreadyReported = (channel: string, order: string) => {
    if (!order) return false;
    try {
      const key = `purchase_reported_${channel}_${order}`;
      if (sessionStorage.getItem(key)) return true;
      sessionStorage.setItem(key, '1');
      return false;
    } catch {
      // Private mode / blocked storage: fall back to the per-mount refs.
      return false;
    }
  };

  const reduce = useReducedMotion();
  const { isReady: pixelReady, setUserData } = useFacebookPixel();
  const { trackPurchase: trackServerPurchase } = useServerTracking();

  
  const orderNumber = state?.orderNumber || '';
  const customerName = state?.customerName;
  const phone = state?.phone;
  const total = state?.total;
  const items = state?.items || [];
  const numItems = state?.numItems || items.reduce((sum, item) => sum + item.quantity, 0);
  const city = state?.city;
  const district = state?.district;
  const fromLandingPage = state?.fromLandingPage;
  const landingPageSlug = state?.landingPageSlug;

  // 1) Prepare event id + user data once (fast)
  useEffect(() => {
    if (!orderNumber || !total || total <= 0) return;

    if (!purchaseEventIdRef.current) {
      purchaseEventIdRef.current = generateEventId();
    }

    // Update user data for better matching (safe to call multiple times)
    const nameParts = (customerName || '').trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    if (phone || firstName) {
      setUserData?.({
        phone,
        firstName,
        lastName,
      });
    }
  }, [orderNumber, total, customerName, phone, setUserData]);

  // 2) Send SERVER Purchase exactly once (this is the one that matters most)
  useEffect(() => {
    if (!orderNumber || !total || total <= 0) return;
    if (hasSentServerPurchaseRef.current) return;
    if (purchaseAlreadyReported('server', orderNumber)) {
      hasSentServerPurchaseRef.current = true;
      return;
    }

    hasSentServerPurchaseRef.current = true;

    const eventId = purchaseEventIdRef.current || generateEventId();
    purchaseEventIdRef.current = eventId;

    const contentIds = items.map((item) => item.productId);
    const contentNames = items.map((item) => item.productName);
    
    // Build contents array with quantity and price for better event matching
    const contents = items.map((item) => ({
      id: item.productId,
      quantity: item.quantity,
      item_price: item.price,
    }));

    const nameParts = (customerName || '').trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    trackServerPurchase({
      orderId: orderNumber,
      contentIds: contentIds.length > 0 ? contentIds : [orderNumber],
      contentNames: contentNames.length > 0 ? contentNames : undefined,
      contents: contents.length > 0 ? contents : undefined,
      value: total,
      numItems: numItems || 1,
      currency: 'BDT',
      userData: { 
        phone, 
        firstName, 
        lastName,
        city: city || district, // Use city or district for better matching
        country: 'bd',
      },
      eventId,
    }).catch((err) => {
      console.error('[CAPI] Purchase tracking error:', err);
    });
  }, [orderNumber, total, items, numItems, customerName, phone, city, district, trackServerPurchase]);

  // 3) Send BROWSER Purchase as soon as Pixel is ready (no missing/slow init)
  useEffect(() => {
    if (!orderNumber || !total || total <= 0) return;
    if (hasSentPixelPurchaseRef.current) return;
    if (!pixelReady || !window.fbq) return;
    if (purchaseAlreadyReported('pixel', orderNumber)) {
      hasSentPixelPurchaseRef.current = true;
      return;
    }

    const eventId = purchaseEventIdRef.current || generateEventId();
    purchaseEventIdRef.current = eventId;

    const contentIds = items.map((item) => item.productId);

    window.fbq(
      'track',
      'Purchase',
      {
        content_ids: contentIds.length > 0 ? contentIds : [orderNumber],
        content_type: 'product',
        value: total,
        currency: 'BDT',
        num_items: numItems || 1,
      },
      { eventID: eventId }
    );

    hasSentPixelPurchaseRef.current = true;
  }, [orderNumber, total, items, numItems, pixelReady]);



  const reveal = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE_OUT } },
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-brand-blush via-surface to-surface px-4 py-12">
      {!reduce && <Confetti />}

      <div className="relative mx-auto max-w-2xl">
        {/* Success Animation */}
        <div className="mb-8 text-center">
          <m.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 14 }}
            className="relative mx-auto grid h-28 w-28 place-items-center"
          >
            {!reduce && (
              <>
                <m.span className="absolute inset-0 rounded-full bg-[#6B8E23]/15" initial={{ scale: 0.6, opacity: 1 }} animate={{ scale: 1.8, opacity: 0 }} transition={{ duration: 1.4, repeat: 2, ease: 'easeOut' }} />
                <m.span className="absolute inset-0 rounded-full bg-[#6B8E23]/15" initial={{ scale: 0.6, opacity: 1 }} animate={{ scale: 1.8, opacity: 0 }} transition={{ duration: 1.4, delay: 0.5, repeat: 2, ease: 'easeOut' }} />
              </>
            )}
            <span className="relative grid h-24 w-24 place-items-center rounded-full bg-white shadow-[0_20px_40px_-15px_rgba(107,142,35,0.6)]">
              <svg viewBox="0 0 52 52" className="h-14 w-14" fill="none">
                <m.circle cx="26" cy="26" r="23" stroke="#6B8E23" strokeWidth="3" initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: 0.2 }} />
                <m.path d="M15 27 l7 7 l15 -16" stroke="#6B8E23" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45, delay: 0.75, ease: 'easeOut' }} />
              </svg>
            </span>
          </m.div>
        </div>

        {/* Main Card */}
        <m.div
          initial={reduce ? false : 'hidden'}
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: 0.5 } } }}
          className="rounded-[2rem] border border-line bg-white p-6 text-center shadow-[0_30px_60px_-35px_rgba(74,30,40,0.45)] sm:p-9"
        >
          <m.h1 variants={reveal} className="mb-3 text-3xl font-bold text-ink md:text-4xl">
            🎉 অর্ডার সফল হয়েছে!
          </m.h1>
          <m.p variants={reveal} className="mb-7 text-lg text-ink-muted">
            আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে
          </m.p>

          {/* Order Number */}
          {orderNumber && (
            <m.div variants={reveal} className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-brand to-brand-soft p-6 text-white">
              <span className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full border-[16px] border-white/10" />
              <p className="mb-1 text-sm text-white/75">অর্ডার নম্বর</p>
              <p className="font-mono text-2xl font-bold tracking-wider">{orderNumber}</p>
            </m.div>
          )}

          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            {/* Customer Info */}
            {(customerName || phone) && (
              <m.div variants={reveal} className="rounded-2xl bg-surface-warm p-4 text-left">
                {customerName && (
                  <div className="mb-2 flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white">
                      <span className="text-sm">👤</span>
                    </div>
                    <span className="text-ink-soft">{customerName}</span>
                  </div>
                )}
                {phone && (
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white">
                      <Phone className="h-4 w-4 text-brand" />
                    </div>
                    <span className="text-ink-soft">{phone}</span>
                  </div>
                )}
              </m.div>
            )}

            {/* Total */}
            {total && (
              <m.div variants={reveal} className={'flex flex-col justify-center rounded-2xl border border-gold/30 bg-gold/10 p-4 ' + (customerName || phone ? '' : 'sm:col-span-2')}>
                <p className="mb-1 text-sm text-ink-muted">মোট মূল্য</p>
                <p className="text-3xl font-bold text-ink">
                  ৳<CountUp value={total} format={(v) => Math.round(v).toLocaleString()} />
                </p>
              </m.div>
            )}
          </div>

          {/* Next Steps */}
          <m.div variants={reveal} className="mb-8 rounded-2xl border border-line bg-surface p-6 text-left">
            <h3 className="mb-5 flex items-center gap-2 font-bold text-ink">
              <Package className="h-5 w-5 text-brand" />
              পরবর্তী ধাপসমূহ
            </h3>
            <ol className="relative space-y-5">
              <span className="absolute bottom-3 left-[13px] top-3 w-0.5 bg-line" />
              {[
                ['১', 'আমাদের টিম শীঘ্রই আপনার সাথে কল করে অর্ডার কনফার্ম করবে'],
                ['২', 'পণ্য প্যাকেজিং করে কুরিয়ারে হস্তান্তর করা হবে'],
                ['৩', 'পণ্য হাতে পেয়ে মূল্য পরিশোধ করুন (ক্যাশ অন ডেলিভারি)'],
              ].map(([step, text], index) => (
                <m.li
                  key={step}
                  initial={reduce ? false : { opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.1 + index * 0.18 }}
                  className="relative flex items-start gap-3"
                >
                  <span className="relative z-10 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white ring-4 ring-surface">{step}</span>
                  <span className="pt-0.5 text-ink-soft">{text}</span>
                </m.li>
              ))}
            </ol>
          </m.div>

          {/* Delivery Info */}
          <m.div variants={reveal} className="mb-8 flex items-center justify-center gap-4 rounded-2xl border border-[#6B8E23]/25 bg-[#6B8E23]/5 p-4">
            <Truck className="h-8 w-8 animate-float text-[#6B8E23]" />
            <div className="text-left">
              <p className="font-semibold text-ink">ডেলিভারি সময়</p>
              <p className="text-sm text-ink-muted">ঢাকায় ১-২ দিন • ঢাকার বাইরে ৩-৫ দিন</p>
            </div>
          </m.div>

          {/* Contact */}
          <m.div variants={reveal} className="mb-8 rounded-2xl bg-surface-warm p-4 text-center">
            <p className="mb-2 text-ink-muted">যেকোনো প্রশ্নে কল করুন</p>
            <a href="tel:+8801995909243" className="text-xl font-bold text-brand hover:underline">
              📞 +880 1995-909243
            </a>
          </m.div>

          {/* Action Buttons */}
          <m.div variants={reveal} className="flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-full border border-line px-6 font-semibold text-ink-soft transition-colors hover:border-brand/40 hover:text-brand"
            >
              <Home className="h-5 w-5" />
              হোমপেজে যান
            </button>
            <button
              type="button"
              onClick={() => navigate('/products')}
              className="shine-sweep group relative inline-flex h-12 items-center justify-center gap-2 overflow-hidden rounded-full bg-brand px-6 font-semibold text-white shadow-cta transition-colors hover:bg-brand-deep"
            >
              আরও পণ্য দেখুন
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </button>
          </m.div>
        </m.div>

        {/* Trust Badges */}
        <Stagger immediate delay={1.4} className="mt-8 grid grid-cols-3 gap-3 text-center sm:gap-4">
          {[
            ['🔒', 'নিরাপদ পেমেন্ট'],
            ['📦', 'দ্রুত ডেলিভারি'],
            ['✅', '১০০% গ্যারান্টি'],
          ].map(([icon, label]) => (
            <StaggerItem key={label} className="rounded-2xl border border-line bg-white p-4 shadow-sm">
              <span className="mb-1 block text-2xl">{icon}</span>
              <p className="text-xs text-ink-muted">{label}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </div>
  );
};

const CONFETTI_COLORS = ['#941e3d', '#e8a33c', '#f6c8d4', '#6B8E23', '#9c4359', '#f3e7d6'];

/** One-shot burst of falling paper; pure transform/opacity so it stays cheap. */
const Confetti = () => {
  const pieces = useMemo(
    () => Array.from({ length: 36 }).map((_, index) => ({
      id: index,
      left: Math.random() * 100,
      drift: (Math.random() - 0.5) * 220,
      rotate: Math.random() * 720 - 360,
      delay: Math.random() * 0.5,
      duration: 2.2 + Math.random() * 1.6,
      size: 6 + Math.random() * 6,
      color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
      round: index % 3 === 0,
    })),
    [],
  );

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[90vh] overflow-hidden">
      {pieces.map((piece) => (
        <m.span
          key={piece.id}
          className="absolute top-0 block"
          style={{ left: piece.left + '%', width: piece.size, height: piece.round ? piece.size : piece.size * 0.45, backgroundColor: piece.color, borderRadius: piece.round ? '9999px' : '2px' }}
          initial={{ y: -40, x: 0, rotate: 0, opacity: 1 }}
          animate={{ y: '85vh', x: piece.drift, rotate: piece.rotate, opacity: [1, 1, 0] }}
          transition={{ duration: piece.duration, delay: 0.4 + piece.delay, ease: [0.2, 0.6, 0.4, 1] }}
        />
      ))}
    </div>
  );
};

export default OrderConfirmationPage;
