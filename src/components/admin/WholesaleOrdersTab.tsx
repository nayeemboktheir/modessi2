import { Fragment, useEffect, useMemo, useState } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { InvoicePrintDialog } from '@/components/admin/InvoicePrintDialog';
import { StickerPrintDialog } from '@/components/admin/StickerPrintDialog';
import { toast } from 'sonner';
import {
  ChevronDown,
  ChevronRight,
  Phone,
  Search,
  Trash2,
  Save,
  PackageOpen,
  Truck,
  Loader2,
  ExternalLink,
  Printer,
  Tag,
} from 'lucide-react';
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
  { value: 'returned', label: 'Returned', className: 'bg-orange-100 text-orange-800 border-orange-200' },
  { value: 'cancelled', label: 'Cancelled', className: 'bg-rose-100 text-rose-800 border-rose-200' },
] as const;

const statusMeta = (s: string) => STATUSES.find((x) => x.value === s) ?? STATUSES[0];

type ShipForm = {
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  cod_amount: string;
  note: string;
  item_description: string;
};

const shipFormFor = (order: Order): ShipForm => ({
  recipient_name: order.shop_name ? `${order.buyer_name} (${order.shop_name})` : order.buyer_name,
  recipient_phone: order.phone,
  recipient_address: order.address,
  cod_amount: String(Number(order.subtotal)),
  note: order.notes ?? '',
  item_description: `Wholesale ${order.order_number} - ${order.total_quantity} pcs`,
});

/**
 * A wholesale order in the shape the shared invoice / sticker components print. Wholesale has
 * one free-text address and no delivery charge or discount, so total = subtotal.
 */
const toPrintable = (order: Order) => ({
  id: order.id,
  order_number: order.order_number,
  status: order.status,
  payment_status: 'unpaid',
  payment_method: 'cod',
  total: Number(order.subtotal),
  subtotal: Number(order.subtotal),
  shipping_cost: 0,
  discount: 0,
  shipping_name: order.shop_name ? `${order.buyer_name} (${order.shop_name})` : order.buyer_name,
  shipping_phone: order.phone,
  shipping_street: order.address,
  shipping_city: '',
  shipping_district: '',
  shipping_postal_code: null,
  tracking_number: order.tracking_number,
  steadfast_consignment_id: order.steadfast_consignment_id,
  notes: order.notes,
  created_at: order.created_at,
  order_items: order.wholesale_order_items.map((item) => ({
    id: item.id,
    product_name: item.product_name,
    product_image: item.product_image,
    variation_name: item.variation_name,
    quantity: item.quantity,
    price: Number(item.unit_price),
  })),
});

/** Creates the Steadfast consignment for one wholesale order. Throws with Steadfast's message. */
async function dispatchToSteadfast(order: Order, form: ShipForm) {
  const { data, error } = await supabase.functions.invoke('steadfast-courier', {
    body: {
      wholesaleOrderId: order.id,
      invoice: order.order_number,
      recipient_name: form.recipient_name.trim(),
      recipient_phone: form.recipient_phone.trim(),
      recipient_address: form.recipient_address.trim(),
      cod_amount: Number(form.cod_amount),
      note: form.note.trim() || undefined,
      item_description: form.item_description.trim() || undefined,
    },
  });
  if (error) throw error;
  if (data?.error || !data?.success) throw new Error(data?.error || 'Failed to send order to Steadfast');

  const tracking: string | null = data.tracking_code ? String(data.tracking_code) : null;
  const alreadyDispatched = Boolean(data.alreadyDispatched);
  // The function records the consignment itself; this repeats it so the row is still right
  // against an older steadfast-courier deployment that does not know wholesaleOrderId.
  if (tracking && !alreadyDispatched) {
    await supabase
      .from('wholesale_orders')
      .update({
        tracking_number: tracking,
        steadfast_consignment_id: data.consignment_id ? String(data.consignment_id) : tracking,
        courier_sent_at: new Date().toISOString(),
        status: 'shipped',
      })
      .eq('id', order.id)
      .is('tracking_number', null);
  }
  return { tracking, alreadyDispatched };
}

const bdt = (n: number) => `৳${Number(n).toLocaleString('en-BD', { maximumFractionDigits: 2 })}`;

