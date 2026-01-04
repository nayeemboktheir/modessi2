import { useState, useEffect } from 'react';
import { getAllDraftOrders, deleteDraftOrder } from '@/services/adminService';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Search, 
  Eye, 
  Trash2, 
  ShoppingCart, 
  Clock,
  User,
  Phone,
  MapPin,
  Package
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface DraftOrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

interface DraftOrder {
  id: string;
  session_id: string;
  user_id?: string;
  shipping_name?: string;
  shipping_phone?: string;
  shipping_street?: string;
  shipping_district?: string;
  shipping_city?: string;
  shipping_postal_code?: string;
  items: DraftOrderItem[];
  subtotal: number;
  shipping_cost: number;
  total: number;
  created_at: string;
  updated_at: string;
  is_converted: boolean;
  converted_at?: string;
}

export default function AdminIncompleteOrders() {
  const [draftOrders, setDraftOrders] = useState<DraftOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<DraftOrder | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadDraftOrders();
  }, []);

  const loadDraftOrders = async () => {
    try {
      setIsLoading(true);
      const data = await getAllDraftOrders();
      // Parse items from JSON
      const parsedOrders = (data || []).map(order => ({
        ...order,
        items: (typeof order.items === 'string' ? JSON.parse(order.items) : order.items) as DraftOrderItem[]
      }));
      setDraftOrders(parsedOrders);
    } catch (error) {
      console.error('Error loading draft orders:', error);
      toast({
        title: "Error loading incomplete orders",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredOrders = draftOrders.filter(order => {
    const searchLower = searchQuery.toLowerCase();
    return (
      order.shipping_name?.toLowerCase().includes(searchLower) ||
      order.shipping_phone?.toLowerCase().includes(searchLower) ||
      order.session_id.toLowerCase().includes(searchLower)
    );
  });

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this incomplete order?')) return;
    
    try {
      await deleteDraftOrder(id);
      setDraftOrders(prev => prev.filter(o => o.id !== id));
      toast({ title: "Incomplete order deleted" });
    } catch (error) {
      console.error('Error deleting draft order:', error);
      toast({
        title: "Error deleting order",
        variant: "destructive"
      });
    }
  };

  const openDetail = (order: DraftOrder) => {
    setSelectedOrder(order);
    setIsDetailOpen(true);
  };

  const formatPrice = (price: number) => {
    return `৳${price?.toLocaleString('en-BD') || 0}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Incomplete Orders</h1>
          <p className="text-muted-foreground">View abandoned carts and incomplete checkouts</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card rounded-lg p-4 border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500/10 rounded-full flex items-center justify-center">
              <ShoppingCart className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{draftOrders.filter(o => !o.is_converted).length}</p>
              <p className="text-sm text-muted-foreground">Pending</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-lg p-4 border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center">
              <Package className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{draftOrders.filter(o => o.is_converted).length}</p>
              <p className="text-sm text-muted-foreground">Converted</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-lg p-4 border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {formatPrice(draftOrders.filter(o => !o.is_converted).reduce((sum, o) => sum + (o.total || 0), 0))}
              </p>
              <p className="text-sm text-muted-foreground">Potential Revenue</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone, or session..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No incomplete orders found
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{order.shipping_name || 'Unknown'}</p>
                      <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                        {order.shipping_street || 'No address'}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm">{order.shipping_phone || 'N/A'}</p>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{order.items?.length || 0}</span> items
                  </TableCell>
                  <TableCell className="font-semibold">
                    {formatPrice(order.total)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={order.is_converted ? "default" : "secondary"}>
                      {order.is_converted ? 'Converted' : 'Abandoned'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(order.updated_at), 'MMM dd, yyyy HH:mm')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDetail(order)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(order.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Incomplete Order Details</DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-6">
              {/* Customer Info */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <User className="h-4 w-4" /> Customer Information
                  </h3>
                  <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                    <p><span className="text-muted-foreground">Name:</span> {selectedOrder.shipping_name || 'Not provided'}</p>
                    <p className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      {selectedOrder.shipping_phone || 'Not provided'}
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> Shipping Address
                  </h3>
                  <div className="bg-muted/50 rounded-lg p-4">
                    {selectedOrder.shipping_street ? (
                      <p>
                        {selectedOrder.shipping_street}<br />
                        {selectedOrder.shipping_district}, {selectedOrder.shipping_city}
                        {selectedOrder.shipping_postal_code && ` - ${selectedOrder.shipping_postal_code}`}
                      </p>
                    ) : (
                      <p className="text-muted-foreground">No address provided</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4" /> Cart Items
                </h3>
                <div className="border rounded-lg divide-y">
                  {selectedOrder.items?.length > 0 ? (
                    selectedOrder.items.map((item, index) => (
                      <div key={index} className="flex items-center gap-4 p-4">
                        {item.image && (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-16 h-16 object-cover rounded"
                          />
                        )}
                        <div className="flex-1">
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatPrice(item.price)} × {item.quantity}
                          </p>
                        </div>
                        <p className="font-semibold">
                          {formatPrice(item.price * item.quantity)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="p-4 text-center text-muted-foreground">No items in cart</p>
                  )}
                </div>
              </div>

              {/* Totals */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatPrice(selectedOrder.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>{selectedOrder.shipping_cost === 0 ? 'Free' : formatPrice(selectedOrder.shipping_cost)}</span>
                </div>
                <div className="flex justify-between font-semibold text-lg border-t pt-2">
                  <span>Total</span>
                  <span className="text-primary">{formatPrice(selectedOrder.total)}</span>
                </div>
              </div>

              {/* Timestamps */}
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Created: {format(new Date(selectedOrder.created_at), 'MMM dd, yyyy HH:mm:ss')}</p>
                <p>Last Updated: {format(new Date(selectedOrder.updated_at), 'MMM dd, yyyy HH:mm:ss')}</p>
                {selectedOrder.converted_at && (
                  <p className="text-green-600">
                    Converted: {format(new Date(selectedOrder.converted_at), 'MMM dd, yyyy HH:mm:ss')}
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}