import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Summary = {
  total_parcel?: number;
  success_parcel?: number;
  cancelled_parcel?: number;
  success_ratio?: number;
};

type CourierHistoryApiResponse = {
  success?: boolean;
  data?: {
    courierData?: {
      summary?: Summary;
    };
  };
  error?: string;
};

const cache = new Map<string, { summary?: Summary; fetchedAt: number }>();

function normalizePhone(phone: string) {
  let clean = phone.replace(/\s+/g, "").replace(/[^0-9]/g, "");
  if (clean.startsWith("88")) clean = clean.substring(2);
  if (!clean.startsWith("0") && clean.length === 10) clean = `0${clean}`;
  return clean;
}

function ProgressRing({ value, className }: { value: number; className?: string }) {
  const size = 34;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const c = 2 * Math.PI * radius;
  const offset = c - (value / 100) * c;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn("shrink-0", className)}
      aria-label={`Success rate ${value}%`}
      role="img"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="hsl(var(--muted-foreground) / 0.25)"
        strokeWidth={stroke}
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="hsl(var(--primary))"
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="52%"
        dominantBaseline="middle"
        textAnchor="middle"
        fill="hsl(var(--foreground))"
        fontSize="10"
        fontWeight="600"
      >
        {Math.round(value)}
      </text>
    </svg>
  );
}

export function CourierHistoryInline({
  phone,
  className,
}: {
  phone: string;
  className?: string;
}) {
  const normalized = useMemo(() => normalizePhone(phone), [phone]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<Summary | undefined>(() => cache.get(normalized)?.summary);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const cached = cache.get(normalized);
    if (cached?.summary) {
      setSummary(cached.summary);
      return;
    }

    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("courier-history", {
          body: { phone: normalized },
        });

        if (error) throw error;

        const response = data as CourierHistoryApiResponse & { blocked?: boolean } | undefined;
        
        // Handle blocked/service unavailable
        if (response?.blocked) {
          if (mounted) setBlocked(true);
          return;
        }
        
        if (response?.error) throw new Error(response.error);

        const s = response?.data?.courierData?.summary;
        cache.set(normalized, { summary: s, fetchedAt: Date.now() });
        if (mounted) setSummary(s);
      } catch {
        // Keep UI silent here; the dialog has detailed errors.
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [normalized]);

  const success = summary?.success_ratio;
  const delivered = summary?.success_parcel ?? 0;
  const cancelled = summary?.cancelled_parcel ?? 0;

  // If service is blocked, show nothing or minimal indicator
  if (blocked) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
        <span>Service unavailable</span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {loading && !summary ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <ProgressRing value={typeof success === "number" ? success : 0} />
      )}
      <div className="text-xs leading-tight text-muted-foreground">
        <div>
          Success: <span className="font-medium text-foreground">{typeof success === "number" ? `${success.toFixed(1)}%` : "—"}</span>
        </div>
        <div>
          Order: <span className="font-medium text-foreground">{delivered}/{delivered + cancelled}</span>
        </div>
      </div>
    </div>
  );
}
