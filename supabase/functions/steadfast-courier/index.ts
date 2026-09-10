import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SteadfastOrderRequest {
  orderId: string;
  invoice: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  cod_amount: number;
  note?: string;
}

interface BulkOrderRequest {
  orders: SteadfastOrderRequest[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
// Courier APIs occasionally hang. Without a deadline one stalled call blocks the whole
// request — and inside a bulk loop, every order behind it — until the router kills the
// worker at 150s.
const UPSTREAM_TIMEOUT_MS = 20_000;

async function fetchWithTimeout(input: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function getCredentials(supabase: any) {
  // First try to get from admin_settings table
  const { data: settings } = await supabase
    .from('admin_settings')
    .select('key, value')
    .in('key', ['steadfast_api_key', 'steadfast_secret_key']);

  let apiKey = '';
  let secretKey = '';

  settings?.forEach((setting: { key: string; value: string }) => {
    if (setting.key === 'steadfast_api_key') {
      apiKey = setting.value;
    } else if (setting.key === 'steadfast_secret_key') {
      secretKey = setting.value;
    }
  });

  // Fallback to environment variables
  if (!apiKey) apiKey = Deno.env.get('STEADFAST_API_KEY') || '';
  if (!secretKey) secretKey = Deno.env.get('STEADFAST_SECRET_KEY') || '';

  return { apiKey, secretKey };
}

async function sendToSteadfast(
  order: SteadfastOrderRequest,
  apiKey: string,
  secretKey: string
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const response = await fetchWithTimeout('https://portal.packzy.com/api/v1/create_order', {
      method: 'POST',
      headers: {
        'Api-Key': apiKey,
        'Secret-Key': secretKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        invoice: order.invoice,
        recipient_name: order.recipient_name,
        recipient_phone: order.recipient_phone,
        recipient_address: order.recipient_address,
        cod_amount: order.cod_amount,
        note: order.note || '',
      }),
    });

    const data = await response.json();
    
    if (!response.ok || data.status !== 200) {
      return { 
        success: false, 
        error: data.message || 'Failed to create Steadfast order',
        data 
      };
    }

    return { success: true, data };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

// Orders that already carry a tracking number were sent to a courier before. Sending
// again books — and bills — a second physical delivery, which a double-click, a retry
// after a slow response, or a re-selected bulk batch would otherwise do silently.
async function findAlreadyDispatched(
  supabase: { from: (t: string) => any },
  orderIds: string[],
): Promise<Map<string, string>> {
  const ids = orderIds.filter(Boolean);
  if (ids.length === 0) return new Map();

  const { data, error } = await supabase
    .from('orders')
    .select('id, tracking_number')
    .in('id', ids)
    .not('tracking_number', 'is', null);

  if (error) {
    console.error('Could not check existing consignments:', error.message);
    return new Map();
  }

  return new Map(
    (data ?? [])
      .filter((row: { tracking_number: string | null }) => !!row.tracking_number)
      .map((row: { id: string; tracking_number: string }) => [row.id, row.tracking_number]),
  );
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
    const auth = await requireAdmin(req);
    if (!auth.ok) return auth.response;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { apiKey, secretKey } = await getCredentials(supabase);

    if (!apiKey || !secretKey) {
      console.error('Steadfast credentials not configured');
      return new Response(
        JSON.stringify({ error: 'Steadfast credentials not configured. Please add them in Admin → Steadfast settings.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    
    // Check if it's a bulk request
    if (body.orders && Array.isArray(body.orders)) {
      console.log(`Processing bulk order: ${body.orders.length} orders`);
      
      const results: { orderId: string; success: boolean; tracking_code?: string; consignment_id?: string; error?: string }[] = [];

      const alreadySent = await findAlreadyDispatched(
        supabase,
        (body.orders as SteadfastOrderRequest[]).map((o) => o.orderId),
      );

      for (const order of body.orders as SteadfastOrderRequest[]) {
        const existing = order.orderId ? alreadySent.get(order.orderId) : undefined;
        if (existing) {
          console.log(`Skipping order ${order.orderId}: already dispatched as ${existing}`);
          results.push({ orderId: order.orderId, success: true, tracking_code: existing, consignment_id: existing });
          continue;
        }

        const result = await sendToSteadfast(order, apiKey, secretKey);
        
        if (result.success && result.data) {
          const consignmentData = result.data as { consignment?: { consignment_id?: string; tracking_code?: string } };
          const consignmentId = consignmentData.consignment?.consignment_id;
          const trackingCode = consignmentData.consignment?.tracking_code || consignmentId;
          
          // Update order with tracking and consignment ID
          if (order.orderId) {
            await supabase
              .from('orders')
              .update({ 
                tracking_number: trackingCode, 
                steadfast_consignment_id: consignmentId,
                status: 'processing' 
              })
              .eq('id', order.orderId);
          }
          
          results.push({ orderId: order.orderId, success: true, tracking_code: trackingCode, consignment_id: consignmentId });
        } else {
          results.push({ orderId: order.orderId, success: false, error: result.error });
        }
      }
      
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      
      return new Response(
        JSON.stringify({ 
          success: failCount === 0,
          message: `Sent ${successCount} orders, ${failCount} failed`,
          results 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Single order request
    const order = body as SteadfastOrderRequest;
    console.log('Creating Steadfast order for:', order.invoice);

    if (order.orderId) {
      const existing = (await findAlreadyDispatched(supabase, [order.orderId])).get(order.orderId);
      if (existing) {
        return new Response(
          JSON.stringify({
            success: true,
            alreadyDispatched: true,
            message: 'Order was already sent to a courier',
            consignment_id: existing,
            tracking_code: existing,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (!order.invoice || !order.recipient_name || !order.recipient_phone || !order.recipient_address || order.cod_amount === undefined) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await sendToSteadfast(order, apiKey, secretKey);
    
    if (!result.success) {
      console.error('Steadfast API error:', result.error);
      return new Response(
        JSON.stringify({ error: result.error, details: result.data }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const consignmentData = result.data as { consignment?: { consignment_id?: string; tracking_code?: string } };
    const consignmentId = consignmentData.consignment?.consignment_id;
    const trackingCode = consignmentData.consignment?.tracking_code;

    if ((consignmentId || trackingCode) && order.orderId) {
      await supabase
        .from('orders')
        .update({ 
          tracking_number: trackingCode || consignmentId, 
          steadfast_consignment_id: consignmentId,
          status: 'processing' 
        })
        .eq('id', order.orderId);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Order sent to Steadfast successfully',
        consignment_id: consignmentId,
        tracking_code: trackingCode,
        data: result.data
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in steadfast-courier function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
