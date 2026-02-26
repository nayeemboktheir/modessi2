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
  short_description?: string | null;
  long_description?: string | null;
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
      description: product.short_description || product.description || null,
      features: product.long_description || null,
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

/**
 * Sync all products in batches of 5 with 15s delay between batches.
 * Calls onProgress(synced, total) after each batch.
 */
export const syncAllProductsToBotBhai = async (
  onProgress?: (synced: number, total: number) => void
) => {
  // Fetch all active products
  const { data: products, error } = await supabase
    .from('products')
    .select('*, categories(name)')
    .eq('is_active', true);

  if (error) throw error;
  if (!products || products.length === 0) {
    return { message: 'No active products found.' };
  }

  const BATCH_SIZE = 5;
  const DELAY_MS = 15000;
  let synced = 0;
  const total = products.length;
  const errors: string[] = [];

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const chunk = products.slice(i, i + BATCH_SIZE);

    await Promise.all(
      chunk.map(async (p) => {
        const stock = p.stock ?? 0;
        const payload = {
          product_id: p.id,
          product_name: p.name,
          image_url: p.images?.[0] || null,
          images: p.images || null,
          category: (p.categories as any)?.name || null,
          subcategory: null,
          tags: p.tags || null,
          color: null,
          size: null,
          stock,
          stock_status: getStockStatus(stock),
          base_price: p.original_price ?? p.price ?? 0,
          selling_price: p.price ?? 0,
          discount_price: p.original_price && p.original_price > p.price ? p.price : null,
          wholesale_price: null,
          description: p.short_description || p.description || null,
          features: p.long_description || null,
          is_available: p.is_active ?? true,
          status: p.is_active === false ? 'inactive' : 'active',
        };

        try {
          const { error: fnErr } = await supabase.functions.invoke('botbhai-sync', {
            body: { action: 'sync_product', data: payload },
          });
          if (fnErr) errors.push(`Product ${p.id}: ${fnErr.message}`);
        } catch (e: any) {
          errors.push(`Product ${p.id}: ${e.message || e}`);
        }
      })
    );

    synced += chunk.length;
    onProgress?.(synced, total);

    // Wait 15s between batches (skip after last batch)
    if (i + BATCH_SIZE < total) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  return {
    message: `Synced ${synced} products.${errors.length ? ` ${errors.length} errors.` : ''}`,
    errors: errors.length > 0 ? errors : undefined,
  };
};

/**
 * Sync all orders via the edge function (no batching needed).
 */
export const syncAllOrdersToBotBhai = async () => {
  const { data, error } = await supabase.functions.invoke('botbhai-sync', {
    body: { action: 'sync_all_orders' },
  });
  if (error) throw error;
  return data;
};