export function WholesaleOrdersTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Order | null>(null);
  const [toShip, setToShip] = useState<Order | null>(null);
  const [shipForm, setShipForm] = useState<ShipForm | null>(null);
  const [shipping, setShipping] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkShipOpen, setBulkShipOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  // Orders currently in the print dialog; a single row's print button sets just that one.
  const [printOrders, setPrintOrders] = useState<Order[]>([]);
  const [printKind, setPrintKind] = useState<'invoice' | 'sticker' | null>(null);

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
      return [o.order_number, o.buyer_name, o.shop_name, o.phone, o.address, o.tracking_number]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [orders, search, status]);

  const { page, pageSize, totalPages, pageStart, pageItems, goToPage, setPageSize } = usePagination(
    filtered,
    { resetKey: [search, status] }
  );

  // A selection hidden by a new filter would still be acted on, so start over when it changes.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [search, status]);

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

  // ---- Selection & bulk actions -------------------------------------------------------------

  const selectedOrders = useMemo(
    () => orders.filter((o) => selectedIds.has(o.id)),
    [orders, selectedIds]
  );
  const shippableSelected = selectedOrders.filter(
    (o) => !o.tracking_number && o.status !== 'cancelled' && o.status !== 'delivered'
  );
  const allPageSelected = pageItems.length > 0 && pageItems.every((o) => selectedIds.has(o.id));
  const somePageSelected = pageItems.some((o) => selectedIds.has(o.id));

  const toggleSelected = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleSelectPage = () =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pageItems.forEach((o) => next.delete(o.id));
      else pageItems.forEach((o) => next.add(o.id));
      return next;
    });

  const selectAllFiltered = () => setSelectedIds(new Set(filtered.map((o) => o.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const bulkChangeStatus = async (next: string) => {
    if (selectedOrders.length === 0) return;
    setBulkBusy(true);
    try {
      const { error } = await supabase
        .from('wholesale_orders')
        .update({ status: next })
        .in('id', selectedOrders.map((o) => o.id));
      if (error) throw error;
      toast.success(`${selectedOrders.length} order${selectedOrders.length === 1 ? '' : 's'} → ${statusMeta(next).label}`);
      clearSelection();
      await refresh();
    } catch (e) {
      toast.error((e as Error)?.message || 'Failed to update orders');
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkSendToSteadfast = async () => {
    const targets = shippableSelected;
    if (targets.length === 0) return;
    setBulkBusy(true);
    let ok = 0;
    const failed: string[] = [];
    // One at a time: Steadfast rate-limits, and a failure on one order must not stop the rest.
    for (const order of targets) {
      try {
        await dispatchToSteadfast(order, shipFormFor(order));
        ok += 1;
      } catch (e) {
        failed.push(`${order.order_number}: ${(e as Error)?.message || 'failed'}`);
      }
    }
    setBulkBusy(false);
    setBulkShipOpen(false);
    if (ok) toast.success(`${ok} order${ok === 1 ? '' : 's'} sent to Steadfast`);
    if (failed.length) toast.error(`${failed.length} failed — ${failed.join('; ')}`, { duration: 10000 });
    clearSelection();
    await refresh();
  };

  const bulkDelete = async () => {
    if (selectedOrders.length === 0) return;
    setBulkBusy(true);
    try {
      const { error } = await supabase
        .from('wholesale_orders')
        .delete()
        .in('id', selectedOrders.map((o) => o.id));
      if (error) throw error;
      toast.success(`${selectedOrders.length} order${selectedOrders.length === 1 ? '' : 's'} deleted`);
      setBulkDeleteOpen(false);
      clearSelection();
      await refresh();
    } catch (e) {
      toast.error((e as Error)?.message || 'Failed to delete orders');
    } finally {
      setBulkBusy(false);
    }
  };

  const closeShip = () => {
    setToShip(null);
    setShipForm(null);
  };

  const sendToSteadfast = async () => {
    if (!toShip || !shipForm) return;
    const cod = Number(shipForm.cod_amount);
    if (shipForm.cod_amount.trim() === '' || !Number.isFinite(cod) || cod < 0) {
      toast.error('COD amount must be 0 or more');
      return;
    }
    if (!shipForm.recipient_name.trim() || !shipForm.recipient_phone.trim() || !shipForm.recipient_address.trim()) {
      toast.error('Name, phone and address are required');
      return;
    }

    setShipping(true);
    try {
      const { tracking, alreadyDispatched } = await dispatchToSteadfast(toShip, shipForm);
      toast.success(
        alreadyDispatched
          ? `${toShip.order_number} was already sent to Steadfast (${tracking})`
          : `${toShip.order_number} sent to Steadfast${tracking ? ` — ${tracking}` : ''}`
      );
      closeShip();
      await refresh();
    } catch (e) {
      toast.error((e as Error)?.message || 'Failed to send order to Steadfast');
    } finally {
      setShipping(false);
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
              placeholder="Search order #, name, shop, phone, address, tracking..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {selectedOrders.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
              <span className="text-sm font-medium">
                {selectedOrders.length} selected
                <span className="ml-1 font-normal text-muted-foreground">
                  · {selectedOrders.reduce((n, o) => n + o.total_quantity, 0)} pcs ·{' '}
                  {bdt(selectedOrders.reduce((n, o) => n + Number(o.subtotal), 0))}
                </span>
              </span>
              {selectedOrders.length < filtered.length && (
                <Button size="sm" variant="link" className="h-auto px-1" onClick={selectAllFiltered}>
                  Select all {filtered.length}
                </Button>
              )}
              <Button size="sm" variant="link" className="h-auto px-1" onClick={clearSelection}>
                Clear
              </Button>
              <div className="ml-auto flex flex-wrap gap-2">
                <Select value="" onValueChange={bulkChangeStatus} disabled={bulkBusy}>
                  <SelectTrigger className="h-8 w-44">
                    <SelectValue placeholder={bulkBusy ? 'Working...' : `Change ${selectedOrders.length} status`} />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => {
                    setPrintOrders(selectedOrders);
                    setPrintKind('invoice');
                  }}
                >
                  <Printer className="mr-1 h-3.5 w-3.5" /> Print {selectedOrders.length} invoice
                  {selectedOrders.length === 1 ? '' : 's'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => {
                    setPrintOrders(selectedOrders);
                    setPrintKind('sticker');
                  }}
                >
                  <Tag className="mr-1 h-3.5 w-3.5" /> Print {selectedOrders.length} sticker
                  {selectedOrders.length === 1 ? '' : 's'}
                </Button>
                <Button
                  size="sm"
                  className="h-8"
                  disabled={bulkBusy || shippableSelected.length === 0}
                  onClick={() => setBulkShipOpen(true)}
                >
                  <Truck className="mr-1 h-3.5 w-3.5" /> Send {shippableSelected.length} to Steadfast
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-destructive hover:text-destructive"
                  disabled={bulkBusy}
                  onClick={() => setBulkDeleteOpen(true)}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete {selectedOrders.length}
                </Button>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="Select all orders on this page"
                    checked={allPageSelected ? true : somePageSelected ? 'indeterminate' : false}
                    onCheckedChange={toggleSelectPage}
                    disabled={pageItems.length === 0}
                  />
                </TableHead>
                <TableHead className="w-10" />
                <TableHead>Order</TableHead>
                <TableHead>Buyer</TableHead>
                <TableHead className="text-right">Pieces</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tracking</TableHead>
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
                    <TableRow
                      className={isOpen ? 'border-b-0' : undefined}
                      data-state={selectedIds.has(order.id) ? 'selected' : undefined}
                    >
                      <TableCell>
                        <Checkbox
                          aria-label={`Select ${order.order_number}`}
                          checked={selectedIds.has(order.id)}
                          onCheckedChange={() => toggleSelected(order.id)}
                        />
                      </TableCell>
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
                      <TableCell>
                        {order.tracking_number ? (
                          <div>
                            <a
                              href={`https://steadfast.com.bd/t/${order.tracking_number}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                            >
                              <Truck className="h-3.5 w-3.5" /> {order.tracking_number}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                            <div className="text-xs text-muted-foreground">
                              Steadfast
                              {order.courier_sent_at &&
                                ` · ${format(new Date(order.courier_sent_at), 'dd MMM, h:mm a')}`}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not sent</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {!order.tracking_number && order.status !== 'cancelled' && order.status !== 'delivered' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8"
                              disabled={busyId === order.id}
                              onClick={() => {
                                setToShip(order);
                                setShipForm(shipFormFor(order));
                              }}
                            >
                              <Truck className="mr-1 h-3.5 w-3.5" /> Steadfast
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            aria-label="Print invoice"
                            title="Print invoice"
                            onClick={() => {
                              setPrintOrders([order]);
                              setPrintKind('invoice');
                            }}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
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
                        <TableCell colSpan={2} />
                        <TableCell colSpan={7} className="py-4">
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
                  <TableCell colSpan={9} className="py-12 text-center text-muted-foreground">
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

      <Dialog open={!!toShip} onOpenChange={(open) => !open && !shipping && closeShip()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send {toShip?.order_number} to Steadfast</DialogTitle>
            <DialogDescription>
              Check the details before sending. Adjust the COD amount for any advance payment or
              agreed delivery charge.
            </DialogDescription>
          </DialogHeader>
          {shipForm && (
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="ws-ship-name">Recipient name</Label>
                <Input
                  id="ws-ship-name"
                  value={shipForm.recipient_name}
                  onChange={(e) => setShipForm({ ...shipForm, recipient_name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="ws-ship-phone">Phone</Label>
                  <Input
                    id="ws-ship-phone"
                    value={shipForm.recipient_phone}
                    onChange={(e) => setShipForm({ ...shipForm, recipient_phone: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ws-ship-cod">COD amount (৳)</Label>
                  <Input
                    id="ws-ship-cod"
                    type="number"
                    min={0}
                    value={shipForm.cod_amount}
                    onChange={(e) => setShipForm({ ...shipForm, cod_amount: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ws-ship-address">Address</Label>
                <Textarea
                  id="ws-ship-address"
                  rows={2}
                  value={shipForm.recipient_address}
                  onChange={(e) => setShipForm({ ...shipForm, recipient_address: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ws-ship-items">Item description</Label>
                <Input
                  id="ws-ship-items"
                  value={shipForm.item_description}
                  onChange={(e) => setShipForm({ ...shipForm, item_description: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ws-ship-note">Note for courier</Label>
                <Textarea
                  id="ws-ship-note"
                  rows={2}
                  value={shipForm.note}
                  onChange={(e) => setShipForm({ ...shipForm, note: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={shipping} onClick={closeShip}>
              Cancel
            </Button>
            <Button onClick={sendToSteadfast} disabled={shipping}>
              {shipping ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Truck className="mr-1 h-4 w-4" />}
              Send to Steadfast
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <InvoicePrintDialog
        orders={printKind === 'invoice' ? printOrders.map(toPrintable) : []}
        open={printKind === 'invoice'}
        onOpenChange={(open) => !open && setPrintKind(null)}
        markPrinted={false}
      />
      <StickerPrintDialog
        orders={printKind === 'sticker' ? printOrders.map(toPrintable) : []}
        open={printKind === 'sticker'}
        onOpenChange={(open) => !open && setPrintKind(null)}
        markPrinted={false}
      />

      <AlertDialog open={bulkShipOpen} onOpenChange={(open) => !open && !bulkBusy && setBulkShipOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send {shippableSelected.length} orders to Steadfast?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Each order is sent with its buyer's name, phone and address, and its full total as COD
                  ({bdt(shippableSelected.reduce((n, o) => n + Number(o.subtotal), 0))} in all). To change the
                  COD for an advance payment or delivery charge, use the single Steadfast button on that row
                  instead.
                </p>
                {selectedOrders.length > shippableSelected.length && (
                  <p>
                    {selectedOrders.length - shippableSelected.length} selected order(s) are skipped — already
                    sent, delivered or cancelled.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                bulkSendToSteadfast();
              }}
              disabled={bulkBusy}
            >
              {bulkBusy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Send to Steadfast
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={(open) => !open && !bulkBusy && setBulkDeleteOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedOrders.length} orders?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes {selectedOrders.map((o) => o.order_number).join(', ')}. To keep a
              record, set them to Cancelled instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkBusy}>Keep</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                bulkDelete();
              }}
              disabled={bulkBusy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
