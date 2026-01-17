import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConversionEvent {
  event_name: string;
  event_time: number;
  event_id?: string; // For deduplication with browser pixel
  action_source: string;
  event_source_url?: string;
  user_data: {
    em?: string[];
    ph?: string[];
    fn?: string[];
    ln?: string[];
    ct?: string[]; // City
    st?: string[]; // State/Region
    zp?: string[]; // Zip/Postal code
    country?: string[]; // Country code
    external_id?: string[];
    client_ip_address?: string;
    client_user_agent?: string;
    fbc?: string;
    fbp?: string;
  };
  custom_data?: {
    currency?: string;
    value?: number;
    content_ids?: string[];
    content_type?: string;
    content_name?: string;
    num_items?: number;
    order_id?: string;
  };
}

interface RequestBody {
  event_name: string;
  user_data: {
    email?: string;
    phone?: string;
    first_name?: string;
    last_name?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
    external_id?: string;
    fbc?: string; // Click ID cookie
    fbp?: string; // Browser ID cookie
  };
  custom_data?: {
    currency?: string;
    value?: number;
    content_ids?: string[];
    content_type?: string;
    content_name?: string;
    num_items?: number;
    order_id?: string;
  };
  event_source_url?: string;
  event_id?: string; // For deduplication
}

