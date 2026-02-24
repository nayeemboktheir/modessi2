import { supabase } from '@/integrations/supabase/client';

const BOTBHAI_PRODUCTS_URL = 'https://chat.botbhai.net/api/v1/external/products';
const BOTBHAI_ORDERS_URL = 'https://chat.botbhai.net/api/v1/external/orders';

const getBotBhaiApiKey = async (): Promise<string | null> => {
  const { data, error } = await supabase
    .from('admin_settings')
    .select('value')
    .eq('key', 'botbhai_api_key')
    .single();

  if (error || !data?.value) return null;
  return data.value;
};

// ---------- Product Sync ----------

export interface BotBhaiProductPayload {
  product_id: string;
  product_name: string;
  image_url: string | null;
  images: string[] | null;
  category: string | null;
  subcategory: string | null;
  tags: string[] | null;
  color: string | null;
  size: string | null;
  stock: number;
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock';
  base_price: number;
  selling_price: number;
  discount_price: number | null;
  wholesale_price: number | null;
  description: string | null;
  features: string[] | null;
  is_available: boolean;
  status: 'active' | 'inactive' | 'archived';
}

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
    const apiKey = await getBotBhaiApiKey();
    if (!apiKey) return;

    const payload: BotBhaiProductPayload = {
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
      discount_price: product.original_price && product.original_price > product.price
        ? product.price
        : null,
      wholesale_price: null,
      description: product.description || null,
      features: null,
      is_available: product.is_active ?? true,
      status: product.is_active === false ? 'inactive' : 'active',
    };

    const res = await fetch(BOTBHAI_PRODUCTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error('BotBhai product sync failed:', res.status, await res.text());
    }
  } catch (err) {
    console.error('BotBhai product sync error:', err);
  }
};

// ---------- Order Sync ----------

export interface BotBhaiOrderPayload {
  order_id: string;
  customer_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  customer_address: string | null;
  items: Array<{ product_id: string; qty: number; price: number }>;
  subtotal: number;
  delivery_charge: number;
  discount: number;
  total: number;
  status: string;
  payment_method: string | null;
  payment_status: string;
  paid_amount: number;
  customer_notes: string | null;
}

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
  customer: {
    name: string;
    phone: string;
    email?: string | null;
    address: string;
  };
  items: Array<{
    product_id: string;
    qty: number;
    price: number;
  }>;
}) => {
  try {
    const apiKey = await getBotBhaiApiKey();
    if (!apiKey) return;

    const payload: BotBhaiOrderPayload = {
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

    const res = await fetch(BOTBHAI_ORDERS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error('BotBhai order sync failed:', res.status, await res.text());
    }
  } catch (err) {
    console.error('BotBhai order sync error:', err);
  }
};
