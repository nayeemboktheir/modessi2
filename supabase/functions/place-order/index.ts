// Lovable Cloud Function: place-order
// Public endpoint (verify_jwt=false). Uses service role key to safely create orders for guests.
// Optimized for speed: returns response immediately, handles CAPI/SMS in background.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type PlaceOrderBody = {
  userId?: string | null;
  items: Array<{
    productId: string;
    variationId?: string;
    quantity: number;
    productName?: string;
    productImage?: string | null;
    price?: number;
  }>;
  shipping: { name: string; phone: string; address: string };
  shippingZone?: 'inside_dhaka' | 'outside_dhaka';
  notes?: string;
  orderSource?: 'web' | 'manual';
};

function isBangladeshPhone(phone: string) {
  const normalized = phone.replace(/\s/g, '');
  return /^(\+?880)?01[3-9]\d{8}$/.test(normalized);
}

// Background task: Send Facebook CAPI event
async function sendCapiEvent(
  supabaseUrl: string,
  phone: string,
  name: string,
  total: number,
  itemsFinal: Array<{ productId: string | null; name: string; quantity: number }>,
  orderId: string
) {
  try {
    console.log('Sending Purchase event to Facebook CAPI...');
    const capiUrl = `${supabaseUrl}/functions/v1/facebook-capi`;
    const capiResponse = await fetch(capiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_name: 'Purchase',
        user_data: {
          phone: phone,
          first_name: name.split(' ')[0] || name,
          last_name: name.split(' ').slice(1).join(' ') || undefined,
        },
        custom_data: {
          currency: 'BDT',
          value: total,
          content_ids: itemsFinal.map((i) => i.productId || i.name),
          content_type: 'product',
          num_items: itemsFinal.reduce((sum, i) => sum + i.quantity, 0),
          order_id: orderId,
        },
        event_source_url: 'https://shop.example.com/checkout',
      }),
    });
    const capiResult = await capiResponse.json();
    console.log('CAPI response:', JSON.stringify(capiResult));
  } catch (capiError) {
    console.error('Failed to send CAPI event:', capiError);
  }
}

// Background task: Send order email notification
async function sendOrderEmail(
  supabaseUrl: string,
  orderId: string,
  orderNumber: string,
  name: string,
  phone: string,
  address: string,
  subtotal: number,
  shippingCost: number,
  total: number,
  items: Array<{ productId: string | null; name: string; image: string | null; price: number; quantity: number }>,
  notes: string | null
) {
  try {
    console.log('Sending order email notification...');
    const emailUrl = `${supabaseUrl}/functions/v1/send-order-email`;
    const emailResponse = await fetch(emailUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: orderId,
        order_number: orderNumber,
        customer_name: name,
        customer_phone: phone,
        customer_address: address,
        subtotal,
        shipping_cost: shippingCost,
        total,
        items: items.map(i => ({
          name: i.name,
          quantity: i.quantity,
          price: i.price,
          image: i.image,
        })),
        notes,
      }),
    });
    const emailResult = await emailResponse.json();
    console.log('Email notification response:', JSON.stringify(emailResult));
  } catch (emailError) {
    console.error('Failed to send order email:', emailError);
  }
}