// Hash function for user data (SHA-256)
async function hashData(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  console.log("Facebook CAPI function invoked");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    console.log("Supabase URL:", supabaseUrl ? "Set" : "Missing");
    console.log("Service Role Key:", serviceRoleKey ? "Set" : "Missing");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing Supabase configuration");
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, serviceRoleKey);

    // Fetch CAPI settings from admin_settings
    // Support both fb_capi_token and fb_capi_access_token key names for flexibility
    const { data: settings, error: settingsError } = await supabaseClient
      .from("admin_settings")
      .select("key, value")
      .in("key", ["fb_pixel_id", "fb_capi_token", "fb_capi_access_token", "fb_capi_enabled", "fb_test_event_code"]);

    if (settingsError) {
      console.error("Failed to fetch settings:", settingsError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch settings" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Fetched settings count:", settings?.length || 0);

    let pixelId = "";
    let capiToken = "";
    let capiEnabled = false;
    let testEventCode = "";

    settings?.forEach((setting: { key: string; value: string }) => {
      const isSecret = setting.key.includes('token') || setting.key.includes('access');
      console.log(`Setting: ${setting.key} = ${isSecret ? '[REDACTED]' : setting.value}`);
      switch (setting.key) {
        case "fb_pixel_id":
          pixelId = setting.value;
          break;
        case "fb_capi_token":
        case "fb_capi_access_token":
          // Support both key names - use whichever is available
          if (!capiToken && setting.value) {
            capiToken = setting.value;
          }
          break;
        case "fb_capi_enabled":
          capiEnabled = setting.value === "true";
          break;
        case "fb_test_event_code":
          testEventCode = setting.value;
          break;
      }
    });

    console.log("CAPI Config - Enabled:", capiEnabled, "Pixel ID:", pixelId, "Has Token:", !!capiToken, "Test Code:", testEventCode);

    if (!capiEnabled) {
      console.log("CAPI is disabled");
      return new Response(
        JSON.stringify({ success: false, message: "CAPI is disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!pixelId) {
      console.log("Missing Pixel ID");
      return new Response(
        JSON.stringify({ success: false, message: "Missing Pixel ID" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!capiToken) {
      console.log("Missing CAPI token");
      return new Response(
        JSON.stringify({ success: false, message: "Missing CAPI token" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: RequestBody = await req.json();
    console.log("Received event:", body.event_name);
    console.log("User data:", JSON.stringify(body.user_data));
    console.log("Custom data:", JSON.stringify(body.custom_data));

    // Build user data with hashing
    const userData: ConversionEvent["user_data"] = {
      client_ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || undefined,
      client_user_agent: req.headers.get("user-agent") || undefined,
    };

    // Hash and add email
    if (body.user_data.email) {
      userData.em = [await hashData(body.user_data.email)];
      console.log("Added hashed email");
    }
    
    // Hash and add phone with Bangladesh country code normalization
    if (body.user_data.phone) {
      let cleanPhone = body.user_data.phone.replace(/\D/g, "");
      // Add Bangladesh country code if not present
      if (cleanPhone.startsWith("01")) {
        cleanPhone = "880" + cleanPhone;
      } else if (!cleanPhone.startsWith("880")) {
        cleanPhone = "880" + cleanPhone;
      }
      userData.ph = [await hashData(cleanPhone)];
      console.log("Added hashed phone");
    }
    
    // Hash and add name
    if (body.user_data.first_name) {
      userData.fn = [await hashData(body.user_data.first_name)];
      console.log("Added hashed first name");
    }
    if (body.user_data.last_name) {
      userData.ln = [await hashData(body.user_data.last_name)];
      console.log("Added hashed last name");
    }
    
    // Hash and add city (important for match quality)
    if (body.user_data.city) {
      userData.ct = [await hashData(body.user_data.city)];
      console.log("Added hashed city");
    }
    
    // Hash and add state/region
    if (body.user_data.state) {
      userData.st = [await hashData(body.user_data.state)];
      console.log("Added hashed state");
    }
    
    // Hash and add zip code
    if (body.user_data.zip) {
      userData.zp = [await hashData(body.user_data.zip)];
      console.log("Added hashed zip");
    }
    
    // Add country - default to Bangladesh (bd)
    userData.country = [await hashData(body.user_data.country || "bd")];
    console.log("Added hashed country");
    
    // Add external ID for cross-device tracking (already hashed by client or use as-is)
    if (body.user_data.external_id) {
      userData.external_id = [body.user_data.external_id];
      console.log("Added external_id for deduplication");
    }
    
    // Add click ID (fbc) - this is the Meta ClickID for better attribution
    if (body.user_data.fbc) {
      userData.fbc = body.user_data.fbc;
      console.log("Added fbc (Meta ClickID) for attribution");
    }
    
    // Add browser ID (fbp) for better matching
    if (body.user_data.fbp) {
      userData.fbp = body.user_data.fbp;
      console.log("Added fbp (browser ID) for matching");
    }

    // Generate event ID for deduplication with browser pixel
    const eventId = body.event_id || `${body.event_name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Build the event
    const event: ConversionEvent = {
      event_name: body.event_name,
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      action_source: "website",
      event_source_url: body.event_source_url || "https://naturaltouchbd.net",
      user_data: userData,
    };

    if (body.custom_data) {
      event.custom_data = body.custom_data;
    }
    
    console.log("Event match parameters:", {
      has_email: !!userData.em,
      has_phone: !!userData.ph,
      has_external_id: !!userData.external_id,
      has_fbc: !!userData.fbc,
      has_fbp: !!userData.fbp,
      has_ip: !!userData.client_ip_address,
      has_ua: !!userData.client_user_agent,
    });

    // Build request payload
    const payload: { data: ConversionEvent[]; test_event_code?: string } = {
      data: [event],
    };

    if (testEventCode && testEventCode.trim()) {
      payload.test_event_code = testEventCode.trim();
      console.log("Using test event code:", testEventCode);
    }

    console.log("Sending to Facebook CAPI:", JSON.stringify(payload, null, 2));

    // Send to Facebook Conversions API
    const fbUrl = `https://graph.facebook.com/v18.0/${pixelId}/events?access_token=${capiToken}`;
    console.log("Facebook API URL (token redacted):", `https://graph.facebook.com/v18.0/${pixelId}/events?access_token=[REDACTED]`);

    const fbResponse = await fetch(fbUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const fbResult = await fbResponse.json();
    console.log("Facebook CAPI response status:", fbResponse.status);
    console.log("Facebook CAPI response:", JSON.stringify(fbResult));

    if (!fbResponse.ok) {
      console.error("Facebook CAPI error:", fbResult);
      return new Response(
        JSON.stringify({ success: false, error: fbResult }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Successfully sent event to Facebook CAPI");
    return new Response(
      JSON.stringify({ success: true, result: fbResult }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("CAPI error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
