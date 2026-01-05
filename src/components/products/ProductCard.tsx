import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, ShoppingCart, Star, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Product, ProductVariation } from '@/types';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { addToCart, openCart } from '@/store/slices/cartSlice';
import { toggleWishlist, selectWishlistItems } from '@/store/slices/wishlistSlice';
import { toast } from 'sonner';
import { useFacebookPixel } from '@/hooks/useFacebookPixel';

interface ProductCardProps {
  product: Product;
  index?: number;
}

const ProductCard = ({ product, index = 0 }: ProductCardProps) => {
  const dispatch = useAppDispatch();
  const wishlistItems = useAppSelector(selectWishlistItems);
  const { trackAddToCart } = useFacebookPixel();
  const isInWishlist = wishlistItems.some((item) => item.id === product.id);
  
  // State for selected variation - no auto-select, customer must choose manually
  const hasVariations = product.variations && product.variations.length > 0;
  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | undefined>(undefined);

  // Get display price based on variation or base price
  const displayPrice = selectedVariation?.price ?? product.price;
  const displayOriginalPrice = selectedVariation?.original_price ?? product.originalPrice;

  const formatPrice = (price: number) => {
    return `৳${price.toLocaleString('en-BD')}`;
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // If product has variations but none selected, show error
    if (hasVariations && !selectedVariation) {
      toast.error('সাইজ সিলেক্ট করুন');
      return;
    }
    
    dispatch(addToCart({ product, variation: selectedVariation }));
    // No popup - just add to cart silently
    
    // Track AddToCart event
    console.log('Firing AddToCart from ProductCard:', product.name);
    trackAddToCart({
      content_ids: [product.id],
      content_name: product.name,
      content_type: 'product',
      value: displayPrice,
      currency: 'BDT',
    });
    
    toast.success('Added to cart!');
  };

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dispatch(toggleWishlist(product));
    toast.success(isInWishlist ? 'Removed from wishlist' : 'Added to wishlist!');
  };

  const handleVariationClick = (e: React.MouseEvent, variation: ProductVariation) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedVariation(variation);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
    >
      <Link to={`/product/${product.slug}`}>
        <div className="group bg-card rounded-xl overflow-hidden border border-border hover:shadow-xl hover:border-primary/20 transition-all duration-300">
          {/* Image Container */}
          <div className="relative aspect-square overflow-hidden bg-muted">
            <img
              src={product.images?.[0] || '/placeholder.svg'}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
              onError={(e) => {
                e.currentTarget.src = '/placeholder.svg';
              }}
            />

            {/* Badges */}
            <div className="absolute top-3 left-3 flex flex-col gap-2">
              {product.isNew && (
                <Badge variant="new">New</Badge>
              )}
              {product.discount && (
                <Badge variant="sale">-{product.discount}%</Badge>
              )}
            </div>

            {/* Quick Actions */}
            <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
              <Button
                variant="secondary"
                size="icon"
                className={`h-9 w-9 rounded-full shadow-md ${isInWishlist ? 'text-secondary bg-secondary/10' : ''}`}
                onClick={handleToggleWishlist}
              >
                <Heart className={`h-4 w-4 ${isInWishlist ? 'fill-current' : ''}`} />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                className="h-9 w-9 rounded-full shadow-md"
                asChild
              >
                <Link to={`/product/${product.slug}`} onClick={(e) => e.stopPropagation()}>
                  <Eye className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            {/* Add to Cart Button - Only show if no variations or variation selected */}
            {!hasVariations && (
              <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                <Button 
                  variant="cta" 
                  size="sm" 
                  className="w-full"
                  onClick={handleAddToCart}
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Add to Cart
                </Button>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-4">
            {/* Category */}
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              {product.category}
            </p>

            {/* Name */}
            <h3 className="font-medium text-foreground line-clamp-2 mb-2 group-hover:text-primary transition-colors">
              {product.name}
            </h3>

            {/* Rating */}
            <div className="flex items-center gap-1 mb-2">
              <div className="flex items-center">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`h-3.5 w-3.5 ${
                      i < Math.floor(product.rating)
                        ? 'text-accent fill-accent'
                        : 'text-muted-foreground/30'
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">
                ({product.reviewCount})
              </span>
            </div>

            {/* Variations Selector */}
            {hasVariations && (
              <div className="space-y-2 mb-3">
                <p className="text-xs font-medium text-muted-foreground">সাইজ নির্বাচন করুন:</p>
                <div className="flex flex-wrap gap-1.5">
                  {product.variations!.map((variation) => {
                    const isFreeDelivery = variation.name.toLowerCase().includes('5kg') || 
                                           variation.name.includes('৫কেজি') ||
                                           variation.name === '5 KG';
                    return (
                      <button
                        key={variation.id}
                        onClick={(e) => handleVariationClick(e, variation)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md border-2 transition-all ${
                          selectedVariation?.id === variation.id
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-background text-foreground hover:border-primary'
                        }`}
                      >
                        {variation.name}
                      </button>
                    );
                  })}
                </div>
                {/* Free Delivery Badge */}
                {selectedVariation && (selectedVariation.name.toLowerCase().includes('5kg') || 
                  selectedVariation.name.includes('৫কেজি') || 
                  selectedVariation.name === '5 KG') && (
                  <p className="text-xs font-medium text-emerald-600">🚚 ফ্রি ডেলিভারি</p>
                )}
              </div>
            )}

            {/* Price */}
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-primary">
                {formatPrice(displayPrice)}
              </span>
              {displayOriginalPrice && (
                <span className="text-sm text-muted-foreground line-through">
                  {formatPrice(displayOriginalPrice)}
                </span>
              )}
            </div>

            {/* Add to Cart Button for products with variations */}
            {hasVariations && (
              <Button 
                variant="cta" 
                size="sm" 
                className="w-full mt-3"
                onClick={handleAddToCart}
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Add to Cart
              </Button>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

export default ProductCard;