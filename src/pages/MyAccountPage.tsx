import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { 
  Package, 
  Truck, 
  CheckCircle, 
  Clock, 
  XCircle, 
  User, 
  LogOut, 
  ShoppingBag,
  MapPin,
  Phone,
  Calendar,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import { AnimatePresence, m } from 'framer-motion';
import { Stagger, StaggerItem } from '@/components/motion';

interface OrderItem {
  id: string;
  product_name: string;
  product_image: string | null;
  quantity: number;
  price: number;
  variation_name: string | null;
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  total: number;
  subtotal: number;
  shipping_cost: number;
  shipping_name: string;
  shipping_phone: string;
  shipping_street: string;
  shipping_district: string;
  shipping_city: string;
  tracking_number: string | null;
  created_at: string;
  order_items: OrderItem[];
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'অপেক্ষমাণ', color: 'bg-yellow-100 text-yellow-800', icon: <Clock className="h-4 w-4" /> },
  processing: { label: 'প্রসেসিং', color: 'bg-blue-100 text-blue-800', icon: <Package className="h-4 w-4" /> },
  shipped: { label: 'শিপিং হয়েছে', color: 'bg-purple-100 text-purple-800', icon: <Truck className="h-4 w-4" /> },
  delivered: { label: 'ডেলিভার হয়েছে', color: 'bg-green-100 text-green-800', icon: <CheckCircle className="h-4 w-4" /> },
  cancelled: { label: 'বাতিল', color: 'bg-red-100 text-red-800', icon: <XCircle className="h-4 w-4" /> },
};

