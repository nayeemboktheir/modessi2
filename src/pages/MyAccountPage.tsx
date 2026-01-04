import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
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
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';

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

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <div className="container max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">আমার অ্যাকাউন্ট</h1>
            <p className="text-muted-foreground mt-1">
              স্বাগতম, {profile?.full_name || user.email}
            </p>
          </div>
          <Button variant="outline" onClick={handleSignOut} className="w-fit">
            <LogOut className="h-4 w-4 mr-2" />
            লগআউট
          </Button>
        </div>

        <Tabs defaultValue="orders" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" />
              অর্ডার সমূহ
            </TabsTrigger>
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              প্রোফাইল
            </TabsTrigger>
          </TabsList>

          {/* Orders Tab */}
          <TabsContent value="orders" className="space-y-4">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <Skeleton className="h-6 w-48 mb-4" />
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-4 w-3/4" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : orders.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">কোনো অর্ডার নেই</h3>
                  <p className="text-muted-foreground mb-4">আপনি এখনো কোনো অর্ডার করেননি</p>
                  <Button asChild>
                    <Link to="/products">পণ্য দেখুন</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {orders.map(order => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  প্রোফাইল তথ্য
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  // Extract phone from email if it's in phone.local format
                  const isPhoneEmail = user.email?.endsWith('@phone.local');
                  const displayEmail = isPhoneEmail ? null : (profile?.email || user.email);
                  const displayPhone = profile?.phone || (isPhoneEmail ? user.email?.replace('@phone.local', '') : null);
                  const displayName = profile?.full_name || user.user_metadata?.full_name;
                  
                  return (
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">নাম</p>
                        <p className="font-medium">{displayName || 'সেট করা হয়নি'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">ইমেইল</p>
                        <p className="font-medium">{displayEmail || 'সেট করা হয়নি'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">ফোন</p>
                        <p className="font-medium">{displayPhone || 'সেট করা হয়নি'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">অ্যাকাউন্ট তৈরি</p>
                        <p className="font-medium">
                          {format(new Date(user.created_at), 'dd MMMM, yyyy', { locale: bn })}
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

const OrderCard = ({ order }: { order: Order }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const status = statusConfig[order.status] || statusConfig.pending;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Order Header */}
        <div 
          className="p-4 md:p-6 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg">{order.order_number}</span>
                <Badge className={`${status.color} flex items-center gap-1`}>
                  {status.icon}
                  {status.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {format(new Date(order.created_at), 'dd MMMM, yyyy - hh:mm a', { locale: bn })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">৳{order.total.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">{order.order_items.length} টি পণ্য</p>
            </div>
          </div>

          {/* Tracking Info */}
          {order.tracking_number && (
            <div className="mt-4 p-3 bg-primary/5 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-primary" />
                  <span className="font-medium">ট্র্যাকিং নম্বর:</span>
                  <span className="font-mono bg-background px-2 py-1 rounded">{order.tracking_number}</span>
                </div>
                <a
                  href={`https://steadfast.com.bd/t/${order.tracking_number}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1"
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
        {isExpanded && (
          <div className="border-t bg-muted/20 p-4 md:p-6 space-y-4">
            {/* Products */}
            <div>
              <h4 className="font-semibold mb-3">পণ্য সমূহ</h4>
              <div className="space-y-3">
                {order.order_items.map(item => (
                  <div key={item.id} className="flex items-center gap-4 p-3 bg-background rounded-lg">
                    {item.product_image ? (
                      <img 
                        src={item.product_image} 
                        alt={item.product_name}
                        className="w-16 h-16 object-cover rounded"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                        <Package className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{item.product_name}</p>
                      {item.variation_name && (
                        <p className="text-sm text-muted-foreground">{item.variation_name}</p>
                      )}
                      <p className="text-sm">
                        ৳{item.price} x {item.quantity} = <span className="font-semibold">৳{item.price * item.quantity}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Shipping Address */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  ডেলিভারি ঠিকানা
                </h4>
                <div className="bg-background p-3 rounded-lg text-sm space-y-1">
                  <p className="font-medium">{order.shipping_name}</p>
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
                <h4 className="font-semibold mb-2">অর্ডার সামারি</h4>
                <div className="bg-background p-3 rounded-lg text-sm space-y-2">
                  <div className="flex justify-between">
                    <span>সাবটোটাল:</span>
                    <span>৳{order.subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>ডেলিভারি চার্জ:</span>
                    <span>৳{order.shipping_cost?.toLocaleString() || 0}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>মোট:</span>
                    <span className="text-primary">৳{order.total.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MyAccountPage;
