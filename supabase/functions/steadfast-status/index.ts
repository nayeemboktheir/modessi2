import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StatusRequest {
  tracking_codes?: string[];
  invoices?: string[];
}

interface SteadfastStatus {
  tracking_code: string;
  consignment_id?: string;
  invoice?: string;
  recipient_name?: string;
  recipient_phone?: string;
  recipient_address?: string;
  cod_amount?: number;
  delivery_status?: string;
  current_status?: string;
  rider_name?: string;
  rider_phone?: string;
  updated_at?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getCredentials(supabase: any) {
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

  if (!apiKey) apiKey = Deno.env.get('STEADFAST_API_KEY') || '';
  if (!secretKey) secretKey = Deno.env.get('STEADFAST_SECRET_KEY') || '';

  return { apiKey, secretKey };
}

async function getStatusByTrackingCode(
  trackingCode: string,
  apiKey: string,
  secretKey: string
): Promise<{ success: boolean; data?: SteadfastStatus; error?: string }> {
  try {
    const response = await fetch(
      `https://portal.packzy.com/api/v1/status_by_trackingcode/${trackingCode}`,
      {
        method: 'GET',
        headers: {
          'Api-Key': apiKey,
          'Secret-Key': secretKey,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();
    console.log(`Status for ${trackingCode}:`, JSON.stringify(data));

    if (!response.ok || data.status !== 200) {
      return {
        success: false,
        error: data.message || 'Failed to get status',
      };
    }

    return {
      success: true,
      data: {
        tracking_code: trackingCode,
        consignment_id: data.consignment?.consignment_id,
        invoice: data.consignment?.invoice,
        recipient_name: data.consignment?.recipient_name,
        recipient_phone: data.consignment?.recipient_phone,
        recipient_address: data.consignment?.recipient_address,
        cod_amount: data.consignment?.cod_amount,
        delivery_status: data.consignment?.delivery_status,
        current_status: data.delivery_status || data.consignment?.delivery_status,
        rider_name: data.consignment?.rider_name,
        rider_phone: data.consignment?.rider_phone,
        updated_at: data.consignment?.updated_at,
      },
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error fetching status for ${trackingCode}:`, errorMessage);
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
        JSON.stringify({ error: 'Steadfast credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: StatusRequest = await req.json();
    const trackingCodes = body.tracking_codes || [];

    if (trackingCodes.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No tracking codes provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching status for ${trackingCodes.length} tracking codes`);

    const results: Record<string, SteadfastStatus | { error: string }> = {};

    // Fetch status for each tracking code (with rate limiting)
    for (const trackingCode of trackingCodes) {
      const result = await getStatusByTrackingCode(trackingCode, apiKey, secretKey);
      
      if (result.success && result.data) {
        results[trackingCode] = result.data;
      } else {
        results[trackingCode] = { error: result.error || 'Unknown error' };
      }

      // Small delay to avoid rate limiting
      if (trackingCodes.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        results 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in steadfast-status function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