const MyAccountPage = () => {
  const navigate = useNavigate();
  const { user, signOut, isLoading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<{ full_name: string; phone: string; email: string } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchUserData();
    }
  }, [user]);

  const fetchUserData = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, phone, email')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (profileData) {
        setProfile(profileData);
      }

      // Fetch orders with items
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            product_name,
            product_image,
            quantity,
            price,
            variation_name
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(ordersData || []);
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const [tab, setTab] = useState<'orders' | 'profile'>('orders');

  if (authLoading || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand/20 border-t-brand"></div>
      </div>
    );
  }

  const displayInitial = (profile?.full_name || user.email || 'M').slice(0, 1).toUpperCase();
  const tabs = [
    { key: 'orders' as const, label: 'অর্ডার সমূহ', icon: ShoppingBag },
    { key: 'profile' as const, label: 'প্রোফাইল', icon: User },
  ];

  return (
    <div className="min-h-screen bg-surface pb-12">
      {/* Header */}
      <section className="relative overflow-hidden border-b border-line bg-gradient-to-br from-brand-blush via-surface-warm to-surface">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 animate-spin-slow rounded-full border-[26px] border-dashed border-brand/5" />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-5 px-4 py-10 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <m.span
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 16 }}
              className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-soft text-2xl font-bold text-white shadow-cta"
            >
              {displayInitial}
            </m.span>
            <m.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
              <h1 className="text-2xl font-bold text-ink md:text-3xl">আমার অ্যাকাউন্ট</h1>
              <p className="mt-1 text-ink-muted">
                স্বাগতম, {profile?.full_name || user.email}
              </p>
            </m.div>
          </div>
          <button type="button" onClick={handleSignOut} className="inline-flex w-fit items-center gap-2 rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold text-ink-soft transition-colors hover:border-destructive/40 hover:text-destructive">
            <LogOut className="h-4 w-4" />
            লগআউট
          </button>
        </div>
      </section>

      <div className="mx-auto mt-8 max-w-6xl px-4">
        {/* Tabs */}
        <div className="mb-6 inline-grid w-full max-w-md grid-cols-2 rounded-full border border-line bg-white p-1">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={'relative flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold transition-colors ' + (tab === key ? 'text-white' : 'text-ink-muted hover:text-ink')}
            >
              {tab === key && <m.span layoutId="account-tab" className="absolute inset-0 rounded-full bg-brand shadow-cta" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
              <Icon className="relative h-4 w-4" />
              <span className="relative">{label}</span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {tab === 'orders' ? (
            <m.div key="orders" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.25 }}>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="rounded-3xl border border-line bg-white p-6">
                      <div className="skeleton-shimmer mb-4 h-6 w-48 rounded" />
                      <div className="skeleton-shimmer mb-2 h-4 w-full rounded" />
                      <div className="skeleton-shimmer h-4 w-3/4 rounded" />
                    </div>
                  ))}
                </div>
              ) : orders.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-line bg-white py-14 text-center">
                  <ShoppingBag className="mx-auto mb-4 h-16 w-16 animate-float text-brand-soft" />
                  <h3 className="mb-2 text-lg font-semibold text-ink">কোনো অর্ডার নেই</h3>
                  <p className="mb-5 text-ink-muted">আপনি এখনো কোনো অর্ডার করেননি</p>
                  <Link to="/products" className="inline-flex rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white shadow-cta transition-colors hover:bg-brand-deep">পণ্য দেখুন</Link>
                </div>
              ) : (
                <Stagger immediate stagger={0.07} className="space-y-4">
                  {orders.map(order => (
                    <StaggerItem key={order.id}>
                      <OrderCard order={order} />
                    </StaggerItem>
                  ))}
                </Stagger>
              )}
            </m.div>
          ) : (
            <m.div key="profile" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }} className="rounded-3xl border border-line bg-white p-6 shadow-sm sm:p-8">
              <h2 className="mb-6 flex items-center gap-2 text-xl font-semibold text-ink">
                <User className="h-5 w-5 text-brand" />
                প্রোফাইল তথ্য
              </h2>
              {(() => {
                // Extract phone from email if it's in phone.local format
                const isPhoneEmail = user.email?.endsWith('@phone.local');
                const displayEmail = isPhoneEmail ? null : (profile?.email || user.email);
                const displayPhone = profile?.phone || (isPhoneEmail ? user.email?.replace('@phone.local', '') : null);
                const displayName = profile?.full_name || user.user_metadata?.full_name;
                const rows = [
                  ['নাম', displayName || 'সেট করা হয়নি'],
                  ['ইমেইল', displayEmail || 'সেট করা হয়নি'],
                  ['ফোন', displayPhone || 'সেট করা হয়নি'],
                  ['অ্যাকাউন্ট তৈরি', format(new Date(user.created_at), 'dd MMMM, yyyy', { locale: bn })],
                ];

                return (
                  <Stagger immediate stagger={0.06} className="grid gap-4 md:grid-cols-2">
                    {rows.map(([label, value]) => (
                      <StaggerItem key={label} className="space-y-1 rounded-2xl bg-surface p-4">
                        <p className="text-sm text-ink-muted">{label}</p>
                        <p className="font-medium text-ink">{value}</p>
                      </StaggerItem>
                    ))}
                  </Stagger>
                );
              })()}
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const OrderCard = ({ order }: { order: Order }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const status = statusConfig[order.status] || statusConfig.pending;

  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-white shadow-sm transition-shadow hover:shadow-[0_18px_40px_-26px_rgba(110,25,50,0.4)]">
      {/* Order Header */}
      <div
        className="cursor-pointer p-4 transition-colors hover:bg-surface md:p-6"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-bold text-ink">{order.order_number}</span>
              <Badge className={`${status.color} flex items-center gap-1`}>
                {status.icon}
                {status.label}
              </Badge>
            </div>
            <p className="flex items-center gap-1 text-sm text-ink-muted">
              <Calendar className="h-4 w-4" />
              {format(new Date(order.created_at), 'dd MMMM, yyyy - hh:mm a', { locale: bn })}
            </p>
          </div>
          <div className="flex items-center justify-between gap-4 md:justify-end">
            <div className="md:text-right">
              <p className="text-2xl font-bold text-brand">৳{order.total.toLocaleString()}</p>
              <p className="text-sm text-ink-muted">{order.order_items.length} টি পণ্য</p>
            </div>
            <m.span animate={{ rotate: isExpanded ? 180 : 0 }} className="grid h-9 w-9 place-items-center rounded-full bg-surface-warm text-ink-soft">
              <ChevronDown className="h-4 w-4" />
            </m.span>
          </div>
        </div>

        {/* Tracking Info */}
        {order.tracking_number && (
          <div className="mt-4 rounded-2xl bg-brand-blush/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Truck className="h-5 w-5 text-brand" />
                <span className="font-medium text-ink">ট্র্যাকিং নম্বর:</span>
                <span className="rounded bg-white px-2 py-1 font-mono">{order.tracking_number}</span>
              </div>
              <a
                href={/^\d+$/.test(order.tracking_number) ? `https://steadfast.com.bd/t/${order.tracking_number}` : `https://merchant.carrybee.com/order-track/${order.tracking_number}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 font-semibold text-brand hover:underline"
                onClick={e => e.stopPropagation()}
              >
                ট্র্যাক করুন
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Expanded Details */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-4 border-t border-line bg-surface p-4 md:p-6">
              {/* Products */}
              <div>
                <h4 className="mb-3 font-semibold text-ink">পণ্য সমূহ</h4>
                <div className="space-y-3">
                  {order.order_items.map(item => (
                    <div key={item.id} className="flex items-center gap-4 rounded-2xl bg-white p-3">
                      {item.product_image ? (
                        <img
                          loading="lazy"
                          decoding="async"
                          src={item.product_image}
                          alt={item.product_name}
                          className="h-16 w-16 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-surface-sand">
                          <Package className="h-6 w-6 text-ink-muted" />
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-medium text-ink">{item.product_name}</p>
                        {item.variation_name && (
                          <p className="text-sm text-ink-muted">{item.variation_name}</p>
                        )}
                        <p className="text-sm text-ink-soft">
                          ৳{item.price} x {item.quantity} = <span className="font-semibold">৳{item.price * item.quantity}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Shipping Address */}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="mb-2 flex items-center gap-2 font-semibold text-ink">
                    <MapPin className="h-4 w-4 text-brand" />
                    ডেলিভারি ঠিকানা
                  </h4>
                  <div className="space-y-1 rounded-2xl bg-white p-3 text-sm text-ink-soft">
                    <p className="font-medium text-ink">{order.shipping_name}</p>
                    <p className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {order.shipping_phone}
                    </p>
                    <p>{order.shipping_street}</p>
                    <p>{order.shipping_district}, {order.shipping_city}</p>
                  </div>
                </div>

                {/* Order Summary */}
                <div>
                  <h4 className="mb-2 font-semibold text-ink">অর্ডার সামারি</h4>
                  <div className="space-y-2 rounded-2xl bg-white p-3 text-sm text-ink-soft">
                    <div className="flex justify-between">
                      <span>সাবটোটাল:</span>
                      <span>৳{order.subtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>ডেলিভারি চার্জ:</span>
                      <span>৳{order.shipping_cost?.toLocaleString() || 0}</span>
                    </div>
                    <div className="flex justify-between border-t border-line pt-2 text-lg font-bold text-ink">
                      <span>মোট:</span>
                      <span className="text-brand">৳{order.total.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MyAccountPage;
