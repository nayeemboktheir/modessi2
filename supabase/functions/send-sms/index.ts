import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendSmsRequest {
  phone: string;
  message?: string;
  template_key?: string;
  order_id?: string;
  variables?: Record<string, string>;
}

interface SmsSettings {
  sms_provider: string;
  sms_api_key: string;
  sms_sender_id: string;
  sms_enabled: string;
}

// Replace template variables with actual values
function replaceVariables(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
  }
  return result;
}

// Format Bangladesh phone number
function formatBDPhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  
  // Remove leading 0 if present
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  // Add country code if not present
  if (!cleaned.startsWith('880')) {
    cleaned = '880' + cleaned;
  }
  
  return cleaned;
}

// Send SMS via BulkSMSBD
async function sendViaBulkSMSBD(phone: string, message: string, apiKey: string, senderId: string): Promise<{ success: boolean; response: any }> {
  const formattedPhone = formatBDPhone(phone);
  
  const url = `https://bulksmsbd.net/api/smsapi`;
  const params = new URLSearchParams({
    api_key: apiKey,
    type: 'text',
    number: formattedPhone,
    senderid: senderId,
    message: message,
  });

  console.log(`Sending SMS to ${formattedPhone} via BulkSMSBD`);
  
  const response = await fetch(`${url}?${params.toString()}`);
  const result = await response.json();
  
  console.log('BulkSMSBD response:', result);
  
  return {
    success: result.response_code === 202 || result.response_code === '202',
    response: result,
  };
}

// Send SMS via SSL Wireless
async function sendViaSSLWireless(phone: string, message: string, apiKey: string, senderId: string): Promise<{ success: boolean; response: any }> {
  const formattedPhone = formatBDPhone(phone);
  
  const url = `https://smsplus.sslwireless.com/api/v3/send-sms`;
  
  console.log(`Sending SMS to ${formattedPhone} via SSL Wireless`);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      api_token: apiKey,
      sid: senderId,
      msisdn: formattedPhone,
      sms: message,
      csms_id: `order_${Date.now()}`,
    }),
  });
  
  const result = await response.json();
  console.log('SSL Wireless response:', result);
  
  return {
    success: result.status === 'SUCCESS',
    response: result,
  };
}

// Send SMS via Infobip
async function sendViaInfobip(phone: string, message: string, apiKey: string, senderId: string): Promise<{ success: boolean; response: any }> {
  const formattedPhone = formatBDPhone(phone);
  
  const baseUrl = 'https://api.infobip.com';
  
  console.log(`Sending SMS to ${formattedPhone} via Infobip`);
  
  const response = await fetch(`${baseUrl}/sms/2/text/advanced`, {
    method: 'POST',
    headers: {
      'Authorization': `App ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      messages: [{
        from: senderId,
        destinations: [{ to: formattedPhone }],
        text: message,
      }],
    }),
  });
  
  const result = await response.json();
  console.log('Infobip response:', result);
  
  return {
    success: response.ok,
    response: result,
  };
}

// Send SMS via Twilio
async function sendViaTwilio(phone: string, message: string, apiKey: string, senderId: string): Promise<{ success: boolean; response: any }> {
  const formattedPhone = '+' + formatBDPhone(phone);
  
  // apiKey format: accountSid:authToken
  const [accountSid, authToken] = apiKey.split(':');
  
  if (!accountSid || !authToken) {
    return {
      success: false,
      response: { error: 'Invalid Twilio credentials. Format: accountSid:authToken' },
    };
  }
  
  console.log(`Sending SMS to ${formattedPhone} via Twilio`);
  
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      To: formattedPhone,
      From: senderId,
      Body: message,
    }),
  });
  
  const result = await response.json();
  console.log('Twilio response:', result);
  
  return {
    success: response.ok,
    response: result,
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body: SendSmsRequest = await req.json();
    const { phone, message, template_key, order_id, variables = {} } = body;

    console.log('SMS request received:', { phone, template_key, order_id });

    // Fetch SMS settings
    const { data: settingsData, error: settingsError } = await supabase
      .from('admin_settings')
      .select('key, value')
      .in('key', ['sms_provider', 'sms_api_key', 'sms_sender_id', 'sms_enabled']);

    if (settingsError) {
      console.error('Error fetching SMS settings:', settingsError);
      throw new Error('Failed to fetch SMS settings');
    }

    const settings: Record<string, string> = {};
    settingsData?.forEach((s: { key: string; value: string }) => {
      settings[s.key] = s.value;
    });

    console.log('SMS Settings:', {
      provider: settings.sms_provider,
      enabled: settings.sms_enabled,
      hasApiKey: !!settings.sms_api_key,
      senderId: settings.sms_sender_id,
    });

    // Check if SMS is enabled
    if (settings.sms_enabled !== 'true') {
      console.log('SMS is disabled');
      return new Response(
        JSON.stringify({ success: false, message: 'SMS is disabled' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate required settings
    if (!settings.sms_api_key) {
      throw new Error('SMS API key not configured');
    }

    // Get message content
    let finalMessage = message || '';
    
    if (template_key && !message) {
      const { data: templateData, error: templateError } = await supabase
        .from('sms_templates')
        .select('message_template, is_active')
        .eq('template_key', template_key)
        .single();

      if (templateError || !templateData) {
        throw new Error(`Template '${template_key}' not found`);
      }

      if (!templateData.is_active) {
        console.log(`Template '${template_key}' is disabled`);
        return new Response(
          JSON.stringify({ success: false, message: 'Template is disabled' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      finalMessage = replaceVariables(templateData.message_template, variables);
    }

    if (!finalMessage) {
      throw new Error('No message content provided');
    }

    if (!phone) {
      throw new Error('Phone number is required');
    }

    console.log('Sending SMS:', { phone, messageLength: finalMessage.length });

    // Send SMS based on provider
    let result: { success: boolean; response: any };
    
    switch (settings.sms_provider) {
      case 'bulksmsbd':
        result = await sendViaBulkSMSBD(phone, finalMessage, settings.sms_api_key, settings.sms_sender_id);
        break;
      case 'sslwireless':
        result = await sendViaSSLWireless(phone, finalMessage, settings.sms_api_key, settings.sms_sender_id);
        break;
      case 'infobip':
        result = await sendViaInfobip(phone, finalMessage, settings.sms_api_key, settings.sms_sender_id);
        break;
      case 'twilio':
        result = await sendViaTwilio(phone, finalMessage, settings.sms_api_key, settings.sms_sender_id);
        break;
      default:
        throw new Error(`Unknown SMS provider: ${settings.sms_provider}`);
    }

    // Log the SMS
    const { error: logError } = await supabase
      .from('sms_logs')
      .insert({
        phone_number: phone,
        message: finalMessage,
        template_key: template_key || null,
        order_id: order_id || null,
        status: result.success ? 'sent' : 'failed',
        provider_response: result.response,
        error_message: result.success ? null : JSON.stringify(result.response),
        sent_at: result.success ? new Date().toISOString() : null,
      });

    if (logError) {
      console.error('Error logging SMS:', logError);
    }

    return new Response(
      JSON.stringify({
        success: result.success,
        message: result.success ? 'SMS sent successfully' : 'Failed to send SMS',
        response: result.response,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('SMS Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
