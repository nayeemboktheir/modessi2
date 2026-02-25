import { supabase } from '@/integrations/supabase/client';

const getStockStatus = (stock: number): 'in_stock' | 'low_stock' | 'out_of_stock' => {
  if (stock <= 0) return 'out_of_stock';
  if (stock < 10) return 'low_stock';
  return 'in_stock';
};

export const syncProductToBotBhai = async (product: {
  id: string;
  name: string;
  price: number;
  original_price?: number | null;
  stock: number;
  images?: string[] | null;
  category?: string;
  tags?: string[] | null;
  description?: string | null;
  is_active?: boolean;
}) => {
  try {
    const payload = {
      product_id: product.id,
      product_name: product.name,
      image_url: product.images?.[0] || null,
      images: product.images || null,
      category: product.category || null,
      subcategory: null,
      tags: product.tags || null,
      color: null,
      size: null,
      stock: product.stock ?? 0,
      stock_status: getStockStatus(product.stock ?? 0),
      base_price: product.original_price ?? product.price ?? 0,
      selling_price: product.price ?? 0,
      discount_price: product.original_price && product.original_price > product.price ? product.price : null,
      wholesale_price: null,
      description: product.description || null,
      features: null,
      is_available: product.is_active ?? true,
      status: product.is_active === false ? 'inactive' : 'active',
    };

    await supabase.functions.invoke('botbhai-sync', {
      body: { action: 'sync_product', data: payload },
    });
  } catch (err) {
    console.error('BotBhai product sync error:', err);
  }
};

export const deleteProductFromBotBhai = async (productId: string) => {
  try {
    await supabase.functions.invoke('botbhai-sync', {
      body: { action: 'delete_product', data: { id: productId } },
    });
  } catch (err) {
    console.error('BotBhai product delete error:', err);
  }
};

export const syncOrderToBotBhai = async (order: {
  id: string;
  total: number;
  subtotal?: number;
  shipping_cost?: number;
  discount?: number;
  status: string;
  payment_method?: string;
  payment_status?: string;
  notes?: string | null;
  customer: { name: string; phone: string; email?: string | null; address: string };
  items: Array<{ product_id: string; qty: number; price: number }>;
}) => {
  try {
    const payload = {
      order_id: order.id,
      customer_id: order.customer.phone || order.customer.email || order.id,
      customer_name: order.customer.name || null,
      customer_phone: order.customer.phone || null,
      customer_email: order.customer.email || null,
      customer_address: order.customer.address || null,
      items: order.items,
      subtotal: order.subtotal ?? order.total ?? 0,
      delivery_charge: order.shipping_cost ?? 0,
      discount: order.discount ?? 0,
      total: order.total ?? 0,
      status: order.status || 'pending',
      payment_method: order.payment_method || null,
      payment_status: order.payment_status || 'unpaid',
      paid_amount: order.payment_status === 'paid' ? (order.total ?? 0) : 0,
      customer_notes: order.notes || null,
    };

    await supabase.functions.invoke('botbhai-sync', {
      body: { action: 'sync_order', data: payload },
    });
  } catch (err) {
    console.error('BotBhai order sync error:', err);
  }
};

export const deleteOrderFromBotBhai = async (orderId: string) => {
  try {
    await supabase.functions.invoke('botbhai-sync', {
      body: { action: 'delete_order', data: { id: orderId } },
    });
  } catch (err) {
    console.error('BotBhai order delete error:', err);
  }
};

export const syncAllToBotBhai = async () => {
  const { data, error } = await supabase.functions.invoke('botbhai-sync', {
    body: { action: 'sync_all' },
  });
  if (error) throw error;
  return data;
};
