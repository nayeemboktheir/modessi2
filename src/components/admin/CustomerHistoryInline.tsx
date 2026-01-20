import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, UserCheck, UserX, UserMinus, User } from "lucide-react";
import { cn } from "@/lib/utils";

type Summary = {
  total_orders: number;
  delivered: number;
  cancelled: number;
  pending: number;
  success_ratio: number | null;
  total_spent: number;
  risk_level: 'new' | 'low' | 'medium' | 'high';
};

type CustomerHistoryResponse = {
  success?: boolean;
  data?: {
    summary?: Summary;
    customer_name?: string;
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

function ProgressRing({ value, riskLevel, className }: { value: number; riskLevel: string; className?: string }) {
  const size = 34;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const c = 2 * Math.PI * radius;
  const offset = c - (value / 100) * c;

  const getColor = () => {
    switch (riskLevel) {
      case 'low': return 'hsl(142, 76%, 36%)'; // green
      case 'medium': return 'hsl(45, 93%, 47%)'; // yellow
      case 'high': return 'hsl(0, 84%, 60%)'; // red
      default: return 'hsl(var(--muted-foreground))'; // gray for new
    }
  };

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
        stroke={getColor()}
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

function RiskBadge({ riskLevel }: { riskLevel: string }) {
  const config = {
    new: { icon: User, label: 'New', className: 'text-muted-foreground bg-muted' },
    low: { icon: UserCheck, label: 'Good', className: 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30' },
    medium: { icon: UserMinus, label: 'Caution', className: 'text-yellow-700 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30' },
    high: { icon: UserX, label: 'Risk', className: 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30' },
  };

  const { icon: Icon, label, className } = config[riskLevel as keyof typeof config] || config.new;

  return (
    <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium", className)}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

export function CustomerHistoryInline({
  phone,
  className,
}: {
  phone: string;
  className?: string;
}) {
  const normalized = useMemo(() => normalizePhone(phone), [phone]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<Summary | undefined>(() => cache.get(normalized)?.summary);

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
        const { data, error } = await supabase.functions.invoke("customer-history", {
          body: { phone: normalized },
        });

        if (error) throw error;

        const response = data as CustomerHistoryResponse | undefined;
        
        if (response?.error) throw new Error(response.error);

        const s = response?.data?.summary;
        if (s) {
          cache.set(normalized, { summary: s, fetchedAt: Date.now() });
          if (mounted) setSummary(s);
        }
      } catch (err) {
        console.error('Customer history error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [normalized]);

  const successRatio = summary?.success_ratio ?? 0;
  const riskLevel = summary?.risk_level ?? 'new';
  const delivered = summary?.delivered ?? 0;
  const total = summary?.total_orders ?? 0;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {loading && !summary ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <>
          {total > 0 ? (
            <ProgressRing value={successRatio} riskLevel={riskLevel} />
          ) : (
            <div className="w-[34px] h-[34px] rounded-full bg-muted flex items-center justify-center">
              <User className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
        </>
      )}
      <div className="text-xs leading-tight">
        <div className="flex items-center gap-1.5">
          <RiskBadge riskLevel={riskLevel} />
        </div>
        <div className="text-muted-foreground mt-0.5">
          {total > 0 ? (
            <>
              <span className="font-medium text-foreground">{delivered}/{total}</span> delivered
            </>
          ) : (
            <span>First order</span>
          )}
        </div>
      </div>
    </div>
  );
}
