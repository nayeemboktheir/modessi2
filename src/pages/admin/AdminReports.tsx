import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CalendarIcon, TrendingUp, Package, DollarSign, ShoppingCart, Scale } from 'lucide-react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

type DateRangePreset = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

interface ProductSales {
  product_name: string;
  product_image: string | null;
  total_quantity: number;
  total_kg: number;
  total_revenue: number;
}

// Parse weight from variation name (e.g., "500g", "1 KG", "1.5 kg", "3 KG")
const parseWeightToKg = (variationName: string | null): number => {
  if (!variationName) return 0;
  
  const name = variationName.trim();
  
  // Match patterns like "1 KG", "3 KG", "1kg", "1.5 kg" (case insensitive)
  const kgMatch = name.match(/(\d+\.?\d*)\s*kg/i);
  if (kgMatch) {
    return parseFloat(kgMatch[1]);
  }
  
  // Match patterns like "500g", "500 g", "250g" (case insensitive)
  const gMatch = name.match(/(\d+\.?\d*)\s*g(?!r)/i);
  if (gMatch) {
    return parseFloat(gMatch[1]) / 1000;
  }
  
  // Match "gram" patterns
  const gramMatch = name.match(/(\d+\.?\d*)\s*gram/i);
  if (gramMatch) {
    return parseFloat(gramMatch[1]) / 1000;
  }
  
  return 0;
};

export default function AdminReports() {
  const [preset, setPreset] = useState<DateRangePreset>('today');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfDay(new Date()),
    to: endOfDay(new Date()),
  });

  const getDateRange = (selectedPreset: DateRangePreset): { from: Date; to: Date } => {
    const now = new Date();
    switch (selectedPreset) {
      case 'today':
        return { from: startOfDay(now), to: endOfDay(now) };
      case 'yesterday':
        const yesterday = subDays(now, 1);
        return { from: startOfDay(yesterday), to: endOfDay(yesterday) };
      case 'week':
        return { from: startOfWeek(now, { weekStartsOn: 0 }), to: endOfWeek(now, { weekStartsOn: 0 }) };
      case 'month':
        return { from: startOfMonth(now), to: endOfMonth(now) };
      case 'custom':
        return {
          from: dateRange?.from || startOfDay(now),
          to: dateRange?.to || endOfDay(now),
        };
      default:
        return { from: startOfDay(now), to: endOfDay(now) };
    }
  };

  const handlePresetChange = (newPreset: DateRangePreset) => {
    setPreset(newPreset);
    if (newPreset !== 'custom') {
      const range = getDateRange(newPreset);
      setDateRange({ from: range.from, to: range.to });
    }
  };

  const currentRange = getDateRange(preset);

  // Fetch orders within date range
  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['sales-report', currentRange.from.toISOString(), currentRange.to.toISOString()],
    queryFn: async () => {
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id,
          total,
          subtotal,
          shipping_cost,
          discount,
          status,
          created_at,
          order_items (
            id,
            product_name,
            product_image,
            quantity,
            price,
            variation_name
          )
        `)
        .gte('created_at', currentRange.from.toISOString())
        .lte('created_at', currentRange.to.toISOString())
        .neq('status', 'cancelled');

      if (error) throw error;
      return orders || [];
    },
  });

  // Calculate total KG sold
  const totalKgSold = ordersData?.reduce((sum, order) => 
    sum + order.order_items.reduce((itemSum, item) => 
      itemSum + (parseWeightToKg(item.variation_name) * item.quantity), 0
    ), 0
  ) || 0;

  // Calculate statistics
  const stats = {
    totalOrders: ordersData?.length || 0,
    totalRevenue: ordersData?.reduce((sum, order) => sum + Number(order.total), 0) || 0,
    totalProducts: ordersData?.reduce((sum, order) => 
      sum + order.order_items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0
    ) || 0,
    averageOrderValue: ordersData?.length 
      ? (ordersData.reduce((sum, order) => sum + Number(order.total), 0) / ordersData.length) 
      : 0,
  };

  // Calculate product-wise sales
  const productSales: ProductSales[] = [];
  const productMap = new Map<string, ProductSales>();

  ordersData?.forEach((order) => {
    order.order_items.forEach((item) => {
      const itemKg = parseWeightToKg(item.variation_name) * item.quantity;
      const existing = productMap.get(item.product_name);
      if (existing) {
        existing.total_quantity += item.quantity;
        existing.total_kg += itemKg;
        existing.total_revenue += Number(item.price) * item.quantity;
      } else {
        productMap.set(item.product_name, {
          product_name: item.product_name,
          product_image: item.product_image,
          total_quantity: item.quantity,
          total_kg: itemKg,
          total_revenue: Number(item.price) * item.quantity,
        });
      }
    });
  });

  productMap.forEach((value) => productSales.push(value));
  productSales.sort((a, b) => b.total_quantity - a.total_quantity);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sales Reports</h1>
          <p className="text-muted-foreground">
            View sales and revenue statistics
          </p>
        </div>

        {/* Date Range Filters */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={preset === 'today' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handlePresetChange('today')}
          >
            Today
          </Button>
          <Button
            variant={preset === 'yesterday' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handlePresetChange('yesterday')}
          >
            Yesterday
          </Button>
          <Button
            variant={preset === 'week' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handlePresetChange('week')}
          >
            This Week
          </Button>
          <Button
            variant={preset === 'month' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handlePresetChange('month')}
          >
            This Month
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={preset === 'custom' ? 'default' : 'outline'}
                size="sm"
                className="gap-2"
                onClick={() => setPreset('custom')}
              >
                <CalendarIcon className="h-4 w-4" />
                {preset === 'custom' && dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, 'LLL dd')} - {format(dateRange.to, 'LLL dd')}
                    </>
                  ) : (
                    format(dateRange.from, 'LLL dd, y')
                  )
                ) : (
                  'Custom'
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={(range) => {
                  setDateRange(range);
                  setPreset('custom');
                }}
                numberOfMonths={2}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Date Range Display */}
      <div className="text-sm text-muted-foreground">
        Showing data from{' '}
        <span className="font-medium text-foreground">
          {format(currentRange.from, 'PPP')}
        </span>{' '}
        to{' '}
        <span className="font-medium text-foreground">
          {format(currentRange.to, 'PPP')}
        </span>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOrders}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">৳{stats.totalRevenue.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Products Sold</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProducts}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total KG Sold</CardTitle>
            <Scale className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalKgSold.toFixed(2)} kg</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">৳{stats.averageOrderValue.toFixed(0)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Product Sales Table */}
      <Card>
        <CardHeader>
          <CardTitle>Product Sales Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : productSales.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No sales data for the selected period
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-center">Quantity Sold</TableHead>
                  <TableHead className="text-center">KG Sold</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productSales.map((product, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {product.product_image && (
                          <img
                            src={product.product_image}
                            alt={product.product_name}
                            className="h-10 w-10 rounded object-cover"
                          />
                        )}
                        <span className="font-medium">{product.product_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {product.total_quantity}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {product.total_kg > 0 ? `${product.total_kg.toFixed(2)} kg` : '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ৳{product.total_revenue.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
