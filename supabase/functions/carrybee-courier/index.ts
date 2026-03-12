import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CarrybeeOrderRequest {
  orderId: string;
  store_id: string;
  merchant_order_id: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  cod_amount: number;
  city_id: number;
  zone_id: number;
  area_id?: number;
  note?: string;
  product_description?: string;
  item_weight?: number;
  item_quantity?: number;
}

interface CarrybeeCredentials {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  clientContext: string;
}

async function getCredentials(supabase: any): Promise<CarrybeeCredentials> {
  const { data: settings } = await supabase
    .from('admin_settings')
    .select('key, value')
    .in('key', [
      'carrybee_base_url',
      'carrybee_client_id',
      'carrybee_client_secret',
      'carrybee_client_context',
    ]);

  const creds: CarrybeeCredentials = {
    baseUrl: '',
    clientId: '',
    clientSecret: '',
    clientContext: '',
  };

  settings?.forEach((s: { key: string; value: string }) => {
    if (s.key === 'carrybee_base_url') creds.baseUrl = s.value;
    else if (s.key === 'carrybee_client_id') creds.clientId = s.value;
    else if (s.key === 'carrybee_client_secret') creds.clientSecret = s.value;
    else if (s.key === 'carrybee_client_context') creds.clientContext = s.value;
  });

  // Fallback to env
  if (!creds.baseUrl) creds.baseUrl = Deno.env.get('CARRYBEE_BASE_URL') || 'https://developers.carrybee.com';
  if (!creds.clientId) creds.clientId = Deno.env.get('CARRYBEE_CLIENT_ID') || '';
  if (!creds.clientSecret) creds.clientSecret = Deno.env.get('CARRYBEE_CLIENT_SECRET') || '';
  if (!creds.clientContext) creds.clientContext = Deno.env.get('CARRYBEE_CLIENT_CONTEXT') || '';

  return creds;
}

async function getDefaultStoreId(creds: CarrybeeCredentials): Promise<string | null> {
  try {
    const res = await fetch(`${creds.baseUrl}/api/v2/stores`, {
      headers: {
        'Client-ID': creds.clientId,
        'Client-Secret': creds.clientSecret,
        'Client-Context': creds.clientContext,
      },
    });
    const data = await res.json();
    if (data.error || !data.data?.stores) return null;
    // Find default pickup store or first active+approved store
    const defaultStore = data.data.stores.find((s: any) => s.is_default_pickup_store && s.is_active && s.is_approved);
    const activeStore = data.data.stores.find((s: any) => s.is_active && s.is_approved);
    return (defaultStore || activeStore)?.id || null;
  } catch {
    return null;
  }
}

async function getAddressDetails(creds: CarrybeeCredentials, address: string): Promise<{ city_id: number; zone_id: number } | null> {
  try {
    const query = address.length >= 10 ? address : address + ' Bangladesh';
    const res = await fetch(`${creds.baseUrl}/api/v2/address-details`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-ID': creds.clientId,
        'Client-Secret': creds.clientSecret,
        'Client-Context': creds.clientContext,
      },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();
    if (data.error || !data.data) return null;
    return { city_id: data.data.city_id, zone_id: data.data.zone_id };
  } catch {
    return null;
  }
}

async function createCarrybeeOrder(
  creds: CarrybeeCredentials,
  order: CarrybeeOrderRequest,
  storeId: string,
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const body: any = {
      store_id: storeId,
      merchant_order_id: order.merchant_order_id,
      delivery_type: 1, // Normal delivery
      product_type: 1, // Parcel
      recipient_phone: order.recipient_phone,
      recipient_name: order.recipient_name,
      recipient_address: order.recipient_address,
      city_id: order.city_id,
      zone_id: order.zone_id,
      collectable_amount: Math.round(order.cod_amount),
      item_weight: order.item_weight || 500,
      item_quantity: order.item_quantity || 1,
    };

    if (order.area_id) body.area_id = order.area_id;
    if (order.note) body.special_instruction = order.note.substring(0, 255);
    if (order.product_description) body.product_description = order.product_description.substring(0, 255);

    const res = await fetch(`${creds.baseUrl}/api/v2/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-ID': creds.clientId,
        'Client-Secret': creds.clientSecret,
        'Client-Context': creds.clientContext,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (data.error) {
      return { success: false, error: data.message || 'Failed to create Carrybee order', data };
    }

    return { success: true, data };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const creds = await getCredentials(supabase);

    if (!creds.clientId || !creds.clientSecret || !creds.clientContext) {
      return new Response(
        JSON.stringify({ error: 'Carrybee credentials not configured. Please add them in Admin → Courier Settings.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get store_id from admin_settings or fetch default
    const { data: storeSettings } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'carrybee_store_id')
      .single();

    let storeId = storeSettings?.value || '';
    if (!storeId) {
      storeId = await getDefaultStoreId(creds) || '';
    }

    if (!storeId) {
      return new Response(
        JSON.stringify({ error: 'No active Carrybee store found. Please create a store in your Carrybee portal first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();

    // Handle both single and bulk
    const ordersToProcess: CarrybeeOrderRequest[] = body.orders && Array.isArray(body.orders)
      ? body.orders
      : [body];

    const results: { orderId: string; success: boolean; consignment_id?: string; error?: string }[] = [];

    for (const order of ordersToProcess) {
      // If city_id/zone_id not provided, try to detect from address
      let cityId = order.city_id;
      let zoneId = order.zone_id;

      if (!cityId || !zoneId) {
        const detected = await getAddressDetails(creds, order.recipient_address);
        if (detected) {
          cityId = detected.city_id;
          zoneId = detected.zone_id;
        } else {
          // Default to Dhaka (14) if detection fails
          cityId = cityId || 14;
          zoneId = zoneId || 1;
        }
      }

      const orderWithLocation = { ...order, city_id: cityId, zone_id: zoneId };
      const result = await createCarrybeeOrder(creds, orderWithLocation, storeId);

      if (result.success && result.data?.data?.order) {
        const consignmentId = result.data.data.order.consignment_id;

        // Update order in DB
        if (order.orderId) {
          await supabase
            .from('orders')
            .update({
              tracking_number: consignmentId,
              steadfast_consignment_id: consignmentId, // reuse field for tracking
              status: 'processing',
            })
            .eq('id', order.orderId);
        }

        results.push({ orderId: order.orderId, success: true, consignment_id: consignmentId });
      } else {
        results.push({ orderId: order.orderId, success: false, error: result.error });
      }
    }

    if (ordersToProcess.length === 1) {
      const r = results[0];
      if (r.success) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Order sent to Carrybee successfully',
            consignment_id: r.consignment_id,
            tracking_code: r.consignment_id,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        return new Response(
          JSON.stringify({ error: r.error }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return new Response(
      JSON.stringify({
        success: failCount === 0,
        message: `Sent ${successCount} orders, ${failCount} failed`,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in carrybee-courier function:', error);
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