// Background task: Send SMS notification
async function sendOrderSms(
  supabaseUrl: string,
  serviceKey: string,
  phone: string,
  name: string,
  orderNumber: string,
  total: number,
  orderId: string
) {
  try {
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    
    const { data: smsSettings } = await supabase
      .from('admin_settings')
      .select('key, value')
      .in('key', ['sms_enabled', 'sms_auto_send_order_placed']);

    const settings: Record<string, string> = {};
    smsSettings?.forEach((s: { key: string; value: string }) => {
      settings[s.key] = s.value;
    });

    if (settings.sms_enabled === 'true' && settings.sms_auto_send_order_placed === 'true') {
      console.log('Sending order confirmation SMS...');
      const smsUrl = `${supabaseUrl}/functions/v1/send-sms`;
      const smsResponse = await fetch(smsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone,
          template_key: 'order_placed',
          order_id: orderId,
          variables: {
            customer_name: name,
            order_number: orderNumber,
            total: total.toString(),
          },
        }),
      });
      const smsResult = await smsResponse.json();
      console.log('SMS response:', JSON.stringify(smsResult));
    }
  } catch (smsError) {
    console.error('Failed to send order SMS:', smsError);
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: 'Server not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      db: { schema: 'public' },
      global: { headers: { Authorization: `Bearer ${serviceKey}` } },
    });

    const body = (await req.json()) as PlaceOrderBody;

    // Basic validation
    const name = (body?.shipping?.name ?? '').trim();
    const phone = (body?.shipping?.phone ?? '').trim();
    const address = (body?.shipping?.address ?? '').trim();

    if (!name || name.length > 100) {
      return new Response(JSON.stringify({ error: 'Invalid name' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!phone || phone.length > 30 || !isBangladeshPhone(phone)) {
      return new Response(JSON.stringify({ error: 'Invalid phone number' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!address || address.length > 300) {
      return new Response(JSON.stringify({ error: 'Invalid address' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === ORDER PROTECTION: Time-Based Blocking ===
    // Check if time-based blocking is enabled and enforce cooldown
    const { data: protectionSettings } = await supabase
      .from('admin_settings')
      .select('key, value')
      .in('key', ['order_protection_time_blocking_enabled', 'order_protection_order_cooldown_hours']);
    
    const protectionMap: Record<string, string> = {};
    protectionSettings?.forEach((s: { key: string; value: string }) => {
      protectionMap[s.key] = s.value;
    });
    
    const timeBlockingEnabled = protectionMap['order_protection_time_blocking_enabled'] === 'true';
    const cooldownHours = parseInt(protectionMap['order_protection_order_cooldown_hours']) || 12;
    
    if (timeBlockingEnabled) {
      // Normalize phone number for comparison
      const normalizedPhone = phone.replace(/\s/g, '').replace(/^\+?880/, '0');
      
      // Calculate the cutoff time
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - cooldownHours);
      
      // Check for recent orders from this phone number
      const { data: recentOrders, error: recentError } = await supabase
        .from('orders')
        .select('id, created_at, order_number')
        .or(`shipping_phone.eq.${phone},shipping_phone.eq.${normalizedPhone},shipping_phone.eq.+880${normalizedPhone.substring(1)}`)
        .gte('created_at', cutoffTime.toISOString())
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (!recentError && recentOrders && recentOrders.length > 0) {
        const lastOrder = recentOrders[0];
        const lastOrderTime = new Date(lastOrder.created_at);
        const hoursAgo = Math.round((Date.now() - lastOrderTime.getTime()) / (1000 * 60 * 60));
        const waitHours = cooldownHours - hoursAgo;
        
        console.log(`Time-based blocking: Phone ${phone} has recent order ${lastOrder.order_number} from ${hoursAgo}h ago`);
        
        return new Response(
          JSON.stringify({ 
            error: `আপনি সম্প্রতি একটি অর্ডার করেছেন। অনুগ্রহ করে আরও ${waitHours} ঘন্টা পরে আবার চেষ্টা করুন।`,
            errorCode: 'TIME_BLOCKED',
            lastOrderNumber: lastOrder.order_number,
            waitHours: waitHours,
          }),
          {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    if (!Array.isArray(body?.items) || body.items.length === 0 || body.items.length > 50) {
      return new Response(JSON.stringify({ error: 'Cart is empty' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    const cleanItems = body.items
      .map((i) => ({
        productId: String(i.productId || '').trim(),
        variationId: typeof i.variationId === 'string' ? i.variationId.trim() : undefined,
        quantity: Number(i.quantity || 0),
        productName: typeof i.productName === 'string' ? i.productName.trim() : undefined,
        productImage: typeof i.productImage === 'string' ? i.productImage.trim() : null,
        price: typeof i.price === 'number' ? Number(i.price) : undefined,
      }))
      .filter((i) => i.productId && Number.isFinite(i.quantity) && i.quantity > 0 && i.quantity <= 99);

    if (cleanItems.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid items' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Split between DB-backed UUID items and mock/custom items
    const uuidItems = cleanItems.filter((i) => uuidRegex.test(i.productId));
    const customItems = cleanItems.filter((i) => !uuidRegex.test(i.productId));

    // Fetch products for UUID items & compute totals from DB values (prevents client tampering)
    const productById = new Map<string, { id: string; name: string; price: number; images: string[] | null }>();
    const variationById = new Map<string, { id: string; product_id: string; name: string; price: number }>();

    if (uuidItems.length > 0) {
      const productIds = Array.from(new Set(uuidItems.map((i) => i.productId)));

      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name, price, images')
        .in('id', productIds)
        .eq('is_active', true);

      if (productsError) throw productsError;

      for (const p of products ?? []) {
        productById.set(p.id, {
          id: p.id,
          name: p.name,
          price: Number(p.price),
          images: (p.images as unknown as string[] | null) ?? null,
        });
      }

      const variationIds = Array.from(
        new Set(uuidItems.map((i) => i.variationId).filter((v): v is string => !!v && uuidRegex.test(v)))
      );

      if (variationIds.length > 0) {
        const { data: variations, error: variationsError } = await supabase
          .from('product_variations')
          .select('id, product_id, name, price')
          .in('id', variationIds)
          .eq('is_active', true);

        if (variationsError) throw variationsError;

        for (const v of variations ?? []) {
          variationById.set(v.id, {
            id: v.id,
            product_id: v.product_id,
            name: v.name,
            price: Number(v.price),
          });
        }
      }
    }

    const enrichedDbItems = uuidItems.map((i) => {
      const p = productById.get(i.productId);
      if (!p) return null;

      const v = i.variationId ? variationById.get(i.variationId) : undefined;
      if (i.variationId && !v) return null;
      if (v && v.product_id !== p.id) return null;

      return {
        productId: p.id,
        variationId: v?.id ?? null,
        variationName: v?.name ?? null,
        name: v ? `${p.name} (${v.name})` : p.name,
        image: p.images?.[0] ?? null,
        price: v ? Number(v.price) : Number(p.price),
        quantity: i.quantity,
      };
    });

    if (enrichedDbItems.some((x) => x === null)) {
      return new Response(JSON.stringify({ error: 'Some items are unavailable' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const enrichedCustomItems = customItems.map((i) => {
      const itemName = (i.productName ?? '').trim();
      const price = Number(i.price);
      const image = i.productImage ? i.productImage.trim() : null;

      if (!itemName || itemName.length > 150) return null;
      if (!Number.isFinite(price) || price <= 0 || price > 10_000_000) return null;
      if (image && image.length > 2048) return null;

      return {
        productId: null as string | null,
        variationId: null as string | null,
        variationName: null as string | null,
        name: itemName,
        image,
        price,
        quantity: i.quantity,
      };
    });

    if (enrichedCustomItems.some((x) => x === null)) {
      return new Response(JSON.stringify({ error: 'Invalid items' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const itemsFinal = [
      ...(enrichedDbItems as Array<{
        productId: string | null;
        variationId: string | null;
        variationName: string | null;
        name: string;
        image: string | null;
        price: number;
        quantity: number;
      }>),
      ...(enrichedCustomItems as Array<{
        productId: string | null;
        variationId: string | null;
        variationName: string | null;
        name: string;
        image: string | null;
        price: number;
        quantity: number;
      }>),
    ];

    const subtotal = itemsFinal.reduce((sum, i) => sum + i.price * i.quantity, 0);
    
    // Shipping cost based on zone: Inside Dhaka = 80 TK, Outside Dhaka = 130 TK
    const shippingZone = body.shippingZone || 'outside_dhaka';
    const shippingCost = shippingZone === 'inside_dhaka' ? 80 : 130;
    const total = subtotal + shippingCost;
    
    // Parse notes and order source
    const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 500) : null;
    const orderSource = body.orderSource === 'manual' ? 'manual' : 'web';

    const orderId = crypto.randomUUID();

    // Insert order first (order_items has FK to orders)
    const { error: orderError } = await supabase.from('orders').insert([
      {
        id: orderId,
        user_id: body.userId ?? null,
        order_number: '',
        status: 'pending',
        payment_method: 'cod',
        payment_status: 'pending',
        subtotal,
        shipping_cost: shippingCost,
        discount: 0,
        total,
        shipping_name: name,
        shipping_phone: phone,
        shipping_street: address,
        shipping_city: 'N/A',
        shipping_district: 'N/A',
        shipping_postal_code: null,
        notes,
        order_source: orderSource,
      },
    ]);

    if (orderError) throw orderError;

    // Now insert order items
    const { error: itemsError } = await supabase.from('order_items').insert(
      itemsFinal.map((i) => ({
        order_id: orderId,
        product_id: i.productId,
        variation_id: i.variationId,
        product_name: i.name,
        variation_name: i.variationName,
        product_image: i.image,
        price: i.price,
        quantity: i.quantity,
      }))
    );

    if (itemsError) throw itemsError;

    // Fetch generated order number (fast query)
    const { data: orderData } = await supabase
      .from('orders')
      .select('order_number')
      .eq('id', orderId)
      .single();
    
    const orderNumber = orderData?.order_number || orderId;

    // Schedule background tasks using EdgeRuntime.waitUntil
    // These run after the response is sent, so the user doesn't wait
    const backgroundTasks = Promise.all([
      sendCapiEvent(supabaseUrl, phone, name, total, itemsFinal, orderId),
      sendOrderSms(supabaseUrl, serviceKey, phone, name, orderNumber, total, orderId),
      sendOrderEmail(supabaseUrl, orderId, orderNumber, name, phone, address, subtotal, shippingCost, total, itemsFinal, notes),
    ]);

    // Use EdgeRuntime.waitUntil to run tasks in background after response
    // @ts-ignore - EdgeRuntime is available in Deno Deploy
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(backgroundTasks);
    } else {
      // Fallback: don't await, let it run in background
      backgroundTasks.catch(err => console.error('Background task error:', err));
    }

    // Return immediately - background tasks will continue
    return new Response(
      JSON.stringify({
        orderId,
        orderNumber,
        subtotal,
        shippingCost,
        total,
        items: itemsFinal,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error('place-order error:', err);
    return new Response(JSON.stringify({ error: 'Failed to place order' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
