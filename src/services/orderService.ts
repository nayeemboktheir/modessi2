import { supabase } from '@/integrations/supabase/client';
import { Order, CartItem } from '@/types';

interface CreateOrderData {
  userId: string | null;
  items: CartItem[];
  shippingAddress: {
    name: string;
    phone: string;
    address: string;
  };
  paymentMethod: 'cod' | 'stripe';
  shippingZone?: 'inside_dhaka' | 'outside_dhaka';
}

export const createOrder = async (orderData: CreateOrderData): Promise<Order> => {
  let invokeResult: { data: any; error: any };

  try {
    invokeResult = await supabase.functions.invoke('place-order', {
      body: {
        userId: orderData.userId,
        items: orderData.items.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
          // Provide extra fields so orders can still be placed when the catalog uses non-UUID mock ids
          productName: i.product.name,
          productImage: i.product.images?.[0] ?? null,
          price: i.product.price,
        })),
        shipping: {
          name: orderData.shippingAddress.name,
          phone: orderData.shippingAddress.phone,
          address: orderData.shippingAddress.address,
        },
        shippingZone: orderData.shippingZone || 'outside_dhaka',
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : JSON.stringify(e);
    throw new Error(`Network error while placing order: ${msg}`);
  }

  const { data, error } = invokeResult;

  if (error) {
    const anyErr = error as any;
    const details =
      anyErr?.context?.body?.error ||
      anyErr?.context?.body?.message ||
      anyErr?.context?.body ||
      anyErr?.message ||
      anyErr?.name ||
      'Failed to place order';
    throw new Error(typeof details === 'string' ? details : JSON.stringify(details));
  }

  if (!data?.orderId) {
    throw new Error('Order creation failed: empty response');
  }

  const now = new Date().toISOString();

  return {
    id: data.orderId,
    userId: orderData.userId || '',
    items: orderData.items,
    total: Number(data.total),
    subtotal: Number(data.subtotal),
    shipping: Number(data.shippingCost),
    status: 'pending',
    paymentMethod: 'cod',
    paymentStatus: 'pending',
    shippingAddress: {
      id: '',
      name: orderData.shippingAddress.name,
      phone: orderData.shippingAddress.phone,
      street: orderData.shippingAddress.address,
      city: 'N/A',
      district: 'N/A',
      postalCode: '',
    },
    createdAt: now,
    updatedAt: now,
  };
};

export const fetchUserOrders = async (userId: string): Promise<Order[]> => {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      order_items (*)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((order): Order => ({
    id: order.id,
    userId: order.user_id || '',
    items: (order.order_items || []).map((item: any) => ({
      product: {
        id: item.product_id,
        name: item.product_name,
        slug: '',
        description: '',
        price: Number(item.price),
        images: [item.product_image],
        category: '',
        rating: 0,
        reviewCount: 0,
        stock: 0,
      },
      quantity: item.quantity,
    })),
    total: Number(order.total),
    subtotal: Number(order.subtotal),
    shipping: Number(order.shipping_cost),
    discount: Number(order.discount) || undefined,
    status: order.status as Order['status'],
    paymentMethod: order.payment_method as Order['paymentMethod'],
    paymentStatus: order.payment_status as Order['paymentStatus'],
    shippingAddress: {
      id: '',
      name: order.shipping_name,
      phone: order.shipping_phone,
      street: order.shipping_street,
      city: order.shipping_city,
      district: order.shipping_district,
      postalCode: order.shipping_postal_code || '',
    },
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    trackingNumber: order.tracking_number || undefined,
  }));
};
