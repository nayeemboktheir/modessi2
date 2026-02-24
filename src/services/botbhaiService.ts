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

export const syncProductToBotBhai = async (product: {
  id: string;
  name: string;
  price: number;
  stock: number;
  image?: string;
  category?: string;
  active: boolean;
}) => {
  try {
    const apiKey = await getBotBhaiApiKey();
    if (!apiKey) return;

    const body = {
      id: product.id,
      name: product.name,
      price: product.price,
      stock: product.stock,
      image: product.image || '',
      category: product.category || '',
      active: product.active,
    };

    const res = await fetch(BOTBHAI_PRODUCTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error('BotBhai product sync failed:', res.status, await res.text());
    }
  } catch (err) {
    console.error('BotBhai product sync error:', err);
  }
};

export const syncOrderToBotBhai = async (order: {
  id: string;
  total: number;
  status: string;
  customer: {
    name: string;
    phone: string;
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

    const res = await fetch(BOTBHAI_ORDERS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(order),
    });

    if (!res.ok) {
      console.error('BotBhai order sync failed:', res.status, await res.text());
    }
  } catch (err) {
    console.error('BotBhai order sync error:', err);
  }
};
