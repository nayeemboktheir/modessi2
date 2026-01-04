import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const response = await fetch('https://portal.packzy.com/api/v1/create_order', {
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
      
      const results: { orderId: string; success: boolean; tracking_code?: string; error?: string }[] = [];
      
      for (const order of body.orders as SteadfastOrderRequest[]) {
        const result = await sendToSteadfast(order, apiKey, secretKey);
        
        if (result.success && result.data) {
          const consignmentData = result.data as { consignment?: { consignment_id?: string; tracking_code?: string } };
          const trackingCode = consignmentData.consignment?.tracking_code || consignmentData.consignment?.consignment_id;
          
          // Update order with tracking
          if (order.orderId) {
            await supabase
              .from('orders')
              .update({ tracking_number: trackingCode, status: 'processing' })
              .eq('id', order.orderId);
          }
          
          results.push({ orderId: order.orderId, success: true, tracking_code: trackingCode });
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
        .update({ tracking_number: trackingCode || consignmentId, status: 'processing' })
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
