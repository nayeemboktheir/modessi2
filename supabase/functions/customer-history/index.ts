import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Clean phone number - normalize for matching
    let cleanPhone = phone.replace(/\s+/g, '').replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('88')) {
      cleanPhone = cleanPhone.substring(2);
    }
    if (!cleanPhone.startsWith('0') && cleanPhone.length === 10) {
      cleanPhone = '0' + cleanPhone;
    }

    // Create phone variations for matching (with/without leading 0, with 88 prefix)
    const phoneVariations = [
      cleanPhone,
      cleanPhone.startsWith('0') ? cleanPhone.substring(1) : `0${cleanPhone}`,
      `88${cleanPhone}`,
      `+88${cleanPhone}`,
    ];

    console.log('Checking customer history for phone variations:', phoneVariations);

    // Query orders with any of these phone variations
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, order_number, status, total, created_at, shipping_name')
      .or(phoneVariations.map(p => `shipping_phone.ilike.%${p.slice(-10)}%`).join(','))
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching orders:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch customer history' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate statistics
    const totalOrders = orders?.length || 0;
    
    // Status categorization
    const deliveredStatuses = ['delivered', 'completed'];
    const cancelledStatuses = ['cancelled', 'returned', 'refunded'];
    const pendingStatuses = ['pending', 'processing', 'shipped', 'in_transit', 'on_hold'];
    
    const delivered = orders?.filter(o => deliveredStatuses.includes(o.status?.toLowerCase())) || [];
    const cancelled = orders?.filter(o => cancelledStatuses.includes(o.status?.toLowerCase())) || [];
    const pending = orders?.filter(o => pendingStatuses.includes(o.status?.toLowerCase())) || [];

    const deliveredCount = delivered.length;
    const cancelledCount = cancelled.length;
    const pendingCount = pending.length;
    
    // Calculate success ratio (exclude pending orders from ratio calculation)
    const completedOrders = deliveredCount + cancelledCount;
    const successRatio = completedOrders > 0 ? (deliveredCount / completedOrders) * 100 : null;

    // Calculate total spent (only delivered orders)
    const totalSpent = delivered.reduce((sum, o) => sum + (o.total || 0), 0);

    // Get customer name from most recent order
    const customerName = orders?.[0]?.shipping_name || null;

    // Determine risk level
    let riskLevel: 'new' | 'low' | 'medium' | 'high' = 'new';
    if (totalOrders === 0) {
      riskLevel = 'new';
    } else if (successRatio !== null) {
      if (successRatio >= 80) {
        riskLevel = 'low';
      } else if (successRatio >= 50) {
        riskLevel = 'medium';
      } else {
        riskLevel = 'high';
      }
    }

    // Recent orders for display (last 5)
    const recentOrders = orders?.slice(0, 5).map(o => ({
      order_number: o.order_number,
      status: o.status,
      total: o.total,
      date: o.created_at,
    })) || [];

    const result = {
      success: true,
      data: {
        phone: cleanPhone,
        customer_name: customerName,
        summary: {
          total_orders: totalOrders,
          delivered: deliveredCount,
          cancelled: cancelledCount,
          pending: pendingCount,
          success_ratio: successRatio !== null ? Math.round(successRatio * 10) / 10 : null,
          total_spent: totalSpent,
          risk_level: riskLevel,
        },
        recent_orders: recentOrders,
      },
    };

    console.log('Customer history result:', JSON.stringify(result));

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in customer-history function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
