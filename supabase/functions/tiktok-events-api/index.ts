import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TikTokEvent {
  event: string;
  event_time: number;
  event_id: string;
  user: {
    ttclid?: string;
    external_id?: string;
    phone?: string;
    email?: string;
    ip?: string;
    user_agent?: string;
  };
  page?: {
    url?: string;
    referrer?: string;
  };
  properties?: {
    contents?: Array<{
      content_id?: string;
      content_name?: string;
      content_type?: string;
      quantity?: number;
      price?: number;
    }>;
    content_type?: string;
    currency?: string;
    value?: number;
    order_id?: string;
    description?: string;
  };
}

interface RequestBody {
  event_name: string;
  user_data?: {
    email?: string;
    phone?: string;
    external_id?: string;
    ttclid?: string;
  };
  custom_data?: {
    currency?: string;
    value?: number;
    content_ids?: string[];
    content_type?: string;
    order_id?: string;
    quantity?: number;
  };
  event_source_url?: string;
  event_id?: string;
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
  console.log("TikTok Events API function invoked");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing Supabase configuration");
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, serviceRoleKey);

    // Fetch TikTok settings from admin_settings
    const { data: settings, error: settingsError } = await supabaseClient
      .from("admin_settings")
      .select("key, value")
      .in("key", ["tiktok_pixel_id", "tiktok_access_token", "tiktok_events_api_enabled", "tiktok_test_event_code"]);

    if (settingsError) {
      console.error("Failed to fetch settings:", settingsError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch settings" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let pixelId = "";
    let accessToken = "";
    let eventsApiEnabled = false;
    let testEventCode = "";

    settings?.forEach((setting: { key: string; value: string }) => {
      switch (setting.key) {
        case "tiktok_pixel_id":
          pixelId = setting.value;
          break;
        case "tiktok_access_token":
          accessToken = setting.value;
          break;
        case "tiktok_events_api_enabled":
          eventsApiEnabled = setting.value === "true";
          break;
        case "tiktok_test_event_code":
          testEventCode = setting.value;
          break;
      }
    });

    console.log("TikTok Config - Enabled:", eventsApiEnabled, "Pixel ID:", pixelId, "Has Token:", !!accessToken);

    if (!eventsApiEnabled) {
      console.log("TikTok Events API is disabled");
      return new Response(
        JSON.stringify({ success: false, message: "TikTok Events API is disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!pixelId || !accessToken) {
      console.log("Missing Pixel ID or Access Token");
      return new Response(
        JSON.stringify({ success: false, message: "Missing Pixel ID or Access Token" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: RequestBody = await req.json();
    console.log("Received event:", body.event_name);

    // Map event names to TikTok event names
    const eventNameMap: Record<string, string> = {
      'PageView': 'Pageview',
      'ViewContent': 'ViewContent',
      'AddToCart': 'AddToCart',
      'InitiateCheckout': 'InitiateCheckout',
      'Purchase': 'CompletePayment',
      'CompletePayment': 'CompletePayment',
      'PlaceAnOrder': 'PlaceAnOrder',
      'Lead': 'SubmitForm',
    };

    const eventName = eventNameMap[body.event_name] || body.event_name;

    // Generate event ID for deduplication
    const eventId = body.event_id || `${eventName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Build user data
    const userData: TikTokEvent["user"] = {
      ip: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || undefined,
      user_agent: req.headers.get("user-agent") || undefined,
    };

    // Add hashed email
    if (body.user_data?.email) {
      userData.email = await hashData(body.user_data.email);
      console.log("Added hashed email");
    }

    // Add hashed phone with Bangladesh country code normalization
    if (body.user_data?.phone) {
      let cleanPhone = body.user_data.phone.replace(/\D/g, "");
      if (cleanPhone.startsWith("01")) {
        cleanPhone = "880" + cleanPhone;
      } else if (!cleanPhone.startsWith("880")) {
        cleanPhone = "880" + cleanPhone;
      }
      userData.phone = await hashData(cleanPhone);
      console.log("Added hashed phone");
    }

    // Add external ID
    if (body.user_data?.external_id) {
      userData.external_id = await hashData(body.user_data.external_id);
      console.log("Added hashed external_id");
    }

    // Add TikTok Click ID (ttclid) for attribution
    if (body.user_data?.ttclid) {
      userData.ttclid = body.user_data.ttclid;
      console.log("Added ttclid for attribution");
    }

    // Build the event
    const event: TikTokEvent = {
      event: eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      user: userData,
      page: {
        url: body.event_source_url || "https://naturaltouchbd.net",
      },
    };

    // Add properties if custom_data exists
    if (body.custom_data) {
      event.properties = {
        content_type: body.custom_data.content_type || "product",
        currency: body.custom_data.currency || "BDT",
        value: body.custom_data.value,
        order_id: body.custom_data.order_id,
      };

      if (body.custom_data.content_ids) {
        event.properties.contents = body.custom_data.content_ids.map(id => ({
          content_id: id,
          content_type: "product",
          quantity: body.custom_data?.quantity || 1,
        }));
      }
    }

    console.log("Event to send:", JSON.stringify(event, null, 2));

    // Build request payload
    const payload: { event_source: string; event_source_id: string; data: TikTokEvent[]; test_event_code?: string } = {
      event_source: "web",
      event_source_id: pixelId,
      data: [event],
    };

    if (testEventCode && testEventCode.trim()) {
      payload.test_event_code = testEventCode.trim();
      console.log("Using test event code:", testEventCode);
    }

    console.log("Sending to TikTok Events API...");

    // Send to TikTok Events API
    const tiktokUrl = "https://business-api.tiktok.com/open_api/v1.3/event/track/";

    const tiktokResponse = await fetch(tiktokUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Access-Token": accessToken,
      },
      body: JSON.stringify(payload),
    });

    const tiktokResult = await tiktokResponse.json();
    console.log("TikTok Events API response status:", tiktokResponse.status);
    console.log("TikTok Events API response:", JSON.stringify(tiktokResult));

    if (!tiktokResponse.ok || tiktokResult.code !== 0) {
      console.error("TikTok Events API error:", tiktokResult);
      return new Response(
        JSON.stringify({ success: false, error: tiktokResult }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Successfully sent event to TikTok Events API");
    return new Response(
      JSON.stringify({ success: true, result: tiktokResult }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("TikTok Events API error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
