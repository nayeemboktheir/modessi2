import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getDashboardStats, DateRange, DateRangeParams } from '@/services/adminService';
import { AlertTriangle, CalendarDays, CalendarIcon, ChevronRight, CircleAlert, Clock, DollarSign, Package, PackageCheck, ShoppingCart, Users } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface DashboardStats {
  totalOrders: number;
  totalProducts: number;
  totalUsers: number;
  totalRevenue: number;
  pendingOrders: number;
  lowStockProducts: number;
  recentOrders: { created_at: string; total: number }[];
  dateRange?: { start: Date; end: Date };
}

type CachedDashboardStats = Omit<DashboardStats, 'dateRange'> & { dateRange?: { start: string; end: string } };

const DASHBOARD_CACHE_KEY = 'admin_dashboard_stats_cache_v1';
const DASHBOARD_CACHE_TTL = 2 * 60 * 1000;
const DASHBOARD_QUERY_TIMEOUT_MS = 9000;

const dateRangeOptions: { value: DateRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'custom', label: 'Custom' },
];

const getDashboardParamsKey = (params: DateRangeParams) => {
  const start = params.startDate ? params.startDate.toISOString().slice(0, 10) : '';
  const end = params.endDate ? params.endDate.toISOString().slice(0, 10) : '';
  return `${params.range}:${start}:${end}`;
};

const serializeDashboardStats = (stats: DashboardStats): CachedDashboardStats => ({
  ...stats,
  dateRange: stats.dateRange ? { start: stats.dateRange.start.toISOString(), end: stats.dateRange.end.toISOString() } : undefined,
});

const deserializeDashboardStats = (stats: CachedDashboardStats): DashboardStats => ({
  ...stats,
  dateRange: stats.dateRange ? { start: new Date(stats.dateRange.start), end: new Date(stats.dateRange.end) } : undefined,
});

const readDashboardCache = (paramsKey: string, allowStale = false): DashboardStats | null => {
  try {
    const raw = sessionStorage.getItem(DASHBOARD_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { timestamp: number; paramsKey: string; data: CachedDashboardStats };
    if (parsed.paramsKey !== paramsKey || (!allowStale && Date.now() - parsed.timestamp >= DASHBOARD_CACHE_TTL)) return null;
    return deserializeDashboardStats(parsed.data);
  } catch {
    return null;
  }
};

const persistDashboardCache = (paramsKey: string, stats: DashboardStats) => {
  try {
    sessionStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), paramsKey, data: serializeDashboardStats(stats) }));
  } catch {
    // Storage being unavailable should not prevent dashboard use.
  }
};

const withDashboardTimeout = <T,>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => new Promise<T>((resolve, reject) => {
  const timeoutId = window.setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  promise.then(
    (result) => { window.clearTimeout(timeoutId); resolve(result); },
    (error) => { window.clearTimeout(timeoutId); reject(error); },
  );
});

