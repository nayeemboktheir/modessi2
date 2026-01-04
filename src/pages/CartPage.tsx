import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trash2, Plus, Minus, ArrowLeft, ArrowRight, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { 
  selectCartItems, 
  selectCartTotal,
  removeFromCart,
  updateQuantity,
  clearCart
} from '@/store/slices/cartSlice';
import { toast } from 'sonner';

const CartPage = () => {
  const cartItems = useAppSelector(selectCartItems);
  const total = useAppSelector(selectCartTotal);
  const dispatch = useAppDispatch();

  const formatPrice = (price: number) => `৳${price.toLocaleString('en-BD')}`;

  const shippingCost = total >= 2000 ? 0 : 100;
  const grandTotal = total + shippingCost;

  const handleRemove = (productId: string, variationId?: string) => {
    dispatch(removeFromCart({ productId, variationId }));
    toast.success('Item removed from cart');
  };

  return (
    <div className="min-h-screen pt-40 pb-16 bg-background">
      <div className="container-custom">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-2">
            শপিং কার্ট
          </h1>
          <p className="text-muted-foreground">
            আপনার কার্টে {cartItems.length}টি পণ্য আছে
          </p>
        </div>

        {cartItems.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
              <ShoppingBag className="h-12 w-12 text-muted-foreground/50" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              আপনার কার্ট খালি
            </h2>
            <p className="text-muted-foreground mb-6">
              এখনও কোনো পণ্য যোগ করেননি
            </p>
            <Button asChild>
              <Link to="/products">
                <ArrowLeft className="h-4 w-4 mr-2" />
                কেনাকাটা করুন
              </Link>
            </Button>
          </motion.div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {cartItems.map((item, index) => {
                const itemKey = item.variation?.id ? `${item.product.id}-${item.variation.id}` : item.product.id;
                const displayPrice = item.variation?.price ?? item.product.price;
                const originalPrice = item.variation?.original_price ?? item.product.originalPrice;
                
                return (
                  <motion.div
                    key={itemKey}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex gap-4 p-4 bg-card rounded-xl border border-border"
                  >
                    <Link to={`/product/${item.product.slug}`}>
                      <img
                        src={item.product.images[0]}
                        alt={item.product.name}
                        className="w-24 h-24 md:w-32 md:h-32 object-cover rounded-lg"
                      />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link to={`/product/${item.product.slug}`}>
                        <h3 className="font-medium text-foreground line-clamp-2 hover:text-primary transition-colors">
                          {item.product.name}
                        </h3>
                      </Link>
                      {item.variation && (
                        <p className="text-sm font-medium text-primary mt-0.5">
                          {item.variation.name}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground mt-1">
                        {item.product.category}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-lg font-bold text-primary">
                          {formatPrice(displayPrice)}
                        </span>
                        {originalPrice && (
                          <span className="text-sm text-muted-foreground line-through">
                            {formatPrice(originalPrice)}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center border border-border rounded-lg">
                          <button
                            onClick={() => dispatch(updateQuantity({ 
                              productId: item.product.id,
                              variationId: item.variation?.id,
                              quantity: item.quantity - 1 
                            }))}
                            className="p-2 hover:bg-muted transition-colors"
                            disabled={item.quantity <= 1}
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="w-10 text-center font-medium">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => dispatch(updateQuantity({ 
                              productId: item.product.id,
                              variationId: item.variation?.id,
                              quantity: item.quantity + 1 
                            }))}
                            className="p-2 hover:bg-muted transition-colors"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <span className="font-semibold text-foreground">
                            {formatPrice(displayPrice * item.quantity)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemove(item.product.id, item.variation?.id)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              <div className="flex justify-between pt-4">
                <Button variant="outline" asChild>
                  <Link to="/products">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Continue Shopping
                  </Link>
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    dispatch(clearCart());
                    toast.success('Cart cleared');
                  }}
                  className="text-destructive hover:text-destructive"
                >
                  Clear Cart
                </Button>
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-card rounded-xl border border-border p-6 sticky top-44">
                <h2 className="text-xl font-semibold text-foreground mb-6">
                  Order Summary
                </h2>

                <div className="space-y-4 pb-6 border-b border-border">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal ({cartItems.length} items)</span>
                    <span>{formatPrice(total)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Shipping</span>
                    <span>{shippingCost === 0 ? 'Free' : formatPrice(shippingCost)}</span>
                  </div>
                  {shippingCost > 0 && (
                    <p className="text-sm text-primary">
                      Add {formatPrice(2000 - total)} more for free shipping!
                    </p>
                  )}
                </div>

                <div className="flex justify-between py-6 text-lg font-bold text-foreground">
                  <span>Total</span>
                  <span>{formatPrice(grandTotal)}</span>
                </div>

                <Button variant="cta" size="lg" className="w-full" asChild>
                  <Link to="/checkout">
                    Proceed to Checkout
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Link>
                </Button>

                <p className="text-xs text-muted-foreground text-center mt-4">
                  Taxes and shipping calculated at checkout
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CartPage;
