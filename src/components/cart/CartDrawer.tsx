import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Minus, ShoppingBag, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { 
  selectCartItems, 
  selectCartTotal, 
  selectIsCartOpen,
  closeCart,
  removeFromCart,
  updateQuantity
} from '@/store/slices/cartSlice';

const CartDrawer = () => {
  const items = useAppSelector(selectCartItems);
  const total = useAppSelector(selectCartTotal);
  const isOpen = useAppSelector(selectIsCartOpen);
  const dispatch = useAppDispatch();

  const formatPrice = (price: number) => {
    return `৳${price.toLocaleString('en-BD')}`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/50 z-50"
            onClick={() => dispatch(closeCart())}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-background shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <ShoppingBag className="h-6 w-6 text-primary" />
                <h2 className="text-xl font-semibold">Your Cart</h2>
                <span className="bg-primary text-primary-foreground text-sm px-2 py-0.5 rounded-full">
                  {items.length}
                </span>
              </div>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => dispatch(closeCart())}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-6">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <ShoppingBag className="h-16 w-16 text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">Your cart is empty</h3>
                  <p className="text-muted-foreground mb-6">
                    Start shopping to add items to your cart
                  </p>
                  <Button onClick={() => dispatch(closeCart())} asChild>
                    <Link to="/products">
                      Browse Products
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((item) => {
                    const itemKey = item.variation?.id ? `${item.product.id}-${item.variation.id}` : item.product.id;
                    const displayPrice = item.variation?.price ?? item.product.price;
                    
                    return (
                      <motion.div
                        key={itemKey}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -100 }}
                        className="flex gap-4 p-4 bg-muted/50 rounded-lg"
                      >
                        <img
                          src={item.product.images[0]}
                          alt={item.product.name}
                          className="w-20 h-20 object-cover rounded-lg"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-foreground truncate">
                            {item.product.name}
                          </h4>
                          {item.variation && (
                            <p className="text-sm text-muted-foreground">
                              {item.variation.name}
                            </p>
                          )}
                          <p className="text-primary font-semibold mt-1">
                            {formatPrice(displayPrice)}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => dispatch(updateQuantity({ 
                                productId: item.product.id,
                                variationId: item.variation?.id,
                                quantity: item.quantity - 1 
                              }))}
                              disabled={item.quantity <= 1}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="w-8 text-center font-medium">
                              {item.quantity}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => dispatch(updateQuantity({ 
                                productId: item.product.id,
                                variationId: item.variation?.id,
                                quantity: item.quantity + 1 
                              }))}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => dispatch(removeFromCart({ productId: item.product.id, variationId: item.variation?.id }))}
                        >
                          <X className="h-5 w-5" />
                        </Button>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="p-6 border-t border-border space-y-4">
                <div className="flex items-center justify-between text-lg">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-bold text-foreground">{formatPrice(total)}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Shipping and taxes calculated at checkout
                </p>
                <div className="space-y-2">
                  <Button 
                    variant="cta" 
                    size="lg" 
                    className="w-full"
                    onClick={() => dispatch(closeCart())}
                    asChild
                  >
                    <Link to="/checkout">
                      Proceed to Checkout
                      <ArrowRight className="h-5 w-5 ml-2" />
                    </Link>
                  </Button>
                  <Button 
                    variant="outline" 
                    size="lg" 
                    className="w-full"
                    onClick={() => dispatch(closeCart())}
                    asChild
                  >
                    <Link to="/cart">
                      View Cart
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CartDrawer;
