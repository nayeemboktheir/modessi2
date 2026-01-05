import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  Heart, 
  ShoppingCart, 
  Minus, 
  Plus, 
  ChevronLeft,
  ChevronRight,
  Loader2,
  Phone,
  CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProductCard from '@/components/products/ProductCard';
import { fetchProductBySlug, fetchProducts } from '@/services/productService';
import { Product, ProductVariation } from '@/types';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { addToCart, openCart } from '@/store/slices/cartSlice';
import { toggleWishlist, selectWishlistItems } from '@/store/slices/wishlistSlice';
import { toast } from 'sonner';
import { useFacebookPixel } from '@/hooks/useFacebookPixel';
import { supabase } from '@/integrations/supabase/client';

const ProductDetailPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | undefined>(undefined);
  
  const dispatch = useAppDispatch();
  const wishlistItems = useAppSelector(selectWishlistItems);
  const { trackViewContent, trackAddToCart, isReady } = useFacebookPixel();

  // Fetch social media settings for Call Now and Messenger buttons
  const { data: socialSettings } = useQuery({
    queryKey: ["product-social-settings"],
    queryFn: async () => {
      const keys = ["messenger_enabled", "messenger_page_id", "call_enabled", "call_number"];
      const { data, error } = await supabase
        .from("admin_settings")
        .select("key, value")
        .in("key", keys);

      if (error) throw error;

      const result = {
        messenger_enabled: false,
        messenger_page_id: "",
        call_enabled: false,
        call_number: "",
      };

      data?.forEach((item) => {
        if (item.key === "messenger_enabled") result.messenger_enabled = item.value === "true";
        if (item.key === "messenger_page_id") result.messenger_page_id = item.value;
        if (item.key === "call_enabled") result.call_enabled = item.value === "true";
        if (item.key === "call_number") result.call_number = item.value;
      });

      return result;
    },
    staleTime: 1000 * 60 * 5,
  });

  const isInWishlist = product ? wishlistItems.some((item) => item.id === product.id) : false;
  const hasVariations = product?.variations && product.variations.length > 0;

  // Track ViewContent when product loads
  useEffect(() => {
    if (product && isReady) {
      console.log('Firing ViewContent for product:', product.name);
      trackViewContent({
        content_ids: [product.id],
        content_name: product.name,
        content_type: 'product',
        value: product.price,
        currency: 'BDT',
      });
    }
  }, [product, isReady, trackViewContent]);

  useEffect(() => {
    const loadProduct = async () => {
      if (!slug) return;
      setIsLoading(true);
      try {
        const [productData, allProducts] = await Promise.all([
          fetchProductBySlug(slug),
          fetchProducts(),
        ]);
        setProduct(productData);
        // Do NOT auto-select variation - customer should select manually
        setSelectedVariation(undefined);
        if (productData) {
          setRelatedProducts(
            allProducts
              .filter((p) => p.category === productData.category && p.id !== productData.id)
              .slice(0, 4)
          );
        }
      } catch (error) {
        console.error('Failed to load product:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadProduct();
    window.scrollTo(0, 0);
  }, [slug]);

  if (isLoading) {
    return (
      <div className="min-h-screen pt-40 pb-16 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen pt-40 pb-16 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Product Not Found</h1>
          <Button asChild>
            <Link to="/products">Back to Products</Link>
          </Button>
        </div>
      </div>
    );
  }

  const formatPrice = (price: number) => `৳${price.toLocaleString('en-BD')}`;
  
  // Get display price based on selected variation or base product
  const displayPrice = selectedVariation?.price ?? product.price;
  const displayOriginalPrice = selectedVariation?.original_price ?? product.originalPrice;
  const discountAmount = displayOriginalPrice ? displayOriginalPrice - displayPrice : 0;
  const currentStock = selectedVariation?.stock ?? product.stock;

  const handleAddToCart = () => {
    if (hasVariations && !selectedVariation) {
      toast.error('Please select a variation');
      return;
    }
    
    dispatch(addToCart({ product, quantity, variation: selectedVariation }));
    dispatch(openCart());
    
    // Track AddToCart event
    console.log('Firing AddToCart for product:', product.name);
    trackAddToCart({
      content_ids: [product.id],
      content_name: product.name,
      content_type: 'product',
      value: displayPrice * quantity,
      currency: 'BDT',
    });
    
    toast.success('Added to cart!');
  };

  const handleBuyNow = () => {
    if (hasVariations && !selectedVariation) {
      toast.error('Please select a variation');
      return;
    }
    
    dispatch(addToCart({ product, quantity, variation: selectedVariation }));
    
    // Track AddToCart event
    trackAddToCart({
      content_ids: [product.id],
      content_name: product.name,
      content_type: 'product',
      value: displayPrice * quantity,
      currency: 'BDT',
    });
    
    navigate('/checkout');
  };

  const handleToggleWishlist = () => {
    dispatch(toggleWishlist(product));
    toast.success(isInWishlist ? 'Removed from wishlist' : 'Added to wishlist!');
  };

  const handleCallNow = () => {
    if (socialSettings?.call_number) {
      window.location.href = `tel:${socialSettings.call_number}`;
    }
  };

  const handleMessenger = () => {
    if (socialSettings?.messenger_page_id) {
      const link = socialSettings.messenger_page_id.trim();
      const url = link.startsWith("http") ? link : `https://${link}`;
      window.open(url, "_blank");
    }
  };

  return (
    <div className="min-h-screen pt-32 pb-16 bg-background">
      <div className="container-custom">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm">
          <ol className="flex items-center gap-2 text-muted-foreground">
            <li><Link to="/" className="hover:text-primary transition-colors">Home</Link></li>
            <li className="text-muted-foreground/50">›</li>
            <li><Link to="/products" className="hover:text-primary transition-colors">Products</Link></li>
            <li className="text-muted-foreground/50">›</li>
            <li className="text-foreground truncate max-w-[200px]">{product.name}</li>
          </ol>
          <Link 
            to="/" 
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary mt-2 text-sm transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back To Home
          </Link>
        </nav>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Image Gallery */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="relative aspect-square rounded-lg overflow-hidden bg-muted mb-4 border border-border">
              <img
                src={product.images[selectedImage]}
                alt={product.name}
                className="w-full h-full object-cover"
              />

              {/* Navigation Arrows */}
              {product.images.length > 1 && (
                <>
                  <button
                    onClick={() => setSelectedImage((prev) => 
                      prev === 0 ? product.images.length - 1 : prev - 1
                    )}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/90 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors shadow-md"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setSelectedImage((prev) => 
                      prev === product.images.length - 1 ? 0 : prev + 1
                    )}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/90 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors shadow-md"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnails - Horizontal Scroll Gallery */}
            {product.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {product.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`flex-shrink-0 w-20 h-20 rounded-md overflow-hidden border-2 transition-all ${
                      selectedImage === index 
                        ? 'border-primary ring-2 ring-primary/20' 
                        : 'border-border hover:border-muted-foreground'
                    }`}
                  >
                    <img
                      src={image}
                      alt={`${product.name} ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          {/* Product Info */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="space-y-5"
          >
            {/* Title with Share Icons */}
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground leading-tight">
                {product.name}
              </h1>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={handleToggleWishlist}
                className={`flex-shrink-0 ${isInWishlist ? 'text-secondary' : 'text-muted-foreground hover:text-secondary'}`}
              >
                <Heart className={`h-5 w-5 ${isInWishlist ? 'fill-current' : ''}`} />
              </Button>
            </div>

            {/* SKU */}
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">SKU:</span> {product.id.slice(0, 8).toUpperCase()}
            </p>

            {/* Variation Selector */}
            {hasVariations && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  সাইজ নির্বাচন করুন: <span className="font-semibold text-foreground">{selectedVariation?.name || ''}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {product.variations!.map((variation) => (
                    <button
                      key={variation.id}
                      onClick={() => setSelectedVariation(variation)}
                      className={`min-w-[60px] px-4 py-2.5 rounded-full text-sm font-medium border transition-all ${
                        selectedVariation?.id === variation.id
                          ? 'border-foreground bg-foreground text-background'
                          : 'border-border bg-background text-foreground hover:border-foreground'
                      }`}
                    >
                      {variation.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Price Section */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium text-muted-foreground">PRICE:</span>
              <span className="text-2xl font-bold text-foreground">
                {formatPrice(displayPrice)}
              </span>
              {displayOriginalPrice && (
                <>
                  <span className="text-lg text-muted-foreground line-through">
                    {formatPrice(displayOriginalPrice)}
                  </span>
                  <Badge className="bg-[#6B8E23] hover:bg-[#556B2F] text-white border-0 px-2 py-0.5 text-xs">
                    {discountAmount} ৳ off
                  </Badge>
                </>
              )}
            </div>

            {/* Stock Status */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">STATUS:</span>
              <span className={`font-bold ${currentStock > 0 ? 'text-[#6B8E23]' : 'text-destructive'}`}>
                {currentStock > 0 ? 'In Stock' : 'Out of Stock'}
              </span>
            </div>

            {/* Happy Customers Badge */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-5 w-5 text-[#6B8E23]" />
              <span className="font-medium">14,360+ Happy Customers</span>
            </div>

            {/* Short Description */}
            {product.short_description && (
              <p className="text-muted-foreground whitespace-pre-line leading-relaxed">
                {product.short_description}
              </p>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button 
                variant="outline"
                size="lg" 
                className="w-full h-12 font-semibold border-2 border-foreground hover:bg-muted"
                onClick={handleAddToCart}
                disabled={currentStock === 0}
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Add to Cart
              </Button>
              <Button 
                size="lg" 
                className="w-full h-12 bg-foreground text-background hover:bg-foreground/90 font-semibold"
                onClick={handleBuyNow}
                disabled={currentStock === 0}
              >
                Buy Now
              </Button>
            </div>

            {/* Call Now Button */}
            {socialSettings?.call_enabled && socialSettings?.call_number && (
              <Button 
                size="lg" 
                className="w-full h-12 bg-[#6B8E23] hover:bg-[#556B2F] text-white font-semibold"
                onClick={handleCallNow}
              >
                <Phone className="h-4 w-4 mr-2" />
                Call Now: {socialSettings.call_number}
              </Button>
            )}

            {/* Messenger Button */}
            {socialSettings?.messenger_enabled && socialSettings?.messenger_page_id && (
              <Button 
                variant="outline"
                size="lg" 
                className="w-full h-12 bg-background border-2 border-foreground hover:bg-muted font-semibold"
                onClick={handleMessenger}
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 mr-2 fill-[#0084FF]">
                  <path d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.19 5.44 3.14 7.17.16.13.26.35.27.57l.05 1.78c.02.59.61.98 1.17.78l1.99-.8c.17-.07.36-.08.53-.04.9.24 1.87.37 2.85.37 5.64 0 10-4.13 10-9.7C22 6.13 17.64 2 12 2zm5.89 7.65l-2.83 4.47c-.44.7-1.36.89-2.03.42l-2.25-1.68c-.2-.15-.47-.15-.66 0l-3.04 2.3c-.4.31-.94-.15-.67-.58l2.83-4.47c.44-.7 1.36-.89 2.03-.42l2.25 1.68c.2.15.47.15.66 0l3.04-2.3c.4-.31.94.15.67.58z"/>
                </svg>
                ম্যাসেঞ্জার অর্ডার
              </Button>
            )}

          </motion.div>
        </div>

        {/* Product Description Tabs - Only show if long_description exists */}
        {product.long_description && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-12"
          >
            <Tabs defaultValue="description" className="w-full">
              <TabsList className="w-full justify-start border-b border-border rounded-none bg-transparent h-auto p-0 mb-6">
                <TabsTrigger 
                  value="description" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3 text-base font-medium text-muted-foreground data-[state=active]:text-primary"
                >
                  পন্যের বিবরণ
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="description" className="mt-0">
                <div className="border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-950/20 rounded-r-lg p-6">
                  <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-line">
                    {product.long_description}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </motion.div>
        )}

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <section className="mt-16 pt-16 border-t border-border">
            <h2 className="text-2xl font-display font-bold text-foreground mb-8">
              Related Products
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {relatedProducts.map((relatedProduct, index) => (
                <ProductCard key={relatedProduct.id} product={relatedProduct} index={index} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default ProductDetailPage;
