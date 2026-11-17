import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Check,
  CheckCircle,
  Clock,
  Handshake,
  Loader2,
  Package,
  Plus,
  Printer,
  Send,
  ShoppingBag,
  Tag,
  Trash2,
  TrendingUp,
  Truck,
  Wallet,
  XCircle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { updateOrderStatus } from '@/services/adminService';
import { InvoicePrintDialog } from '@/components/admin/InvoicePrintDialog';
import { StickerPrintDialog } from '@/components/admin/StickerPrintDialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DEFAULT_DELIVERY_CHARGE, settleParcel, settlementTotals } from '@/lib/partnerSettlement';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

// Admin → Partner Orders: orders resellers (e.g. Maxora Outlet) sent through partner-api,
// which Modessi packs, ships and collects COD for, and the running balance with each partner:
// what Modessi owes them for delivered parcels minus what it has paid (partner_payments).
// The partner sees the same figures on its own admin.

// Same statuses as Admin → Orders. partner-api reads orders.status, so a change here reaches the
// partner on its next sync. No customer SMS: the customer belongs to the partner, not Modessi.
const statusOptions = [
  { value: 'pending', label: 'Pending', icon: Clock },
  { value: 'processing', label: 'Processing', icon: Package },
  { value: 'confirmed', label: 'Confirmed', icon: CheckCircle },
  { value: 'shipped', label: 'Shipped', icon: Truck },
  { value: 'delivered', label: 'Delivered', icon: CheckCircle },
  { value: 'returned', label: 'Returned', icon: XCircle },
  { value: 'cancelled', label: 'Cancelled', icon: XCircle },
];

// The settlement fields plus everything the invoice and sticker print dialogs read.
const ORDER_FIELDS = `id, order_number, status, shipping_name, courier_status, courier_cod_amount, courier_delivery_charge,
  tracking_number, payment_status, payment_method, total, subtotal, shipping_cost, discount, shipping_phone,
  shipping_street, shipping_city, shipping_district, shipping_postal_code, notes, invoice_note, steadfast_note,
  steadfast_consignment_id, created_at, is_printed,
  order_items (id, product_name, product_image, quantity, price, variation_name)`;

interface PartnerOrder {
  id: string;
  order_number: string;
  status: string;
  shipping_name: string;
  courier_status: string | null;
  courier_cod_amount: number | null;
  courier_delivery_charge: number | null;
  tracking_number: string | null;
  is_printed: boolean | null;
  [key: string]: unknown;
}

interface LinkRow {
  partner: string;
  partner_order_number: string | null;
  cod_amount: number | null;
  wholesale_total: number | null;
  created_at: string;
  updated_at: string | null;
  orders: PartnerOrder | null;
}

interface Payment {
  id: string;
  partner: string;
  amount: number;
  paid_at: string;
  note: string | null;
  recorded_by: string;
}

const formatTk = (value: number | null | undefined) => {
  if (value == null) return '—';
  const rounded = Math.round(value);
  const abs = Math.abs(rounded).toLocaleString('en-US');
  return rounded < 0 ? `-৳${abs}` : `৳${abs}`;
};

const parcelOf = (r: LinkRow) => ({
  status: r.orders?.status ?? 'pending',
  cod_amount: r.cod_amount,
  wholesale_total: r.wholesale_total,
  courier_status: r.orders?.courier_status ?? null,
  courier_cod_amount: r.orders?.courier_cod_amount ?? null,
  courier_delivery_charge: r.orders?.courier_delivery_charge ?? null,
});

