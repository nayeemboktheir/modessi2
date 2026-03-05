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
  blocked?: boolean;
};

// ─── 48-hour persistent cache (localStorage) ────────────────────────
const CACHE_KEY = "courier_history_cache_v2";
const CACHE_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours
const ERROR_COOLDOWN_MS = 5 * 60 * 1000; // retry failed numbers after 5 mins

// In-memory mirrors so we don't JSON.parse on every render
let memCache: Record<string, { summary?: Summary; fetchedAt: number }> = {};
let errorCooldown: Record<string, number> = {};
let cacheLoaded = false;

function loadCache() {
  if (cacheLoaded) return;
  cacheLoaded = true;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const now = Date.now();
      for (const key in parsed) {
        if (now - parsed[key].fetchedAt < CACHE_TTL_MS) {
          memCache[key] = parsed[key];
        }
      }
    }
  } catch {
    memCache = {};
  }
}

function getCached(phone: string): { summary?: Summary; fetchedAt: number } | undefined {
  loadCache();
  const entry = memCache[phone];
  if (!entry) return undefined;
  if (Date.now() - entry.fetchedAt >= CACHE_TTL_MS) {
    delete memCache[phone];
    return undefined;
  }
  return entry;
}

function setCache(phone: string, summary?: Summary) {
  loadCache();
  memCache[phone] = { summary, fetchedAt: Date.now() };
  schedulePersist();
}

function markError(phone: string) {
  errorCooldown[phone] = Date.now();
}

function isInErrorCooldown(phone: string) {
  const failedAt = errorCooldown[phone];
  if (!failedAt) return false;
  if (Date.now() - failedAt >= ERROR_COOLDOWN_MS) {
    delete errorCooldown[phone];
    return false;
  }
  return true;
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(memCache));
    } catch {
      /* quota exceeded — ignore */
    }
  }, 1000);
}

// ─── Serial fetch queue ──────────────────────────────────────────────
type QueueItem = {
  phone: string;
  resolve: (s?: Summary) => void;
};

const queue: QueueItem[] = [];
const inFlight = new Map<string, Promise<Summary | undefined>>();
let processing = false;

async function processQueue() {
  if (processing) return;
  processing = true;

  try {
    while (queue.length > 0) {
      const item = queue.shift()!;

      const cached = getCached(item.phone);
      if (cached) {
        item.resolve(cached.summary);
        continue;
      }

      if (isInErrorCooldown(item.phone)) {
        item.resolve(undefined);
        continue;
      }

      try {
        const { data, error } = await supabase.functions.invoke("courier-history", {
          body: { phone: item.phone },
        });

        if (error) throw error;

        const response = data as CourierHistoryApiResponse | undefined;
        if (response?.blocked) {
          setCache(item.phone, undefined);
          item.resolve(undefined);
          continue;
        }

        if (response?.error) throw new Error(response.error);

        const summary = response?.data?.courierData?.summary;
        setCache(item.phone, summary);
        item.resolve(summary);
      } catch {
        markError(item.phone);
        item.resolve(undefined);
      }

      await new Promise((r) => setTimeout(r, 180));
    }
  } finally {
    processing = false;
    if (queue.length > 0) {
      setTimeout(processQueue, 40);
    }
  }
}

function enqueueFetch(phone: string): Promise<Summary | undefined> {
  const cached = getCached(phone);
  if (cached) return Promise.resolve(cached.summary);

  if (isInErrorCooldown(phone)) {
    return Promise.resolve(undefined);
  }

  const existingInFlight = inFlight.get(phone);
  if (existingInFlight) return existingInFlight;

  const promise = new Promise<Summary | undefined>((resolve) => {
    queue.push({ phone, resolve });
    processQueue();
  }).finally(() => {
    inFlight.delete(phone);
  });

  inFlight.set(phone, promise);
  return promise;
}

// ─── Helpers ─────────────────────────────────────────────────────────
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

  const color = value >= 80 ? "hsl(142, 76%, 36%)" : value >= 50 ? "hsl(45, 93%, 47%)" : "hsl(0, 84%, 60%)";

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
        stroke={color}
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

// ─── Component ───────────────────────────────────────────────────────
export function CourierHistoryInline({
  phone,
  className,
  autoFetch = true,
}: {
  phone: string;
  className?: string;
  autoFetch?: boolean;
}) {
  const normalized = useMemo(() => normalizePhone(phone), [phone]);
  const cached = useMemo(() => getCached(normalized), [normalized]);
  const [loading, setLoading] = useState(autoFetch && !cached);
  const [summary, setSummary] = useState<Summary | undefined>(cached?.summary);

  useEffect(() => {
    const freshCache = getCached(normalized);
    if (freshCache) {
      setSummary(freshCache.summary);
      setLoading(false);
      return;
    }

    if (!autoFetch || isInErrorCooldown(normalized)) {
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);

    enqueueFetch(normalized)
      .then((s) => {
        if (!mounted) return;
        setSummary(s);
        setLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [normalized, autoFetch]);

  const success = summary?.success_ratio;
  const delivered = summary?.success_parcel ?? 0;
  const cancelled = summary?.cancelled_parcel ?? 0;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {loading && !summary ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : summary ? (
        <>
          <ProgressRing value={typeof success === "number" ? success : 0} />
          <div className="text-xs leading-tight text-muted-foreground">
            <div>
              <span className="font-medium text-foreground">
                {typeof success === "number" ? `${success.toFixed(0)}%` : "—"}
              </span>
            </div>
            <div>
              {delivered}/{delivered + cancelled}
            </div>
          </div>
        </>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      )}
    </div>
  );
}
