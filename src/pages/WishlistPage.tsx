import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trash2, ShoppingBag, ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { selectWishlistItems, removeFromWishlist } from '@/store/slices/wishlistSlice';
import { addToCart, openCart } from '@/store/slices/cartSlice';
import { toast } from 'sonner';

const WishlistPage = () => {
  const wishlistItems = useAppSelector(selectWishlistItems);
  const dispatch = useAppDispatch();

  const formatPrice = (price: number) => `৳${price.toLocaleString('en-BD')}`;

  const handleAddToCart = (product: typeof wishlistItems[0]) => {
    dispatch(addToCart({ product }));
    dispatch(openCart());
    toast.success('Added to cart!');
  };

  const handleRemove = (productId: string) => {
    dispatch(removeFromWishlist(productId));
    toast.success('Removed from wishlist');
  };

  return (
    <div className="min-h-screen pt-40 pb-16 bg-background">
      <div className="container-custom">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-2">
            My Wishlist
          </h1>
          <p className="text-muted-foreground">
            {wishlistItems.length} {wishlistItems.length === 1 ? 'item' : 'items'} saved
          </p>
        </div>

        {wishlistItems.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
              <ShoppingBag className="h-12 w-12 text-muted-foreground/50" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Your wishlist is empty
            </h2>
            <p className="text-muted-foreground mb-6">
              Start adding items you love to your wishlist
            </p>
            <Button asChild>
              <Link to="/products">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Browse Products
              </Link>
            </Button>
          </motion.div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {wishlistItems.map((product, index) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-card rounded-xl border border-border overflow-hidden group"
              >
                <Link to={`/product/${product.slug}`}>
                  <div className="aspect-square overflow-hidden bg-muted">
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                </Link>
                <div className="p-4">
                  <Link to={`/product/${product.slug}`}>
                    <h3 className="font-medium text-foreground line-clamp-2 hover:text-primary transition-colors">
                      {product.name}
                    </h3>
                  </Link>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-lg font-bold text-primary">
                      {formatPrice(product.price)}
                    </span>
                    {product.originalPrice && (
                      <span className="text-sm text-muted-foreground line-through">
                        {formatPrice(product.originalPrice)}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="cta"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleAddToCart(product)}
                    >
                      Add to Cart
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemove(product.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WishlistPage;
