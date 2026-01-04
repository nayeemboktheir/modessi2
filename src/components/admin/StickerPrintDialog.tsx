import { useRef, useEffect, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tag } from 'lucide-react';
import { OrderSticker } from './OrderSticker';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface OrderItem {
  id: string;
  product_name: string;
  product_image: string | null;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string;
  total: number;
  subtotal: number;
  shipping_cost: number | null;
  discount: number | null;
  shipping_name: string;
  shipping_phone: string;
  shipping_street: string;
  shipping_city: string;
  shipping_district: string;
  shipping_postal_code: string | null;
  tracking_number: string | null;
  notes: string | null;
  created_at: string;
  order_items: OrderItem[];
}

interface StickerPrintDialogProps {
  orders: Order[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrdersPrinted?: (orderIds: string[]) => void;
}

export function StickerPrintDialog({
  orders,
  open,
  onOpenChange,
  onOrdersPrinted,
}: StickerPrintDialogProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [shopName, setShopName] = useState('Your Shop');
  const [shopLogo, setShopLogo] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadShopSettings();
    }
  }, [open]);

  const loadShopSettings = async () => {
    try {
      const { data } = await supabase
        .from('admin_settings')
        .select('key, value')
        .in('key', ['shop_name', 'shop_logo_url']);

      data?.forEach((setting) => {
        if (setting.key === 'shop_name') setShopName(setting.value);
        if (setting.key === 'shop_logo_url') setShopLogo(setting.value);
      });
    } catch (error) {
      console.error('Failed to load shop settings:', error);
    }
  };

  const markOrdersAsPrinted = async () => {
    try {
      const orderIds = orders.map(o => o.id);
      
      const { error } = await supabase
        .from('orders')
        .update({ is_printed: true })
        .in('id', orderIds);

      if (error) throw error;

      toast.success(`${orders.length} order(s) marked as printed`);
      onOrdersPrinted?.(orderIds);
    } catch (error) {
      console.error('Failed to mark orders as printed:', error);
      toast.error('Failed to update print status');
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Stickers-${new Date().toISOString().split('T')[0]}`,
    pageStyle: `
      @page {
        size: A5;
        margin: 0;
      }
      @media print {
        html, body {
          height: 100%;
          margin: 0 !important;
          padding: 0 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
    `,
    onAfterPrint: () => {
      markOrdersAsPrinted();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Print Stickers - A5 ({orders.length})</span>
            <Button onClick={() => handlePrint()} className="gap-2">
              <Tag className="h-4 w-4" />
              Print All (A5)
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="border rounded-lg overflow-hidden bg-gray-100 p-4">
          <div ref={printRef}>
            {orders.map((order, index) => (
              <div
                key={order.id}
                style={{
                  pageBreakAfter: index < orders.length - 1 ? 'always' : 'auto',
                  pageBreakInside: 'avoid',
                }}
              >
                <OrderSticker 
                  order={order} 
                  shopName={shopName} 
                  shopLogo={shopLogo}
                />
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
