import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getDashboardStats, DateRange, DateRangeParams } from '@/services/adminService';
import { 
  DollarSign, 
  ShoppingCart, 
  Package, 
  Users, 
  AlertTriangle,
  Clock,
  TrendingUp,
  CalendarIcon
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
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

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  variant = 'default' 
}: { 
  title: string; 
  value: string | number; 
  icon: React.ElementType;
  trend?: string;
  variant?: 'default' | 'warning' | 'success';
}) {
  const variants = {
    default: 'bg-card',
    warning: 'bg-accent/10 border-accent/30',
    success: 'bg-primary/10 border-primary/30',
  };

  return (
    <Card className={`${variants[variant]} transition-all hover:shadow-md`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {trend && (
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
            <TrendingUp className="h-3 w-3 text-primary" />
            {trend}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

const dateRangeOptions: { value: DateRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'custom', label: 'Custom' },
];

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRange, setSelectedRange] = useState<DateRange>('week');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);

  useEffect(() => {
    loadStats();
  }, [selectedRange, customStartDate, customEndDate]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const params: DateRangeParams = {
        range: selectedRange,
        startDate: customStartDate,
        endDate: customEndDate,
      };
      const data = await getDashboardStats(params);
      setStats(data);
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRangeChange = (range: DateRange) => {
    setSelectedRange(range);
    if (range !== 'custom') {
      setCustomStartDate(undefined);
      setCustomEndDate(undefined);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  // Process chart data
  const chartData = stats?.recentOrders.reduce((acc: { date: string; orders: number; revenue: number }[], order) => {
    const date = new Date(order.created_at).toLocaleDateString('en-US', { weekday: 'short' });
    const existing = acc.find(item => item.date === date);
    if (existing) {
      existing.orders += 1;
      existing.revenue += Number(order.total);
    } else {
      acc.push({ date, orders: 1, revenue: Number(order.total) });
    }
    return acc;
  }, []) || [];

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-display font-bold">Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's your store overview.</p>
        </div>

        {/* Date Range Filter */}
        <div className="flex flex-wrap items-center gap-2">
          {dateRangeOptions.map((option) => (
            <Button
              key={option.value}
              variant={selectedRange === option.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleRangeChange(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Custom Date Range Picker */}
      {selectedRange === 'custom' && (
        <div className="flex flex-wrap items-center gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">From:</span>
            <Popover open={showStartCalendar} onOpenChange={setShowStartCalendar}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[180px] justify-start text-left font-normal",
                    !customStartDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {customStartDate ? format(customStartDate, "PPP") : "Start date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={customStartDate}
                  onSelect={(date) => {
                    setCustomStartDate(date);
                    setShowStartCalendar(false);
                  }}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">To:</span>
            <Popover open={showEndCalendar} onOpenChange={setShowEndCalendar}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[180px] justify-start text-left font-normal",
                    !customEndDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {customEndDate ? format(customEndDate, "PPP") : "End date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={customEndDate}
                  onSelect={(date) => {
                    setCustomEndDate(date);
                    setShowEndCalendar(false);
                  }}
                  disabled={(date) => customStartDate ? date < customStartDate : false}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {stats?.dateRange && (
            <span className="text-sm text-muted-foreground">
              Showing data from {format(stats.dateRange.start, "MMM d, yyyy")} to {format(stats.dateRange.end, "MMM d, yyyy")}
            </span>
          )}
        </div>
      )}

      {/* Date Range Indicator */}
      {selectedRange !== 'custom' && stats?.dateRange && (
        <p className="text-sm text-muted-foreground">
          📅 Showing data from {format(stats.dateRange.start, "MMM d, yyyy")} to {format(stats.dateRange.end, "MMM d, yyyy")}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(stats?.totalRevenue || 0)}
          icon={DollarSign}
          variant="success"
        />
        <StatCard
          title="Total Orders"
          value={stats?.totalOrders || 0}
          icon={ShoppingCart}
        />
        <StatCard
          title="Total Products"
          value={stats?.totalProducts || 0}
          icon={Package}
        />
        <StatCard
          title="Total Users"
          value={stats?.totalUsers || 0}
          icon={Users}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-accent/30">
          <CardHeader className="flex flex-row items-center gap-2">
            <Clock className="h-4 w-4 text-accent" />
            <CardTitle className="text-lg">Pending Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-accent">
              {stats?.pendingOrders || 0}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Orders awaiting processing
            </p>
          </CardContent>
        </Card>

        <Card className="border-destructive/30">
          <CardHeader className="flex flex-row items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <CardTitle className="text-lg">Low Stock Alert</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-destructive">
              {stats?.lowStockProducts || 0}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Products with stock below 10
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Orders This Week</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-muted-foreground" />
                  <YAxis className="text-muted-foreground" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))' 
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="orders" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No orders this week yet
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