export default function AdminPartnerOrders() {
  const queryClient = useQueryClient();
  const [partner, setPartner] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [paidAt, setPaidAt] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [sendingSteadfast, setSendingSteadfast] = useState(false);

  const linksQuery = useQuery({
    queryKey: ['partner-order-links'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partner_order_links' as never)
        .select(`partner, partner_order_number, cod_amount, wholesale_total, created_at, updated_at, orders(${ORDER_FIELDS})`)
        .order('created_at', { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as unknown as LinkRow[];
    },
  });

  const paymentsQuery = useQuery({
    queryKey: ['partner-payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partner_payments' as never)
        .select('id, partner, amount, paid_at, note, recorded_by')
        .order('paid_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Payment[];
    },
  });

  const partners = useMemo(
    () => Array.from(new Set((linksQuery.data ?? []).map((r) => r.partner))).sort(),
    [linksQuery.data],
  );
  const current = partner ?? partners[0] ?? null;
  const rows = useMemo(() => (linksQuery.data ?? []).filter((r) => r.partner === current), [linksQuery.data, current]);
  const payments = useMemo(() => (paymentsQuery.data ?? []).filter((p) => p.partner === current), [paymentsQuery.data, current]);
  const totals = useMemo(() => settlementTotals(rows.map(parcelOf), payments), [rows, payments]);

  // The cards count a parcel from the moment it ships (marked Shipped/Delivered, or handed to the
  // courier), not only once Steadfast confirms delivery. Until Steadfast reports, a shipped parcel
  // counts at the COD the partner asked for and an estimated delivery charge — hence the "~".
  // Returned parcels count only their delivery charge, which is the partner's.
  const breakdown = useMemo(() => {
    const b = { selling: 0, wholesale: 0, delivery: 0, shipped: 0, delivered: 0, returned: 0, estimated: false };
    for (const r of rows) {
      const p = parcelOf(r);
      const s = settleParcel(p);
      const charge = Number(p.courier_delivery_charge ?? DEFAULT_DELIVERY_CHARGE);
      const wholesale = p.wholesale_total == null ? null : Number(p.wholesale_total);
      if (s.status === 'returned') {
        b.returned++;
        b.delivery += charge;
        b.estimated ||= s.estimated;
        continue;
      }
      if (wholesale == null) continue; // no wholesale price yet: flagged "check" in the table
      const shipped =
        s.status === 'delivered' ||
        (s.status === 'pending' &&
          (['shipped', 'delivered'].includes(p.status) || !!r.orders?.tracking_number || !!r.orders?.steadfast_consignment_id));
      if (!shipped) continue;
      if (s.status === 'delivered') b.delivered++;
      else b.shipped++;
      const confirmed = s.status === 'delivered';
      b.selling += Number((confirmed ? p.courier_cod_amount : null) ?? p.cod_amount ?? 0);
      b.wholesale += wholesale;
      b.delivery += charge;
      b.estimated ||= !confirmed || p.courier_delivery_charge == null;
    }
    return { ...b, net: b.selling - b.wholesale - b.delivery };
  }, [rows]);

  const reload = () => queryClient.invalidateQueries({ queryKey: ['partner-payments'] });

  // Patch orders in the cached list so the table and the balance update without a refetch.
  const patchOrders = (ids: string[], patch: Partial<PartnerOrder>) => {
    const idSet = new Set(ids);
    queryClient.setQueryData<LinkRow[]>(['partner-order-links'], (prev) =>
      (prev ?? []).map((r) => (r.orders && idSet.has(r.orders.id) ? { ...r, orders: { ...r.orders, ...patch } } : r)),
    );
  };

  // The status tabs filter only the table; the balance above always covers every order.
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of rows) {
      const s = r.orders?.status;
      if (s) counts[s] = (counts[s] ?? 0) + 1;
    }
    return counts;
  }, [rows]);
  const visibleRows = useMemo(
    () => (statusFilter === 'all' ? rows : rows.filter((r) => r.orders?.status === statusFilter)),
    [rows, statusFilter],
  );

  const rowOrders = useMemo(() => visibleRows.map((r) => r.orders).filter(Boolean) as PartnerOrder[], [visibleRows]);
  const selectedOrders = useMemo(() => rowOrders.filter((o) => selected.has(o.id)), [rowOrders, selected]);
  const allSelected = rowOrders.length > 0 && selectedOrders.length === rowOrders.length;

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rowOrders.map((o) => o.id)));

  const changeStatus = async (order: PartnerOrder, status: string) => {
    if (status === order.status) return;
    setUpdatingId(order.id);
    try {
      await updateOrderStatus(order.id, status);
      patchOrders([order.id], { status });
      toast.success(`#${order.order_number} marked ${status}`);
    } catch (err) {
      toast.error((err as Error).message || 'Failed to update order status');
    } finally {
      setUpdatingId(null);
    }
  };

  const bulkChangeStatus = async (status: string) => {
    if (selectedOrders.length === 0) return;
    setBulkUpdating(true);
    const done: string[] = [];
    for (const order of selectedOrders) {
      try {
        await updateOrderStatus(order.id, status);
        done.push(order.id);
      } catch (err) {
        console.error(`Failed to update order ${order.order_number}:`, err);
      }
    }
    patchOrders(done, { status });
    const failed = selectedOrders.length - done.length;
    if (failed > 0) toast.warning(`Updated ${done.length} orders, ${failed} failed`);
    else toast.success(`Updated ${done.length} orders to ${status}`);
    setSelected(new Set());
    setBulkUpdating(false);
  };

  // Same steadfast-courier call as Admin → Orders, but collecting the COD the partner asked for.
  // steadfast-courier marks the order 'processing'; a partner parcel handed to the courier is
  // shipped, so it is moved on to 'shipped' to keep the status tabs in step with the cards.
  const sendToSteadfast = async () => {
    const links = rows.filter((r) => r.orders && selected.has(r.orders.id));
    const toSend = links.filter((r) => !r.orders!.tracking_number);
    const skipped = links.length - toSend.length;
    if (toSend.length === 0) {
      toast.error('The selected orders are already with Steadfast');
      return;
    }
    setSendingSteadfast(true);
    const sent: { id: string; tracking: string; consignment: string }[] = [];
    const failed: string[] = [];
    const concurrency = 5;
    for (let i = 0; i < toSend.length; i += concurrency) {
      await Promise.all(
        toSend.slice(i, i + concurrency).map(async (r) => {
          const o = r.orders!;
          const items = (o.order_items as { product_name: string; variation_name: string | null; quantity: number }[]) ?? [];
          const address = `${o.shipping_street}, ${o.shipping_district}, ${o.shipping_city}${o.shipping_postal_code ? `, ${o.shipping_postal_code}` : ''}`;
          const note =
            (o.steadfast_note as string) ||
            (o.notes as string) ||
            `Order items: ${items.map((it) => `${it.product_name}${it.variation_name ? ` (${it.variation_name})` : ''} x${it.quantity}`).join(', ')}`;
          try {
            const { data, error } = await supabase.functions.invoke('steadfast-courier', {
              body: {
                orderId: o.id,
                invoice: o.order_number,
                recipient_name: o.shipping_name,
                recipient_phone: o.shipping_phone,
                recipient_address: address,
                cod_amount: Number(r.cod_amount ?? o.total ?? 0),
                note,
              },
            });
            if (error || data?.error || !data?.success || !data?.tracking_code) {
              failed.push(`#${o.order_number}: ${data?.error || data?.message || error?.message || 'failed'}`);
              return;
            }
            const tracking = String(data.tracking_code);
            sent.push({ id: o.id, tracking, consignment: data.consignment_id ? String(data.consignment_id) : tracking });
          } catch (err) {
            failed.push(`#${o.order_number}: ${(err as Error).message}`);
          }
        }),
      );
    }
    for (const s of sent) {
      try {
        await updateOrderStatus(s.id, 'shipped');
        patchOrders([s.id], { tracking_number: s.tracking, steadfast_consignment_id: s.consignment, status: 'shipped' });
      } catch {
        patchOrders([s.id], { tracking_number: s.tracking, steadfast_consignment_id: s.consignment, status: 'processing' });
      }
    }
    setSelected(new Set());
    setSendingSteadfast(false);
    const extra = skipped ? ` (${skipped} already with Steadfast, skipped)` : '';
    if (failed.length) toast.warning(`Sent ${sent.length}, ${failed.length} failed${extra}`, { description: failed.join('; ') });
    else toast.success(`Sent ${sent.length} order${sent.length === 1 ? '' : 's'} to Steadfast${extra}`);
  };

  const togglePrinted = async (order: PartnerOrder) => {
    const value = !order.is_printed;
    const { error } = await supabase.from('orders').update({ is_printed: value }).eq('id', order.id);
    if (error) {
      toast.error('Failed to update print status');
      return;
    }
    patchOrders([order.id], { is_printed: value });
  };

  const onPrinted = (ids: string[]) => {
    patchOrders(ids, { is_printed: true });
    setSelected(new Set());
  };

  const addPayment = async () => {
    const value = Number(amount);
    if (!current || !Number.isFinite(value) || value === 0) {
      toast.error('Enter the amount paid');
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from('partner_payments' as never)
      .insert({ partner: current, amount: value, paid_at: paidAt, note: note.trim() || null, recorded_by: 'modessi' } as never);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Payment of ${formatTk(value)} to ${current} recorded`);
    setAmount('');
    setNote('');
    reload();
  };

  const removePayment = async (p: Payment) => {
    if (!confirm(`Delete the ${formatTk(p.amount)} payment of ${p.paid_at}?`)) return;
    const { error } = await supabase.from('partner_payments' as never).delete().eq('id', p.id);
    if (error) toast.error(error.message);
    else reload();
  };

  const error = linksQuery.error ?? paymentsQuery.error;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold">Partner Orders</h1>
        <p className="text-muted-foreground">Orders resellers send to Modessi to ship, and what Modessi owes them</p>
      </div>

      {error ? (
        <p className="text-sm text-destructive">
          {(error as Error).message}. Run supabase/migrations/20261116120000_partner_order_links.sql and
          20261116130000_partner_settlement.sql if you have not yet.
        </p>
      ) : linksQuery.isLoading || paymentsQuery.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : partners.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No partner orders yet.</p>
      ) : (
        <>
          {partners.length > 1 && (
            <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1 self-start w-fit">
              {partners.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setPartner(p);
                    setSelected(new Set());
                    setStatusFilter('pending');
                  }}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium capitalize',
                    p === current ? 'bg-background shadow-sm' : 'text-muted-foreground',
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 capitalize">
                <Wallet className="h-5 w-5" />
                Balance with {current}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Counted from the moment a parcel ships: what the customer pays minus wholesale and delivery; a returned
                parcel's delivery charge is the partner's. ~ figures firm up once Steadfast reports delivery.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    label: 'Confirmed Selling',
                    value: `${breakdown.shipped ? '~' : ''}${formatTk(breakdown.selling)}`,
                    sub: `${breakdown.shipped} shipped, ${breakdown.delivered} delivered`,
                    icon: Wallet,
                  },
                  {
                    label: '− Wholesale (Modessi)',
                    value: formatTk(breakdown.wholesale),
                    sub: 'Modessi cost of those orders',
                    icon: ShoppingBag,
                  },
                  {
                    label: '− Delivery',
                    value: `${breakdown.estimated ? '~' : ''}${formatTk(breakdown.delivery)}`,
                    sub: `Steadfast charges${breakdown.returned ? `, incl. ${breakdown.returned} returned` : ''}`,
                    icon: Truck,
                  },
                  {
                    label: '= Owed to partner',
                    value: `${breakdown.estimated ? '~' : ''}${formatTk(breakdown.net)}`,
                    sub: 'Selling − Wholesale − Delivery',
                    icon: TrendingUp,
                    highlight: true,
                  },
                ].map((c) => (
                  <div key={c.label} className={cn('rounded-xl border p-5', c.highlight && 'border-primary/40 shadow-sm')}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-medium">{c.label}</div>
                      <c.icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="mt-3 text-2xl font-semibold tabular-nums">{c.value}</div>
                    <div className="mt-2 text-xs text-muted-foreground">{c.sub}</div>
                  </div>
                ))}
              </div>
              {(breakdown.estimated || totals.review > 0) && (
                <p className="text-xs text-muted-foreground">
                  {breakdown.estimated && '~ Shipped parcels count at the partner\'s COD and an estimated ৳130 delivery charge until Steadfast reports the real figures. '}
                  {totals.review > 0 && `${totals.review} parcel${totals.review === 1 ? ' needs' : 's need'} a check (partly delivered or no wholesale price).`}
                </p>
              )}

              <div className="space-y-3">
                <div className="text-sm font-medium">Payments</div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="space-y-1.5">
                    <Label htmlFor="partner-pay-amount">Amount (৳)</Label>
                    <Input id="partner-pay-amount" type="number" className="w-full sm:w-36" value={amount} onChange={(e) => setAmount(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="partner-pay-date">Date</Label>
                    <Input id="partner-pay-date" type="date" className="w-full sm:w-40" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor="partner-pay-note">Note</Label>
                    <Input id="partner-pay-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="bKash, bank transfer…" />
                  </div>
                  <Button onClick={addPayment} disabled={busy || !amount}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Record payment
                  </Button>
                </div>
                {payments.length > 0 && (
                  <div className="divide-y rounded-md border text-sm">
                    {payments.map((p) => (
                      <div key={p.id} className="flex items-center gap-3 px-3 py-2">
                        <span className="w-24 tabular-nums text-muted-foreground">{p.paid_at}</span>
                        <span className="w-24 font-medium tabular-nums">{formatTk(p.amount)}</span>
                        <span className="flex-1 truncate text-muted-foreground">{p.note}</span>
                        <span className="text-xs text-muted-foreground">{p.recorded_by === 'partner' ? 'by partner' : 'by Modessi'}</span>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => removePayment(p)} aria-label="Delete payment">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-4">
              <CardTitle className="flex items-center gap-2">
                <Handshake className="h-5 w-5" />
                Orders
              </CardTitle>
              <div className="overflow-x-auto">
                <Tabs
                  value={statusFilter}
                  onValueChange={(v) => {
                    setStatusFilter(v);
                    setSelected(new Set());
                  }}
                  className="w-full"
                >
                  <TabsList className="h-auto p-1 bg-muted/50 inline-flex w-auto min-w-full">
                    {[...statusOptions, { value: 'all', label: 'All' }].map((s) => (
                      <TabsTrigger
                        key={s.value}
                        value={s.value}
                        className="data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-4"
                      >
                        {s.label}
                        <Badge variant="outline" className="ml-2 h-5 px-1.5 text-xs">
                          {s.value === 'all' ? rows.length : statusCounts[s.value] ?? 0}
                        </Badge>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
              {selectedOrders.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <Select onValueChange={bulkChangeStatus} disabled={bulkUpdating}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder={bulkUpdating ? 'Updating...' : `Change ${selectedOrders.length} Status`} />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          <div className="flex items-center gap-2">
                            <s.icon className="h-4 w-4" />
                            {s.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" className="gap-2" onClick={() => setInvoiceOpen(true)}>
                    <Printer className="h-4 w-4" />
                    Print {selectedOrders.length} Invoice{selectedOrders.length > 1 ? 's' : ''}
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={() => setStickerOpen(true)}>
                    <Tag className="h-4 w-4" />
                    Print {selectedOrders.length} Sticker{selectedOrders.length > 1 ? 's' : ''}
                  </Button>
                  <Button className="gap-2" onClick={sendToSteadfast} disabled={sendingSteadfast}>
                    {sendingSteadfast ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {sendingSteadfast ? 'Sending...' : `Send ${selectedOrders.length} to Steadfast`}
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                    </TableHead>
                    <TableHead>Modessi #</TableHead>
                    <TableHead>Partner #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Print</TableHead>
                    <TableHead>Courier</TableHead>
                    <TableHead className="text-right">Collect</TableHead>
                    <TableHead className="text-right">Wholesale</TableHead>
                    <TableHead className="text-right">Delivery</TableHead>
                    <TableHead className="text-right">Owed to partner</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={11} className="py-8 text-center text-sm text-muted-foreground">
                        No orders found
                      </TableCell>
                    </TableRow>
                  )}
                  {visibleRows.map((r) => {
                    const s = settleParcel(parcelOf(r));
                    return (
                      <TableRow key={r.orders?.id ?? r.partner_order_number}>
                        <TableCell>
                          {r.orders && (
                            <Checkbox
                              checked={selected.has(r.orders.id)}
                              onCheckedChange={() => toggleOne(r.orders!.id)}
                              aria-label={`Select ${r.orders.order_number}`}
                            />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          #{r.orders?.order_number ?? '—'}
                          <div className="text-xs font-normal text-muted-foreground">{format(new Date(r.created_at), 'dd MMM')}</div>
                        </TableCell>
                        <TableCell>
                          {r.partner_order_number ?? '—'}
                          {r.updated_at && <div className="text-xs text-muted-foreground">changed {format(new Date(r.updated_at), 'dd MMM HH:mm')}</div>}
                        </TableCell>
                        <TableCell>{r.orders?.shipping_name ?? '—'}</TableCell>
                        <TableCell>
                          {r.orders ? (
                            <Select
                              value={r.orders.status}
                              onValueChange={(v) => changeStatus(r.orders!, v)}
                              disabled={updatingId === r.orders.id}
                            >
                              <SelectTrigger className="h-8 w-[130px] text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {statusOptions.map((s) => (
                                  <SelectItem key={s.value} value={s.value}>
                                    <div className="flex items-center gap-2">
                                      <s.icon className="h-3 w-3" />
                                      {s.label}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell>
                          {r.orders && (
                            <button
                              type="button"
                              onClick={() => togglePrinted(r.orders!)}
                              className={cn(
                                'flex h-8 w-8 items-center justify-center rounded-full transition-colors',
                                r.orders.is_printed
                                  ? 'bg-green-100 text-green-600 hover:bg-green-200'
                                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200',
                              )}
                              title={r.orders.is_printed ? 'Printed - click to unmark' : 'Not printed - click to mark as printed'}
                            >
                              {r.orders.is_printed ? <Check className="h-5 w-5" /> : <Printer className="h-4 w-4" />}
                            </button>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="capitalize">{r.orders?.courier_status?.replace(/_/g, ' ') ?? '—'}</div>
                          {r.orders?.tracking_number && <div className="text-xs text-muted-foreground">{r.orders.tracking_number}</div>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatTk(r.orders?.courier_cod_amount ?? r.cod_amount)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatTk(r.wholesale_total)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatTk(r.orders?.courier_delivery_charge)}</TableCell>
                        <TableCell
                          className={cn(
                            'text-right tabular-nums font-medium',
                            s.owed == null ? 'text-muted-foreground' : s.owed >= 0 ? 'text-green-600' : 'text-destructive',
                          )}
                        >
                          {s.owed != null ? `${s.estimated ? '~' : ''}${formatTk(s.owed)}` : s.expected != null ? `(~${formatTk(s.expected)})` : '—'}
                          {s.review && <div className="text-xs font-normal text-amber-600">check</div>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <InvoicePrintDialog
        orders={selectedOrders as never}
        open={invoiceOpen}
        onOpenChange={setInvoiceOpen}
        onOrdersPrinted={onPrinted}
      />
      <StickerPrintDialog
        orders={selectedOrders as never}
        open={stickerOpen}
        onOpenChange={setStickerOpen}
        onOrdersPrinted={onPrinted}
      />
    </div>
  );
}
