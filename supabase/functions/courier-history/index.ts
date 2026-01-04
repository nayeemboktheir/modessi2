import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple in-memory cache to reduce API calls
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone } = await req.json();

    if (!phone) {
      return new Response(
        JSON.stringify({ error: 'Phone number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceKey) {
      console.error('Missing Supabase configuration');
      return new Response(
        JSON.stringify({ error: 'Server not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Clean phone number - remove +88 or 88 prefix if present
    let cleanPhone = phone.replace(/\s+/g, '').replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('88')) {
      cleanPhone = cleanPhone.substring(2);
    }
    // Ensure it starts with 0 for Bangladeshi numbers
    if (!cleanPhone.startsWith('0') && cleanPhone.length === 10) {
      cleanPhone = '0' + cleanPhone;
    }

    // Check cache first
    const cached = cache.get(cleanPhone);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      console.log('Returning cached courier history for phone:', cleanPhone);
      return new Response(
        JSON.stringify({ success: true, data: cached.data, cached: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch API key from admin_settings
    const { data: settings } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'bdcourier_api_key')
      .single();

    const BDCOURIER_API_KEY = settings?.value;
    
    if (!BDCOURIER_API_KEY) {
      console.error('BD Courier API key is not configured in admin settings');
      return new Response(
        JSON.stringify({ error: 'BD Courier API key not configured. Please add it in Shop Settings.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Checking courier history for phone:', cleanPhone);

    // BD Courier API endpoint
    const apiUrl = `https://bdcourier.com/api/courier-check?phone=${cleanPhone}`;
    
    console.log('Calling BD Courier API:', apiUrl);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${BDCOURIER_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    const responseText = await response.text();
    console.log('BD Courier API response status:', response.status);
    console.log('BD Courier API response:', responseText);

    // Handle rate limiting (429)
    if (response.status === 429) {
      console.error('BD Courier API rate limit reached');
      return new Response(
        JSON.stringify({ 
          success: false,
          rateLimited: true,
          message: 'BD Courier API rate limit reached. Please wait a few minutes and try again.'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!response.ok) {
      // Check if it's a Cloudflare challenge (bot protection)
      if (response.status === 403 && responseText.includes('challenge-platform')) {
        console.error('BD Courier API is blocking requests (Cloudflare protection)');
        return new Response(
          JSON.stringify({ 
            success: false,
            blocked: true,
            message: 'The courier history service is temporarily blocked. Please try again later or check manually at bdcourier.com'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch courier history',
          details: responseText 
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse response as JSON:', e);
      return new Response(
        JSON.stringify({ error: 'Invalid response from courier API' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Parsed courier data:', JSON.stringify(data));

    // Cache the result
    cache.set(cleanPhone, { data, timestamp: Date.now() });

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in courier-history function:', error);

    // If upstream is slow/unreachable, fail gracefully (don't break admin UI)
    const isAbort =
      (error instanceof DOMException && error.name === 'AbortError') ||
      (error instanceof Error && /abort/i.test(error.message));

    if (isAbort) {
      return new Response(
        JSON.stringify({
          success: false,
          blocked: true,
          message: 'Courier history service timed out. Please try again later or check manually at bdcourier.com',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
