import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrderEmailRequest {
  order_id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  subtotal: number;
  shipping_cost: number;
  total: number;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    image?: string | null;
  }>;
  notes?: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceKey) {
      console.error('Missing Supabase configuration');
      return new Response(JSON.stringify({ success: false, message: 'Server not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Fetch email settings from admin_settings
    const { data: settings } = await supabase
      .from('admin_settings')
      .select('key, value')
      .in('key', ['resend_api_key', 'notification_email', 'order_notification_enabled']);

    const settingsMap: Record<string, string> = {};
    settings?.forEach((s: { key: string; value: string }) => {
      settingsMap[s.key] = s.value;
    });

    console.log('Email settings:', {
      hasApiKey: !!settingsMap.resend_api_key,
      notificationEmail: settingsMap.notification_email,
      orderNotificationEnabled: settingsMap.order_notification_enabled,
    });

    // Check if order notifications are enabled
    if (settingsMap.order_notification_enabled !== 'true') {
      console.log('Order email notifications are disabled');
      return new Response(JSON.stringify({ success: false, message: 'Order notifications disabled' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if we have the required settings
    if (!settingsMap.resend_api_key || !settingsMap.notification_email) {
      console.log('Missing Resend API key or notification email');
      return new Response(JSON.stringify({ success: false, message: 'Email not configured' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: OrderEmailRequest = await req.json();
    console.log('Sending order email for:', body.order_number);

    const resend = new Resend(settingsMap.resend_api_key);

    // Build items HTML
    const itemsHtml = body.items.map(item => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">
          ${item.name}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">
          ${item.quantity}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">
          ৳${item.price.toFixed(2)}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">
          ৳${(item.price * item.quantity).toFixed(2)}
        </td>
      </tr>
    `).join('');

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>New Order Received</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">🛒 New Order Received!</h1>
          <p style="margin: 10px 0 0; opacity: 0.9;">Order #${body.order_number}</p>
        </div>
        
        <div style="background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none;">
          <h2 style="color: #444; margin-top: 0;">Customer Details</h2>
          <table style="width: 100%; margin-bottom: 20px;">
            <tr>
              <td style="padding: 8px 0; color: #666;"><strong>Name:</strong></td>
              <td style="padding: 8px 0;">${body.customer_name}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;"><strong>Phone:</strong></td>
              <td style="padding: 8px 0;">${body.customer_phone}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;"><strong>Address:</strong></td>
              <td style="padding: 8px 0;">${body.customer_address}</td>
            </tr>
            ${body.notes ? `
            <tr>
              <td style="padding: 8px 0; color: #666;"><strong>Notes:</strong></td>
              <td style="padding: 8px 0;">${body.notes}</td>
            </tr>
            ` : ''}
          </table>

          <h2 style="color: #444;">Order Items</h2>
          <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden;">
            <thead>
              <tr style="background: #f0f0f0;">
                <th style="padding: 12px; text-align: left;">Product</th>
                <th style="padding: 12px; text-align: center;">Qty</th>
                <th style="padding: 12px; text-align: right;">Price</th>
                <th style="padding: 12px; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div style="margin-top: 20px; padding: 15px; background: white; border-radius: 8px;">
            <table style="width: 100%;">
              <tr>
                <td style="padding: 8px 0; color: #666;">Subtotal:</td>
                <td style="padding: 8px 0; text-align: right;">৳${body.subtotal.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Shipping:</td>
                <td style="padding: 8px 0; text-align: right;">৳${body.shipping_cost.toFixed(2)}</td>
              </tr>
              <tr style="font-size: 18px; font-weight: bold;">
                <td style="padding: 12px 0; border-top: 2px solid #ddd;">Total:</td>
                <td style="padding: 12px 0; text-align: right; border-top: 2px solid #ddd; color: #667eea;">৳${body.total.toFixed(2)}</td>
              </tr>
            </table>
          </div>
        </div>

        <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
          <p>This is an automated notification from your store.</p>
        </div>
      </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: 'Store Orders <onboarding@resend.dev>',
      to: [settingsMap.notification_email],
      subject: `🛒 New Order #${body.order_number} - ৳${body.total.toFixed(2)}`,
      html: emailHtml,
    });

    console.log('Email sent successfully:', emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error sending order email:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
