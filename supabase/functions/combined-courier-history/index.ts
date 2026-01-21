import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// In-memory cache with TTL
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

interface CourierStats {
  total_parcel: number;
  success_parcel: number;
  cancelled_parcel: number;
  success_ratio: number;
}

interface BDCourierResponse {
  status?: number | string;
  message?: string;
  data?: {
    status?: string;
    courierData?: {
      pathao?: CourierStats;
      steadfast?: CourierStats;
      redx?: CourierStats;
      paperfly?: CourierStats;
      parceldex?: CourierStats;
      summary?: CourierStats;
    };
    // Legacy format
    pathao?: CourierStats;
    steadfast?: CourierStats;
    redx?: CourierStats;
    paperfly?: CourierStats;
    summary?: CourierStats;
  };
  // Direct legacy format
  pathao?: CourierStats;
  steadfast?: CourierStats;
  redx?: CourierStats;
  paperfly?: CourierStats;
  summary?: CourierStats;
}

interface InternalStats {
  total_orders: number;
  delivered: number;
  cancelled: number;
  pending: number;
  success_ratio: number | null;
  total_spent: number;
  risk_level: string;
}

// Clean phone number
function cleanPhone(phone: string): string {
  let cleaned = phone.replace(/[^0-9]/g, "");
  if (cleaned.startsWith("880")) {
    cleaned = "0" + cleaned.slice(3);
  }
  if (!cleaned.startsWith("0") && cleaned.length === 10) {
    cleaned = "0" + cleaned;
  }
  return cleaned;
}

// Fetch from BD Courier API
async function fetchBDCourier(phone: string, apiKey: string): Promise<BDCourierResponse | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    console.log(`Calling BD Courier API for phone: ${phone}`);

    const response = await fetch(
      `https://bdcourier.com/api/courier-check?phone=${encodeURIComponent(phone)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    console.log(`BD Courier API response status: ${response.status}`);

    if (response.status === 429) {
      console.log("BD Courier rate limited");
      return null;
    }

    if (response.status === 403) {
      const text = await response.text();
      console.log("BD Courier blocked:", text.substring(0, 200));
      return null;
    }

    if (response.status === 401) {
      console.log("BD Courier unauthorized - check API key");
      return null;
    }

    if (!response.ok) {
      const text = await response.text();
      console.log(`BD Courier error ${response.status}:`, text.substring(0, 200));
      return null;
    }

    const data = await response.json();
    console.log("BD Courier API response:", JSON.stringify(data).substring(0, 500));
    
    return data;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      console.log("BD Courier API timeout");
    } else {
      console.error("BD Courier fetch error:", error);
    }
    return null;
  }
}

// Fetch from internal orders database
async function fetchInternalHistory(
  supabase: any,
  phone: string
): Promise<InternalStats> {
  const cleaned = cleanPhone(phone);
  const phoneVariations = [
    cleaned,
    cleaned.replace(/^0/, "880"),
    cleaned.replace(/^0/, "+880"),
  ];

  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, status, total, created_at")
    .or(phoneVariations.map((p) => `shipping_phone.ilike.%${p.slice(-10)}%`).join(","))
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Internal query error:", error);
    return {
      total_orders: 0,
      delivered: 0,
      cancelled: 0,
      pending: 0,
      success_ratio: null,
      total_spent: 0,
      risk_level: "new",
    };
  }

  const orderList = orders || [];
  const deliveredCount = orderList.filter((o: any) =>
    ["delivered", "completed"].includes(o.status?.toLowerCase())
  ).length;
  const cancelledCount = orderList.filter((o: any) =>
    ["cancelled", "returned", "return"].includes(o.status?.toLowerCase())
  ).length;
  const pendingCount = orderList.length - deliveredCount - cancelledCount;

  const completedOrders = deliveredCount + cancelledCount;
  const successRatio = completedOrders > 0 ? (deliveredCount / completedOrders) * 100 : null;

  const totalSpent = orderList
    .filter((o: any) => ["delivered", "completed"].includes(o.status?.toLowerCase()))
    .reduce((sum: number, o: any) => sum + (o.total || 0), 0);

  let riskLevel = "new";
  if (orderList.length > 0) {
    if (successRatio === null || successRatio >= 80) {
      riskLevel = "low";
    } else if (successRatio >= 50) {
      riskLevel = "medium";
    } else {
      riskLevel = "high";
    }
  }

  return {
    total_orders: orderList.length,
    delivered: deliveredCount,
    cancelled: cancelledCount,
    pending: pendingCount,
    success_ratio: successRatio,
    total_spent: totalSpent,
    risk_level: riskLevel,
  };
}

// Extract courier data from various response formats
function extractCourierData(response: BDCourierResponse | null): any {
  if (!response) return null;

  // Format 1: response.data.courierData (new format)
  if (response.data?.courierData) {
    return response.data.courierData;
  }

  // Format 2: response.data (legacy with direct properties)
  if (response.data && (response.data.summary || response.data.pathao || response.data.steadfast)) {
    return response.data;
  }

  // Format 3: response directly has courier properties (legacy)
  if (response.summary || response.pathao || response.steadfast) {
    return {
      pathao: response.pathao,
      steadfast: response.steadfast,
      redx: response.redx,
      paperfly: response.paperfly,
      summary: response.summary,
    };
  }

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone } = await req.json();

    if (!phone) {
      return new Response(
        JSON.stringify({ error: "Phone number is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanedPhone = cleanPhone(phone);
    const cacheKey = `combined_${cleanedPhone}`;

    // Check cache
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      console.log("Returning cached result for:", cleanedPhone);
      return new Response(JSON.stringify(cached.data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get BD Courier API key
    const bdCourierApiKey = Deno.env.get("BDCOURIER_API_KEY") || "";

    if (!bdCourierApiKey) {
      console.log("BDCOURIER_API_KEY not configured");
    }

    // Fetch both sources in parallel
    const [bdCourierResult, internalResult] = await Promise.all([
      bdCourierApiKey ? fetchBDCourier(cleanedPhone, bdCourierApiKey) : Promise.resolve(null),
      fetchInternalHistory(supabase, cleanedPhone),
    ]);

    // Extract courier data from response
    const courierData = extractCourierData(bdCourierResult);

    // Build combined response
    const response: any = {
      phone: cleanedPhone,
      internal: internalResult,
      bd_courier: courierData ? { courierData } : null,
      bd_courier_available: courierData !== null,
      combined_risk_level: internalResult.risk_level,
    };

    if (courierData) {
      const summary = courierData.summary;
      
      if (summary && summary.total_parcel > 0) {
        const bdRatio = summary.success_ratio;
        let bdRisk = "low";
        if (bdRatio < 50) {
          bdRisk = "high";
        } else if (bdRatio < 80) {
          bdRisk = "medium";
        }

        // Use worst risk level between internal and BD Courier
        const riskPriority: Record<string, number> = { high: 3, medium: 2, low: 1, new: 0 };
        if (riskPriority[bdRisk] > riskPriority[response.combined_risk_level]) {
          response.combined_risk_level = bdRisk;
        }
      }
    }

    // Cache the result
    cache.set(cacheKey, { data: response, timestamp: Date.now() });

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
