import { Fragment, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, Phone, Search, Trash2, Save, PackageOpen } from 'lucide-react';
import { DataPagination } from '@/components/admin/DataPagination';
import { usePagination } from '@/hooks/usePagination';

type OrderRow = Database['public']['Tables']['wholesale_orders']['Row'];
type ItemRow = Database['public']['Tables']['wholesale_order_items']['Row'];
type Order = OrderRow & { wholesale_order_items: ItemRow[] };

const WHOLESALE_ORDERS_QUERY_KEY = ['admin-wholesale-orders'];
const PENDING_WHOLESALE_COUNT_KEY = ['pending-wholesale-orders-count'];

const STATUSES = [
  { value: 'pending', label: 'Pending', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'confirmed', label: 'Confirmed', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'shipped', label: 'Shipped', className: 'bg-violet-100 text-violet-800 border-violet-200' },
  { value: 'delivered', label: 'Delivered', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: 'cancelled', label: 'Cancelled', className: 'bg-rose-100 text-rose-800 border-rose-200' },
] as const;

const statusMeta = (s: string) => STATUSES.find((x) => x.value === s) ?? STATUSES[0];

const bdt = (n: number) => `৳${Number(n).toLocaleString('en-BD', { maximumFractionDigits: 2 })}`;

export function WholesaleOrdersTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Order | null>(null);

  const { data: orders = [], isLoading, error } = useQuery({
    queryKey: WHOLESALE_ORDERS_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wholesale_orders')
        .select('*, wholesale_order_items(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Order[];
    },
    refetchInterval: 120000,
  });

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: orders.length };
    for (const o of orders) m[o.status] = (m[o.status] ?? 0) + 1;
    return m;
  }, [orders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (status !== 'all' && o.status !== status) return false;
      if (!q) return true;
      return [o.order_number, o.buyer_name, o.shop_name, o.phone, o.address]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [orders, search, status]);

  const { page, pageSize, totalPages, pageStart, pageItems, goToPage, setPageSize } = usePagination(
    filtered,
    { resetKey: [search, status] }
  );

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: WHOLESALE_ORDERS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: PENDING_WHOLESALE_COUNT_KEY }),
    ]);
  };

  const updateOrder = async (
    order: Order,
    patch: Database['public']['Tables']['wholesale_orders']['Update'],
    successMessage: string
  ) => {
    setBusyId(order.id);
    try {
      const { error } = await supabase.from('wholesale_orders').update(patch).eq('id', order.id);
      if (error) throw error;
      toast.success(successMessage);
      await refresh();
    } catch (e) {
      toast.error((e as Error)?.message || 'Failed to update order');
    } finally {
      setBusyId(null);
    }
  };

  const saveNote = async (order: Order) => {
    const note = (noteDrafts[order.id] ?? order.admin_note ?? '').trim();
    await updateOrder(order, { admin_note: note || null }, 'Note saved');
    setNoteDrafts((prev) => {
      const next = { ...prev };
      delete next[order.id];
      return next;
    });
  };

  const deleteOrder = async () => {
    if (!toDelete) return;
    setBusyId(toDelete.id);
    try {
      const { error } = await supabase.from('wholesale_orders').delete().eq('id', toDelete.id);
      if (error) throw error;
      toast.success(`Order ${toDelete.order_number} deleted`);
      setToDelete(null);
      await refresh();
    } catch (e) {
      toast.error((e as Error)?.message || 'Failed to delete order');
    } finally {
      setBusyId(null);
    }
  };

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-destructive">
          Could not load wholesale orders: {(error as Error).message}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {[{ value: 'all', label: 'All' }, ...STATUSES].map((s) => (
              <Button
                key={s.value}
                size="sm"
                variant={status === s.value ? 'default' : 'outline'}
                onClick={() => setStatus(s.value)}
              >
                {s.label}
                <span className="ml-1.5 text-xs opacity-70">{counts[s.value] ?? 0}</span>
              </Button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search order #, name, shop, phone, address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Order</TableHead>
                <TableHead>Buyer</TableHead>
                <TableHead className="text-right">Pieces</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.map((order) => {
                const isOpen = !!expanded[order.id];
                const meta = statusMeta(order.status);
                const noteValue = noteDrafts[order.id] ?? order.admin_note ?? '';
                const noteDirty = noteDrafts[order.id] !== undefined && noteValue !== (order.admin_note ?? '');

                return (
                  <Fragment key={order.id}>
                    <TableRow className={isOpen ? 'border-b-0' : undefined}>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          aria-label={isOpen ? 'Hide order details' : 'Show order details'}
                          onClick={() => setExpanded((prev) => ({ ...prev, [order.id]: !prev[order.id] }))}
                        >
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{order.order_number}</div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(order.created_at), 'dd MMM yyyy, h:mm a')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{order.buyer_name}</div>
                        {order.shop_name && (
                          <div className="text-xs text-muted-foreground">{order.shop_name}</div>
                        )}
                        <a
                          href={`tel:${order.phone}`}
                          className="text-xs text-primary hover:underline"
                        >
                          {order.phone}
                        </a>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {order.total_quantity}
                        <div className="text-xs text-muted-foreground">
                          {order.wholesale_order_items.length} line
                          {order.wholesale_order_items.length === 1 ? '' : 's'}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {bdt(order.subtotal)}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={order.status}
                          disabled={busyId === order.id}
                          onValueChange={(v) =>
                            updateOrder(order, { status: v }, `${order.order_number} → ${statusMeta(v).label}`)
                          }
                        >
                          <SelectTrigger className={`h-8 w-36 border ${meta.className}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button asChild size="icon" variant="ghost" className="h-8 w-8" aria-label="Call buyer">
                            <a href={`tel:${order.phone}`}>
                              <Phone className="h-4 w-4" />
                            </a>
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            aria-label="Delete order"
                            disabled={busyId === order.id}
                            onClick={() => setToDelete(order)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {isOpen && (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell />
                        <TableCell colSpan={6} className="py-4">
                          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
                            <div className="space-y-2">
                              {order.wholesale_order_items.map((item) => (
                                <div key={item.id} className="flex items-center gap-3 text-sm">
                                  {item.product_image ? (
                                    <img
                                      src={item.product_image}
                                      alt=""
                                      loading="lazy"
                                      className="h-10 w-10 rounded object-cover"
                                    />
                                  ) : (
                                    <div className="h-10 w-10 rounded bg-muted" />
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate font-medium">{item.product_name}</div>
                                    {item.variation_name && (
                                      <div className="text-xs text-muted-foreground">{item.variation_name}</div>
                                    )}
                                  </div>
                                  <div className="text-right tabular-nums text-muted-foreground">
                                    {item.quantity} × {bdt(item.unit_price)}
                                  </div>
                                  <div className="w-24 text-right font-medium tabular-nums">
                                    {bdt(item.line_total)}
                                  </div>
                                </div>
                              ))}
                              <div className="flex justify-end border-t pt-2 text-sm font-semibold">
                                Total ({order.total_quantity} pcs): {bdt(order.subtotal)}
                              </div>
                            </div>

                            <div className="space-y-3 text-sm">
                              <div>
                                <div className="text-xs font-medium uppercase text-muted-foreground">Address</div>
                                <div className="whitespace-pre-wrap">{order.address}</div>
                              </div>
                              {order.notes && (
                                <div>
                                  <div className="text-xs font-medium uppercase text-muted-foreground">
                                    Buyer note
                                  </div>
                                  <div className="whitespace-pre-wrap">{order.notes}</div>
                                </div>
                              )}
                              <div className="space-y-2">
                                <div className="text-xs font-medium uppercase text-muted-foreground">
                                  Admin note
                                </div>
                                <Textarea
                                  rows={3}
                                  value={noteValue}
                                  placeholder="Delivery charge agreed, payment, etc."
                                  onChange={(e) =>
                                    setNoteDrafts((prev) => ({ ...prev, [order.id]: e.target.value }))
                                  }
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={!noteDirty || busyId === order.id}
                                  onClick={() => saveNote(order)}
                                >
                                  <Save className="mr-1 h-3.5 w-3.5" /> Save note
                                </Button>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}

              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                    <PackageOpen className="mx-auto mb-2 h-8 w-8 opacity-50" />
                    {orders.length === 0
                      ? 'No wholesale orders yet. Orders placed on wholesale.modessi.shop appear here.'
                      : 'No orders match these filters'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <DataPagination
        page={page}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={filtered.length}
        pageStart={pageStart}
        onPageChange={goToPage}
        onPageSizeChange={setPageSize}
        itemLabel="orders"
      />

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {toDelete?.order_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the order from {toDelete?.buyer_name}. To keep a record, set it
              to Cancelled instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyId === toDelete?.id}>Keep</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                deleteOrder();
              }}
              disabled={busyId === toDelete?.id}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
