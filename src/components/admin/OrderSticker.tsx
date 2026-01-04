import { forwardRef, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import JsBarcode from 'jsbarcode';

interface OrderItem {
  id: string;
  product_name: string;
  product_image?: string | null;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  order_number: string;
  status?: string;
  payment_status?: string;
  payment_method?: string;
  total: number;
  subtotal?: number;
  shipping_cost?: number | null;
  discount?: number | null;
  shipping_name: string;
  shipping_phone: string;
  shipping_street: string;
  shipping_city: string;
  shipping_district: string;
  shipping_postal_code: string | null;
  tracking_number: string | null;
  notes: string | null;
  created_at?: string;
  order_items: OrderItem[];
}

interface OrderStickerProps {
  order: Order;
  shopName?: string;
  shopLogo?: string | null;
}

const Barcode = ({ value }: { value: string }) => {
  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (barcodeRef.current && value) {
      try {
        JsBarcode(barcodeRef.current, value, {
          format: 'CODE128',
          width: 2,
          height: 50,
          displayValue: false,
          margin: 0,
        });
      } catch (e) {
        console.error('Barcode generation failed:', e);
      }
    }
  }, [value]);

  return <svg ref={barcodeRef} />;
};

export const OrderSticker = forwardRef<HTMLDivElement, OrderStickerProps>(
  ({ order, shopName = 'Your Shop', shopLogo }, ref) => {
    const totalItems = order.order_items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = order.subtotal || order.order_items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    return (
      <div
        ref={ref}
        className="bg-white text-black"
        style={{
          fontFamily: 'Arial, sans-serif',
          fontSize: '14px',
          width: '148mm',
          height: '210mm',
          padding: '10mm 12mm',
          boxSizing: 'border-box',
        }}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          {/* Logo Section */}
          <div className="flex-1">
            {shopLogo ? (
              <img src={shopLogo} alt={shopName} style={{ height: '50px', objectFit: 'contain' }} />
            ) : (
              <h1
                style={{
                  fontSize: '28px',
                  fontWeight: 'bold',
                  fontFamily: 'Georgia, serif',
                  margin: 0,
                }}
              >
                {shopName}
              </h1>
            )}
          </div>

          {/* Invoice Title & Barcode */}
          <div style={{ textAlign: 'right' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>INVOICE</h2>
            {order.tracking_number && (
              <div style={{ display: 'inline-block' }}>
                <Barcode value={order.tracking_number} />
              </div>
            )}
          </div>
        </div>

        {/* Billing & Shipping Info */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            marginBottom: '20px',
            fontSize: '13px',
          }}
        >
          {/* Billing To */}
          <div>
            <h3 style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>Billing To</h3>
            <p style={{ color: '#c53030', margin: '3px 0', fontSize: '14px', fontWeight: '600' }}>{order.shipping_name}</p>
            <p style={{ color: '#c53030', margin: '3px 0', fontSize: '14px', fontWeight: '600' }}>{order.shipping_phone}</p>
            <p style={{ color: '#c53030', margin: '3px 0', fontSize: '12px' }}>
              {order.shipping_street}, {order.shipping_district}, {order.shipping_city}
            </p>
          </div>

          {/* Invoice Details */}
          <div style={{ fontSize: '13px' }}>
            <p style={{ margin: '3px 0' }}>
              <span style={{ fontWeight: '600' }}>Invoice No:</span> {order.order_number.replace('ORD-', 'M')}
            </p>
            {order.created_at && (
              <p style={{ margin: '3px 0' }}>
                <span style={{ fontWeight: '600' }}>Invoice Date:</span>{' '}
                {format(new Date(order.created_at), 'dd/MM/yy')}
              </p>
            )}
            <p style={{ margin: '3px 0' }}>
              <span style={{ fontWeight: '600' }}>Total Items:</span> {totalItems}
            </p>
            <p style={{ margin: '3px 0' }}>
              <span style={{ fontWeight: '600' }}>Tracking:</span>{' '}
              {order.tracking_number || 'Pending'}
            </p>
          </div>
        </div>

        {/* Products Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
          <thead>
            <tr style={{ borderTop: '2px solid #000', borderBottom: '2px solid #000' }}>
              <th style={{ textAlign: 'left', padding: '8px 4px', fontSize: '13px' }}>PRODUCTS</th>
              <th style={{ textAlign: 'center', padding: '8px 4px', fontSize: '13px' }}>QTY</th>
              <th style={{ textAlign: 'center', padding: '8px 4px', fontSize: '13px' }}>PRICE</th>
              <th style={{ textAlign: 'right', padding: '8px 4px', fontSize: '13px' }}>AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {order.order_items.map((item) => (
              <tr key={item.id} style={{ borderBottom: '1px solid #e5e5e5' }}>
                <td style={{ padding: '8px 4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {item.product_image && (
                      <img
                        src={item.product_image}
                        alt={item.product_name}
                        style={{ width: '35px', height: '35px', objectFit: 'cover' }}
                      />
                    )}
                    <div>
                      <p style={{ fontWeight: '600', margin: 0, fontSize: '12px' }}>{item.product_name}</p>
                      <p style={{ color: '#c53030', fontSize: '11px', margin: '2px 0 0 0' }}>
                        ৳{Number(item.price).toFixed(0)}
                      </p>
                    </div>
                  </div>
                </td>
                <td style={{ textAlign: 'center', padding: '8px 4px', color: '#c53030', fontSize: '14px', fontWeight: '600' }}>
                  {item.quantity}
                </td>
                <td style={{ textAlign: 'center', padding: '8px 4px', color: '#c53030', fontSize: '13px' }}>
                  ৳{Number(item.price).toFixed(0)}
                </td>
                <td style={{ textAlign: 'right', padding: '8px 4px', fontSize: '14px', fontWeight: '600' }}>
                  ৳{(Number(item.price) * item.quantity).toFixed(0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Notes & Totals */}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {/* Notes */}
          <div style={{ color: '#c53030', fontSize: '13px', maxWidth: '50%' }}>
            {order.notes && <p style={{ fontWeight: '500' }}>Note: {order.notes}</p>}
          </div>

          {/* Totals */}
          <div style={{ textAlign: 'right', minWidth: '150px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>Sub Total</span>
              <span>৳{Number(subtotal).toFixed(0)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>Delivery Charge</span>
              <span style={{ color: '#c53030' }}>৳{Number(order.shipping_cost || 0).toFixed(0)}</span>
            </div>
            {order.discount && Number(order.discount) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: '#16a34a' }}>
                <span>Discount</span>
                <span>-৳{Number(order.discount).toFixed(0)}</span>
              </div>
            )}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 'bold',
                borderTop: '2px solid #000',
                paddingTop: '6px',
                marginTop: '4px',
                fontSize: '15px',
              }}
            >
              <span>Total:</span>
              <span>৳{Number(order.total).toFixed(0)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

OrderSticker.displayName = 'OrderSticker';
