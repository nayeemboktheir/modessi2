import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EventItem {
  item_id: string;
  item_name: string;
  price?: number;
  quantity?: number;
}

interface RequestBody {
  event_name: string;
  client_id?: string;
  user_id?: string;
  session_id?: string;
  params?: {
    currency?: string;
    value?: number;
    transaction_id?: string;
    items?: EventItem[];
    page_location?: string;
    page_title?: string;
    [key: string]: unknown;
  };
}

serve(async (req) => {
  console.log("Google Analytics server-side function invoked");

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

    // Fetch GA settings from admin_settings
    const { data: settings, error: settingsError } = await supabaseClient
      .from("admin_settings")
      .select("key, value")
      .in("key", ["ga_measurement_id", "ga_api_secret", "ga_server_enabled"]);

    if (settingsError) {
      console.error("Failed to fetch settings:", settingsError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch settings" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let measurementId = "";
    let apiSecret = "";
    let serverEnabled = false;

    settings?.forEach((setting: { key: string; value: string }) => {
      switch (setting.key) {
        case "ga_measurement_id":
          measurementId = setting.value;
          break;
        case "ga_api_secret":
          apiSecret = setting.value;
          break;
        case "ga_server_enabled":
          serverEnabled = setting.value === "true";
          break;
      }
    });

    console.log("GA Config - Enabled:", serverEnabled, "Measurement ID:", measurementId, "Has Secret:", !!apiSecret);

    if (!serverEnabled) {
      console.log("GA server-side tracking is disabled");
      return new Response(
        JSON.stringify({ success: false, message: "GA server-side tracking is disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!measurementId || !apiSecret) {
      console.log("Missing Measurement ID or API Secret");
      return new Response(
        JSON.stringify({ success: false, message: "Missing GA4 configuration" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: RequestBody = await req.json();
    console.log("Received event:", body.event_name);
    console.log("Params:", JSON.stringify(body.params));

    // Generate a client ID if not provided
    const clientId = body.client_id || `server.${Date.now()}.${Math.random().toString(36).substr(2, 9)}`;

    // Build the GA4 Measurement Protocol payload
    const gaPayload: {
      client_id: string;
      user_id?: string;
      events: Array<{
        name: string;
        params: Record<string, unknown>;
      }>;
    } = {
      client_id: clientId,
      events: [
        {
          name: body.event_name,
          params: {
            engagement_time_msec: 100,
            session_id: body.session_id,
            ...body.params,
          },
        },
      ],
    };

    // Add user_id if provided
    if (body.user_id) {
      gaPayload.user_id = body.user_id;
    }

    console.log("Sending to GA4:", JSON.stringify(gaPayload, null, 2));

    // Send to GA4 Measurement Protocol
    const gaUrl = `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`;

    const gaResponse = await fetch(gaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(gaPayload),
    });

    // GA4 MP returns 204 on success with no body
    console.log("GA4 response status:", gaResponse.status);

    if (gaResponse.status === 204 || gaResponse.status === 200) {
      console.log("Successfully sent event to GA4");
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      const errorText = await gaResponse.text();
      console.error("GA4 error:", errorText);
      return new Response(
        JSON.stringify({ success: false, error: errorText }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("GA error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