function StatCard({ title, value, detail, icon: Icon, iconClassName = 'bg-primary/10 text-primary', className = '' }: {
  title: string;
  value: string | number;
  detail: string;
  icon: React.ElementType;
  iconClassName?: string;
  className?: string;
}) {
  return (
    <Card className={`overflow-hidden border-border/80 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${className}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</div>
          </div>
          <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${iconClassName}`}><Icon className="size-5" /></div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRange, setSelectedRange] = useState<DateRange>('week');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);

  const loadStats = useCallback(async () => {
    if (selectedRange === 'custom' && (!customStartDate || !customEndDate)) {
      setLoading(false);
      return;
    }

    const params: DateRangeParams = { range: selectedRange, startDate: customStartDate, endDate: customEndDate };
    const paramsKey = getDashboardParamsKey(params);
    const freshCachedStats = readDashboardCache(paramsKey);
    if (freshCachedStats) {
      setStats(freshCachedStats);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const data = await withDashboardTimeout(getDashboardStats(params), DASHBOARD_QUERY_TIMEOUT_MS, 'Dashboard stats request');
      setStats(data);
      persistDashboardCache(paramsKey, data);
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
      if (!freshCachedStats) setStats(readDashboardCache(paramsKey, true));
    } finally {
      setLoading(false);
    }
  }, [selectedRange, customStartDate, customEndDate]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const handleRangeChange = (range: DateRange) => {
    setSelectedRange(range);
    if (range !== 'custom') {
      setCustomStartDate(undefined);
      setCustomEndDate(undefined);
    }
  };

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  const chartData = useMemo(() => {
    if (!stats?.recentOrders || !stats.dateRange) return [];
    const byDate = new Map<string, { orders: number; revenue: number }>();

    for (const order of stats.recentOrders) {
      const key = format(new Date(order.created_at), 'yyyy-MM-dd');
      const existing = byDate.get(key);
      byDate.set(key, { orders: (existing?.orders || 0) + 1, revenue: (existing?.revenue || 0) + Number(order.total) });
    }

    const days: { date: string; fullDate: string; orders: number; revenue: number }[] = [];
    const cursor = new Date(stats.dateRange.start);
    const end = new Date(stats.dateRange.end);
    cursor.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    while (cursor <= end) {
      const key = format(cursor, 'yyyy-MM-dd');
      const value = byDate.get(key) || { orders: 0, revenue: 0 };
      days.push({ date: format(cursor, 'MMM d'), fullDate: format(cursor, 'PPP'), ...value });
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }, [stats?.recentOrders, stats?.dateRange]);

  const chartTitle = selectedRange === 'today'
    ? 'Orders today'
    : selectedRange === 'month'
      ? 'Orders in the last 30 days'
      : selectedRange === 'custom'
        ? 'Orders in selected period'
        : 'Orders in the last 7 days';

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <Skeleton className="h-40 rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[...Array(4)].map((_, index) => <Skeleton key={index} className="h-36 rounded-xl" />)}</div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-4">
      <section className="gradient-elegant relative overflow-hidden rounded-2xl border border-primary/10 px-5 py-6 shadow-sm sm:px-7 sm:py-7">
        <div className="absolute -right-10 -top-16 size-48 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Store performance</p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground sm:text-base">A clear view of your store, orders, and inventory health.</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border/80 bg-background/80 p-1.5 shadow-sm backdrop-blur-sm">
            {dateRangeOptions.map((option) => <Button key={option.value} variant={selectedRange === option.value ? 'default' : 'ghost'} size="sm" className="rounded-lg px-3.5" onClick={() => handleRangeChange(option.value)}>{option.label}</Button>)}
          </div>
        </div>
      </section>

      {selectedRange === 'custom' && (
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">From</span>
            <Popover open={showStartCalendar} onOpenChange={setShowStartCalendar}>
              <PopoverTrigger asChild><Button variant="outline" className={cn('w-[180px] justify-start text-left font-normal', !customStartDate && 'text-muted-foreground')}><CalendarIcon className="mr-2 size-4" />{customStartDate ? format(customStartDate, 'PPP') : 'Start date'}</Button></PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={customStartDate} onSelect={(date) => { setCustomStartDate(date); setShowStartCalendar(false); }} initialFocus className="pointer-events-auto p-3" /></PopoverContent>
            </Popover>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">To</span>
            <Popover open={showEndCalendar} onOpenChange={setShowEndCalendar}>
              <PopoverTrigger asChild><Button variant="outline" className={cn('w-[180px] justify-start text-left font-normal', !customEndDate && 'text-muted-foreground')}><CalendarIcon className="mr-2 size-4" />{customEndDate ? format(customEndDate, 'PPP') : 'End date'}</Button></PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={customEndDate} onSelect={(date) => { setCustomEndDate(date); setShowEndCalendar(false); }} disabled={(date) => customStartDate ? date < customStartDate : false} initialFocus className="pointer-events-auto p-3" /></PopoverContent>
            </Popover>
          </div>
          <span className="text-sm text-muted-foreground">Choose a start and end date to update the overview.</span>
        </div>
      )}

      {selectedRange !== 'custom' && stats?.dateRange && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><CalendarDays className="size-4 text-primary" /><span>Showing {format(stats.dateRange.start, 'MMM d, yyyy')} – {format(stats.dateRange.end, 'MMM d, yyyy')}</span></div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Revenue" value={formatCurrency(stats?.totalRevenue || 0)} detail="Paid orders in this period" icon={DollarSign} className="border-primary/15 bg-primary/[0.025]" />
        <StatCard title="Total Orders" value={stats?.totalOrders || 0} detail="Orders placed in this period" icon={ShoppingCart} iconClassName="bg-sky-500/10 text-sky-700" />
        <StatCard title="Total Products" value={stats?.totalProducts || 0} detail="Products in your catalog" icon={Package} iconClassName="bg-violet-500/10 text-violet-700" />
        <StatCard title="Total Users" value={stats?.totalUsers || 0} detail="Registered store customers" icon={Users} iconClassName="bg-emerald-500/10 text-emerald-700" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-amber-500/25 bg-amber-500/[0.035] shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600"><Clock className="size-5" /></div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-4"><p className="font-semibold">Pending orders</p><span className="text-3xl font-semibold tracking-tight text-amber-600">{stats?.pendingOrders || 0}</span></div>
              <p className="mt-1 text-sm text-muted-foreground">Orders awaiting processing in this period.</p>
              <Link to="/admin/orders" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">Review orders <ChevronRight className="size-4" /></Link>
            </div>
          </CardContent>
        </Card>

        <Card className="border-destructive/20 bg-destructive/[0.025] shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive"><AlertTriangle className="size-5" /></div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-4"><p className="font-semibold">Low stock alert</p><span className="text-3xl font-semibold tracking-tight text-destructive">{stats?.lowStockProducts || 0}</span></div>
              <p className="mt-1 text-sm text-muted-foreground">Active products with fewer than 10 items in stock.</p>
              <Link to="/admin/inventory" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">Manage inventory <ChevronRight className="size-4" /></Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
          <div><CardTitle className="text-xl">{chartTitle}</CardTitle><p className="mt-1 text-sm text-muted-foreground">Daily order volume across the selected date range.</p></div>
          <div className="hidden items-center gap-2 rounded-lg bg-primary/5 px-3 py-2 text-xs font-medium text-primary sm:flex"><PackageCheck className="size-4" />{stats?.totalOrders || 0} total</div>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="h-[280px] sm:h-[320px]">
            {chartData.some((item) => item.orders > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 12, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tickMargin={10} className="text-xs text-muted-foreground" minTickGap={24} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} tickMargin={8} className="text-xs text-muted-foreground" />
                  <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate || ''} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '0.75rem', boxShadow: 'var(--shadow-md)' }} cursor={{ stroke: 'hsl(var(--primary) / 0.25)', strokeWidth: 1 }} />
                  <Line type="monotone" dataKey="orders" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ fill: 'hsl(var(--primary))', r: 3, strokeWidth: 2, stroke: 'hsl(var(--card))' }} activeDot={{ r: 5, fill: 'hsl(var(--primary))', stroke: 'hsl(var(--card))', strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/25 px-4 text-center">
                <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground"><CircleAlert className="size-5" /></div>
                <p className="font-medium text-foreground">No orders in this period</p>
                <p className="mt-1 text-sm text-muted-foreground">Orders will appear here as customers place them.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
