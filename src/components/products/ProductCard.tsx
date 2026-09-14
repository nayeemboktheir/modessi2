import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { m } from 'framer-motion';
import { Heart, ShoppingCart, Star, Eye, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Product, ProductVariation } from '@/types';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { addToCart, openCart } from '@/store/slices/cartSlice';
import { toggleWishlist, selectWishlistItems } from '@/store/slices/wishlistSlice';
import { toast } from 'sonner';
import { useFacebookPixel } from '@/hooks/useFacebookPixel';
import { useServerTracking } from '@/hooks/useServerTracking';

interface ProductCardProps {
  product: Product;
  index?: number;
}

const ProductCard = ({ product, index = 0 }: ProductCardProps) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const wishlistItems = useAppSelector(selectWishlistItems);
  const { trackAddToCartWithEventId, generateEventId } = useFacebookPixel();
  const { trackAddToCart: trackServerAddToCart } = useServerTracking();
  const isInWishlist = wishlistItems.some((item) => item.id === product.id);
  
  // State for selected variation - no auto-select, customer must choose manually
  const hasVariations = product.variations && product.variations.length > 0;
  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | undefined>(undefined);

  // Sold out when the selected variation (or, with no variations, the product) has no
  // stock. Nothing downstream checks this — place-order deducts but does not refuse —
  // so the UI must not offer an item it cannot fulfil.
  const activeStock = selectedVariation?.stock ?? product.stock;
  const isSoldOut = typeof activeStock === 'number' && activeStock <= 0;


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
    if (isSoldOut) {
      toast.error('এই পণ্যটি স্টকে নেই');
      return;
    }


    dispatch(addToCart({ product, variation: selectedVariation }));
    dispatch(openCart());
    
    // Track AddToCart event - both browser pixel and server CAPI
    const eventId = generateEventId('AddToCart');
    console.log('Firing AddToCart from ProductCard:', product.name, 'eventId:', eventId);
    
    // Browser pixel
    trackAddToCartWithEventId({
      content_ids: [product.id],
      content_name: product.name,
      content_type: 'product',
      value: displayPrice,
      currency: 'BDT',
    }, eventId);
    
    // Server-side CAPI (runs in parallel)
    trackServerAddToCart({
      contentId: product.id,
      contentName: product.name,
      value: displayPrice,
      quantity: 1,
      currency: 'BDT',
    });
    
    toast.success('Added to cart!');
  };

  const handleBuyNow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // If product has variations but none selected, show error
    if (hasVariations && !selectedVariation) {
      toast.error('সাইজ সিলেক্ট করুন');
      return;
    }
    if (isSoldOut) {
      toast.error('এই পণ্যটি স্টকে নেই');
      return;
    }


    // Add to cart and navigate to checkout
    dispatch(addToCart({ product, variation: selectedVariation }));
    
    // Track AddToCart event - both browser pixel and server CAPI
    const eventId = generateEventId('AddToCart');
    console.log('Firing AddToCart (Buy Now) from ProductCard:', product.name, 'eventId:', eventId);
    
    // Browser pixel
    trackAddToCartWithEventId({
      content_ids: [product.id],
      content_name: product.name,
      content_type: 'product',
      value: displayPrice,
      currency: 'BDT',
    }, eventId);
    
    // Server-side CAPI (runs in parallel)
    trackServerAddToCart({
      contentId: product.id,
      contentName: product.name,
      value: displayPrice,
      quantity: 1,
      currency: 'BDT',
    });
    
    navigate('/checkout');
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
    <m.div
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

            {/* Add to Cart / Buy Now Buttons - Only show on hover if no variations */}
            {!hasVariations && (
              <div className="absolute bottom-0 left-0 right-0 p-2 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                <div className="flex flex-col gap-1.5">
                  <Button 
                    variant="cta" 
                    size="sm" 
                    className="w-full text-xs py-2"
                    onClick={handleAddToCart}
                    disabled={isSoldOut}
                  >
                    <ShoppingCart className="h-3.5 w-3.5 mr-1" />
                    {isSoldOut ? 'স্টক নেই' : 'কার্টে যোগ করুন'}
                  </Button>
                  <Button 
                    size="sm" 
                    className="w-full text-xs py-2 bg-accent text-accent-foreground hover:bg-accent/90"
                    onClick={handleBuyNow}
                    disabled={isSoldOut}
                  >
                    <Zap className="h-3.5 w-3.5 mr-1" />
                    এখনই কিনুন
                  </Button>
                </div>
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

            {/* Variations Selector - Compact Size Display */}
            {hasVariations && (
              <div className="mb-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-medium text-muted-foreground shrink-0">Size:</span>
                  {product.variations!.map((variation) => {
                    // Extract just the number from the size name (e.g., "Size 36" -> "36")
                    const sizeNumber = variation.name.replace(/[^0-9]/g, '') || variation.name;
                    return (
                      <button
                        key={variation.id}
                        onClick={(e) => handleVariationClick(e, variation)}
                        className={`min-w-[28px] h-7 px-1.5 text-xs font-semibold rounded border transition-all ${
                          selectedVariation?.id === variation.id
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-background text-foreground hover:border-primary'
                        }`}
                        title={variation.name}
                      >
                        {sizeNumber}
                      </button>
                    );
                  })}
                </div>
                {/* Free Delivery Badge */}
                {selectedVariation && (selectedVariation.name.toLowerCase().includes('5kg') || 
                  selectedVariation.name.includes('৫কেজি') || 
                  selectedVariation.name === '5 KG') && (
                  <p className="text-xs font-medium text-emerald-600 mt-1">🚚 ফ্রি ডেলিভারি</p>
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

            {/* Add to Cart / Buy Now Buttons for products with variations */}
            {hasVariations && (
              <div className="flex gap-2 mt-3 relative z-10">
                <button 
                  type="button"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-2 py-2.5 text-xs font-medium transition-colors pointer-events-auto"
                  onClick={handleAddToCart}
                  disabled={isSoldOut}
                  title={isSoldOut ? 'স্টকে নেই' : 'কার্টে যোগ করুন'}
                >
                  <ShoppingCart className="h-4 w-4 shrink-0" />
                  <span>কার্ট</span>
                </button>
                <button 
                  type="button"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 bg-amber-500 text-white hover:bg-amber-600 rounded-md px-2 py-2.5 text-xs font-medium transition-colors pointer-events-auto"
                  onClick={handleBuyNow}
                  disabled={isSoldOut}
                  title={isSoldOut ? 'স্টকে নেই' : 'এখনই কিনুন'}
                >
                  <Zap className="h-4 w-4 shrink-0" />
                  <span>কিনুন</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </Link>
    </m.div>
  );
};

export default ProductCard;