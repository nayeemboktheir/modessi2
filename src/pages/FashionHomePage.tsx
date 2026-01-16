import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag, Heart, User, LayoutDashboard, ChevronRight, ChevronLeft,
  Sparkles, Truck, Shield, RotateCcw, Star, ArrowRight, Headphones,
  Search, Menu, X, Eye, Zap
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { selectCartCount, toggleCart, addToCart, openCart } from '@/store/slices/cartSlice';
import { selectWishlistItems, toggleWishlist } from '@/store/slices/wishlistSlice';
import { toast } from 'sonner';
import { Product as ProductType } from '@/types';

interface Product {
  id: string;
  name: string;
  price: number;
  original_price: number | null;
  images: string[];
  slug: string;
  category_id: string | null;
  is_new?: boolean;
  is_featured?: boolean;
  rating?: number;
  review_count?: number;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  description: string | null;
  productImage?: string | null; // First product image from this category
}

interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string;
  link_url: string | null;
}

export default function FashionHomePage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const cartCount = useAppSelector(selectCartCount);
  const wishlistItems = useAppSelector(selectWishlistItems);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch banners
        const { data: bannersData } = await supabase
          .from('banners')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });
        
        if (bannersData && bannersData.length > 0) {
          setBanners(bannersData);
        }

        const { data: categoriesData } = await supabase
          .from('categories')
          .select('*')
          .order('sort_order', { ascending: true });
        
        if (categoriesData) {
          // Fetch a product image for each category that doesn't have an image
          const categoriesWithImages = await Promise.all(
            categoriesData.map(async (cat) => {
              if (cat.image_url) return cat;
              
              // Get the first product with an image from this category
              const { data: productData } = await supabase
                .from('products')
                .select('images')
                .eq('category_id', cat.id)
                .eq('is_active', true)
                .not('images', 'is', null)
                .limit(1)
                .single();
              
              return {
                ...cat,
                productImage: productData?.images?.[0] || null
              };
            })
          );
          setCategories(categoriesWithImages);
        }

        const { data: featuredData } = await supabase
          .from('products')
          .select('*')
          .eq('is_featured', true)
          .eq('is_active', true)
          .limit(8);
        
        if (featuredData) setFeaturedProducts(featuredData);

        const { data: newData } = await supabase
          .from('products')
          .select('*')
          .eq('is_new', true)
          .eq('is_active', true)
          .limit(8);
        
        if (newData) setNewArrivals(newData);

        const { data: { user: currentUser } } = await supabase.auth.getUser();
        setUser(currentUser);
        
        if (currentUser) {
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', currentUser.id)
            .eq('role', 'admin')
            .maybeSingle();
          setIsAdmin(!!roleData);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Auto-slide for hero carousel
  useEffect(() => {
    if (heroSlides.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [banners]);

  const formatPrice = (price: number) => {
    return `৳${price.toLocaleString('bn-BD')}`;
  };

  const features = [
    { icon: Truck, title: 'দ্রুত ডেলিভারি', desc: 'সারাদেশে ফ্রি ডেলিভারি' },
    { icon: RotateCcw, title: 'ইজি রিটার্ন', desc: '৭ দিনের রিটার্ন পলিসি' },
    { icon: Shield, title: 'নিরাপদ পেমেন্ট', desc: '১০০% সিকিউর চেকআউট' },
    { icon: Headphones, title: '২৪/৭ সাপোর্ট', desc: 'যেকোনো সময় যোগাযোগ' },
  ];

  // Hero slides from banners or defaults
  const defaultSlides = [
    {
      id: '1',
      title: 'নতুন টু পিস কালেকশন',
      subtitle: 'এক্সক্লুসিভ ডিজাইন, প্রিমিয়াম কোয়ালিটি - ৩০% পর্যন্ত ছাড়',
      image: 'https://images.unsplash.com/photo-1617922001439-4a2e6562f328?w=1920&q=80',
      link: '/category/two-pcs',
      badge: '৩০% ছাড়'
    },
    {
      id: '2',
      title: 'থ্রি পিস স্পেশাল',
      subtitle: 'প্রিমিয়াম ফেব্রিক, এলিগ্যান্ট ডিজাইন - নতুন আগমন',
      image: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=1920&q=80',
      link: '/category/three-pcs',
      badge: 'নতুন'
    },
    {
      id: '3',
      title: 'সামার কালেকশন ২০২৬',
      subtitle: 'কমফোর্টেবল এবং স্টাইলিশ - গরমের জন্য পারফেক্ট',
      image: 'https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=1920&q=80',
      link: '/products',
      badge: 'ট্রেন্ডিং'
    }
  ];

  const heroSlides = banners.length > 0 
    ? banners.map(b => ({
        id: b.id,
        title: b.title,
        subtitle: b.subtitle || '',
        image: b.image_url,
        link: b.link_url || '/products',
        badge: 'নতুন'
      }))
    : defaultSlides;

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
  }, [heroSlides.length]);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length);
  }, [heroSlides.length]);

  const handleAddToCart = (product: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    // Convert to ProductType for cart
    const productForCart: ProductType = {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: '',
      price: product.price,
      originalPrice: product.original_price || undefined,
      images: product.images || [],
      category: '',
      rating: product.rating || 0,
      reviewCount: product.review_count || 0,
      stock: 100,
    };
    dispatch(addToCart({ product: productForCart, quantity: 1 }));
    dispatch(openCart());
    toast.success('কার্টে যোগ করা হয়েছে');
  };

  const handleBuyNow = (product: Product, e: React.MouseEvent) => {
    e.stopPropagation();

    const productForCart: ProductType = {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: '',
      price: product.price,
      originalPrice: product.original_price || undefined,
      images: product.images || [],
      category: '',
      rating: product.rating || 0,
      reviewCount: product.review_count || 0,
      stock: 100,
    };

    dispatch(addToCart({ product: productForCart, quantity: 1 }));
    navigate('/checkout');
  };

  const handleToggleWishlist = (product: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    // Convert to ProductType for wishlist
    const productForWishlist: ProductType = {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: '',
      price: product.price,
      originalPrice: product.original_price || undefined,
      images: product.images || [],
      category: '',
      rating: product.rating || 0,
      reviewCount: product.review_count || 0,
      stock: 100,
    };
    dispatch(toggleWishlist(productForWishlist));
  };

  const isInWishlist = (productId: string) => {
    return wishlistItems.some((item: any) => item.id === productId);
  };

  const getDiscount = (price: number, originalPrice: number | null) => {
    if (!originalPrice || originalPrice <= price) return null;
    return Math.round(((originalPrice - price) / originalPrice) * 100);
  };

  // Placeholder products if no data
  const placeholderProducts = [
    { id: '1', name: 'ফ্লোরাল প্রিন্ট টু পিস', price: 2450, original_price: 3200, images: ['https://images.unsplash.com/photo-1596783074918-c84cb06531ca?w=400&q=80'], slug: 'floral-two-pcs' },
    { id: '2', name: 'এমব্রয়ডারি থ্রি পিস', price: 3850, original_price: 4500, images: ['https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&q=80'], slug: 'embroidery-three-pcs' },
    { id: '3', name: 'কটন টু পিস সেট', price: 1950, original_price: 2400, images: ['https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=400&q=80'], slug: 'cotton-two-pcs' },
    { id: '4', name: 'সিল্ক থ্রি পিস', price: 4250, original_price: 5000, images: ['https://images.unsplash.com/photo-1617922001439-4a2e6562f328?w=400&q=80'], slug: 'silk-three-pcs' },
    { id: '5', name: 'প্রিন্টেড টু পিস', price: 2150, original_price: 2800, images: ['https://images.unsplash.com/photo-1596783074918-c84cb06531ca?w=400&q=80'], slug: 'printed-two-pcs' },
    { id: '6', name: 'ডিজাইনার থ্রি পিস', price: 5200, original_price: 6500, images: ['https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&q=80'], slug: 'designer-three-pcs' },
    { id: '7', name: 'ক্যাজুয়াল টু পিস', price: 1850, original_price: 2200, images: ['https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=400&q=80'], slug: 'casual-two-pcs' },
    { id: '8', name: 'পার্টি থ্রি পিস', price: 4800, original_price: 5800, images: ['https://images.unsplash.com/photo-1617922001439-4a2e6562f328?w=400&q=80'], slug: 'party-three-pcs' },
  ];

  const displayProducts = featuredProducts.length > 0 ? featuredProducts : placeholderProducts;
  const displayNewArrivals = newArrivals.length > 0 ? newArrivals : placeholderProducts.slice(0, 4);

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <div className="bg-primary text-primary-foreground py-2 text-center text-sm">
        <div className="container-custom flex items-center justify-center gap-2">
          <Truck className="w-4 h-4" />
          <span>৳২০০০+ অর্ডারে সারাদেশে ফ্রি ডেলিভারি | ৭ দিনের ইজি রিটার্ন</span>
        </div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b border-border shadow-sm">
        <div className="container-custom py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Mobile Menu Toggle */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>

            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                এলিগ্যান্স
              </span>
            </Link>

            {/* Search Bar - Desktop */}
            <div className="hidden lg:flex flex-1 max-w-xl mx-8">
              <div className="relative w-full">
                <Input
                  type="text"
                  placeholder="পণ্য খুঁজুন..."
                  className="pr-12 rounded-full border-2 focus:border-primary"
                />
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute right-1 top-1/2 -translate-y-1/2 hover:bg-primary/10"
                >
                  <Search className="h-5 w-5 text-muted-foreground" />
                </Button>
              </div>
            </div>
            
            {/* Navigation - Desktop */}
            <nav className="hidden md:flex items-center gap-6">
              <Link to="/" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
                হোম
              </Link>
              <Link to="/category/two-pcs" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                টু পিস
              </Link>
              <Link to="/category/three-pcs" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                থ্রি পিস
              </Link>
              <Link to="/products" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                সব প্রোডাক্ট
              </Link>
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-1 md:gap-2">
              {/* Mobile Search */}
              <Button variant="ghost" size="icon" className="lg:hidden hover:bg-primary/10">
                <Search className="h-5 w-5" />
              </Button>

              {/* Wishlist */}
              <Link to="/wishlist">
                <Button variant="ghost" size="icon" className="relative hover:bg-primary/10">
                  <Heart className={`h-5 w-5 ${wishlistItems.length > 0 ? 'fill-destructive text-destructive' : ''}`} />
                  {wishlistItems.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center font-bold">
                      {wishlistItems.length}
                    </span>
                  )}
                </Button>
              </Link>

              {/* Cart */}
              <Button 
                variant="ghost" 
                size="icon" 
                className="relative hover:bg-primary/10"
                onClick={() => dispatch(toggleCart())}
              >
                <ShoppingBag className="h-5 w-5" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center font-bold">
                    {cartCount}
                  </span>
                )}
              </Button>

              {/* Account */}
              <Link to={user ? (isAdmin ? '/admin' : '/my-account') : '/auth'}>
                <Button variant="ghost" size="icon" className="hover:bg-primary/10">
                  {user && isAdmin ? <LayoutDashboard className="h-5 w-5" /> : <User className="h-5 w-5" />}
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-border bg-background"
            >
              <nav className="container-custom py-4">
                <div className="mb-4">
                  <Input
                    type="text"
                    placeholder="পণ্য খুঁজুন..."
                    className="rounded-full"
                  />
                </div>
                <ul className="space-y-2">
                  <li>
                    <Link 
                      to="/" 
                      className="block py-2 text-foreground hover:text-primary font-medium"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      হোম
                    </Link>
                  </li>
                  <li>
                    <Link 
                      to="/category/two-pcs" 
                      className="block py-2 text-foreground hover:text-primary font-medium"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      টু পিস
                    </Link>
                  </li>
                  <li>
                    <Link 
                      to="/category/three-pcs" 
                      className="block py-2 text-foreground hover:text-primary font-medium"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      থ্রি পিস
                    </Link>
                  </li>
                  <li>
                    <Link 
                      to="/products" 
                      className="block py-2 text-foreground hover:text-primary font-medium"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      সব প্রোডাক্ট
                    </Link>
                  </li>
                </ul>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Hero Slider */}
      <section className="relative h-[50vh] md:h-[70vh] overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/40 to-transparent z-10" />
            <img
              src={heroSlides[currentSlide].image}
              alt={heroSlides[currentSlide].title}
              className="w-full h-full object-cover"
            />
            
            <div className="absolute inset-0 z-20 flex items-center">
              <div className="container-custom">
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="max-w-xl text-white"
                >
                  <Badge className="mb-4 bg-primary text-primary-foreground">
                    {heroSlides[currentSlide].badge}
                  </Badge>
                  <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold mb-4 leading-tight">
                    {heroSlides[currentSlide].title}
                  </h1>
                  <p className="text-lg md:text-xl text-white/90 mb-6">
                    {heroSlides[currentSlide].subtitle}
                  </p>
                  <div className="flex gap-4">
                    <Button 
                      size="lg"
                      onClick={() => navigate(heroSlides[currentSlide].link)}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-8"
                    >
                      এখনই কিনুন <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="lg"
                      onClick={() => navigate('/products')}
                      className="border-white text-white hover:bg-white hover:text-foreground rounded-full px-8"
                    >
                      সব দেখুন
                    </Button>
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Slider Controls */}
        {heroSlides.length > 1 && (
          <>
            <button
              onClick={prevSlide}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center hover:bg-white/40 transition-colors"
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
            <button
              onClick={nextSlide}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center hover:bg-white/40 transition-colors"
            >
              <ChevronRight className="w-6 h-6 text-white" />
            </button>

            {/* Dots */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex gap-2">
              {heroSlides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`w-3 h-3 rounded-full transition-all ${
                    index === currentSlide 
                      ? 'bg-white w-8' 
                      : 'bg-white/50 hover:bg-white/70'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </section>

      {/* Features Bar */}
      <section className="py-6 bg-secondary/50 border-y border-border">
        <div className="container-custom">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {features.map((feature, index) => (
              <div key={index} className="flex items-center gap-3 justify-center">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">{feature.title}</p>
                  <p className="text-xs text-muted-foreground hidden md:block">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-12 md:py-16 bg-background">
        <div className="container-custom">
          <div className="flex items-center justify-between mb-8">
            <div>
              <span className="text-primary font-medium text-sm tracking-wider uppercase">ক্যাটাগরি</span>
              <h2 className="text-2xl md:text-3xl font-bold mt-1">
                শপ বাই <span className="text-primary">ক্যাটাগরি</span>
              </h2>
            </div>
            <Button variant="ghost" onClick={() => navigate('/products')} className="hidden md:flex">
              সব দেখুন <ChevronRight className="ml-1 w-4 h-4" />
            </Button>
          </div>

          <div className={`grid grid-cols-2 gap-4 md:gap-6 ${categories.length <= 3 ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}>
            {/* Dynamic categories from database */}
            {categories.map((category, index) => {
              // Define fallback images for categories - using reliable Unsplash images
              const fallbackImages = [
                'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400&q=80',
                'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&q=80',
                'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=400&q=80',
                'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80',
              ];
              
              const gradientColors = [
                'from-rose-100 to-rose-50',
                'from-violet-100 to-violet-50',
                'from-amber-100 to-amber-50',
                'from-emerald-100 to-emerald-50',
              ];

              // Priority: category image_url > product image > fallback
              const categoryImage = category.image_url || category.productImage || fallbackImages[index % fallbackImages.length];
              
              return (
                <motion.div
                  key={category.id}
                  whileHover={{ y: -5 }}
                  className="group cursor-pointer"
                  onClick={() => navigate(`/products?category=${category.slug}`)}
                >
                  <div className={`relative overflow-hidden rounded-2xl aspect-square bg-gradient-to-br ${gradientColors[index % gradientColors.length]}`}>
                    <img
                      src={categoryImage}
                      alt={category.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = fallbackImages[index % fallbackImages.length];
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4">
                      <h3 className="text-lg font-bold text-white">{category.name}</h3>
                      <p className="text-white/80 text-sm">{category.description || 'প্রোডাক্ট দেখুন'}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {/* Show placeholders if no categories exist */}
            {categories.length === 0 && (
              <>
                <motion.div
                  whileHover={{ y: -5 }}
                  className="group cursor-pointer"
                  onClick={() => navigate('/category/two-pcs')}
                >
                  <div className="relative overflow-hidden rounded-2xl aspect-square bg-gradient-to-br from-pink-100 to-pink-50">
                    <img
                      src="https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&q=80"
                      alt="টু পিস"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4">
                      <h3 className="text-lg font-bold text-white">টু পিস</h3>
                      <p className="text-white/80 text-sm">১২০+ প্রোডাক্ট</p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  whileHover={{ y: -5 }}
                  className="group cursor-pointer"
                  onClick={() => navigate('/category/three-pcs')}
                >
                  <div className="relative overflow-hidden rounded-2xl aspect-square bg-gradient-to-br from-purple-100 to-purple-50">
                    <img
                      src="https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=400&q=80"
                      alt="থ্রি পিস"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4">
                      <h3 className="text-lg font-bold text-white">থ্রি পিস</h3>
                      <p className="text-white/80 text-sm">৮৫+ প্রোডাক্ট</p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  whileHover={{ y: -5 }}
                  className="group cursor-pointer"
                  onClick={() => navigate('/products?filter=new')}
                >
                  <div className="relative overflow-hidden rounded-2xl aspect-square bg-gradient-to-br from-amber-100 to-amber-50">
                    <img
                      src="https://images.unsplash.com/photo-1617922001439-4a2e6562f328?w=400&q=80"
                      alt="নতুন আগমন"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4">
                      <h3 className="text-lg font-bold text-white">নতুন আগমন</h3>
                      <p className="text-white/80 text-sm">এই সপ্তাহে</p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  whileHover={{ y: -5 }}
                  className="group cursor-pointer"
                  onClick={() => navigate('/products?filter=sale')}
                >
                  <div className="relative overflow-hidden rounded-2xl aspect-square bg-gradient-to-br from-red-100 to-red-50">
                    <img
                      src="https://images.unsplash.com/photo-1596783074918-c84cb06531ca?w=400&q=80"
                      alt="সেল"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4">
                      <h3 className="text-lg font-bold text-white">সেল 🔥</h3>
                      <p className="text-white/80 text-sm">৫০% পর্যন্ত ছাড়</p>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-12 md:py-16 bg-secondary/30">
        <div className="container-custom">
          <div className="flex items-center justify-between mb-8">
            <div>
              <span className="text-primary font-medium text-sm tracking-wider uppercase">বেস্ট সেলিং</span>
              <h2 className="text-2xl md:text-3xl font-bold mt-1">
                জনপ্রিয় <span className="text-primary">প্রোডাক্ট</span>
              </h2>
            </div>
            <Button variant="outline" onClick={() => navigate('/products')} className="rounded-full">
              সব দেখুন <ChevronRight className="ml-1 w-4 h-4" />
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {displayProducts.slice(0, 8).map((product: any, index) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="group"
              >
                <div 
                  className="bg-card rounded-2xl overflow-hidden border border-border hover:border-primary/50 hover:shadow-lg transition-all duration-300 cursor-pointer"
                  onClick={() => product.slug && navigate(`/product/${product.slug}`)}
                >
                  {/* Product Image */}
                  <div className="relative aspect-[3/4] overflow-hidden">
                    <img
                      src={product.images?.[0] || `https://images.unsplash.com/photo-1596783074918-c84cb06531ca?w=400&q=80`}
                      alt={product.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    
                    {/* Discount Badge */}
                    {getDiscount(product.price, product.original_price) && (
                      <Badge className="absolute top-3 left-3 bg-destructive text-destructive-foreground">
                        -{getDiscount(product.price, product.original_price)}%
                      </Badge>
                    )}

                    {/* New Badge */}
                    {product.is_new && !getDiscount(product.price, product.original_price) && (
                      <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground">
                        নতুন
                      </Badge>
                    )}

                    {/* Action Buttons */}
                    <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="secondary"
                        className="w-9 h-9 rounded-full bg-white/90 hover:bg-white shadow-md"
                        onClick={(e) => handleToggleWishlist(product, e)}
                      >
                        <Heart className={`h-4 w-4 ${isInWishlist(product.id) ? 'fill-destructive text-destructive' : ''}`} />
                      </Button>
                      <Button
                        size="icon"
                        variant="secondary"
                        className="w-9 h-9 rounded-full bg-white/90 hover:bg-white shadow-md"
                        onClick={(e) => { e.stopPropagation(); navigate(`/product/${product.slug}`); }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Quick Add / Buy Now Buttons */}
                    <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform">
                      <div className="flex flex-col gap-2">
                        <Button
                          className="w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                          onClick={(e) => handleAddToCart(product, e)}
                        >
                          <ShoppingBag className="w-4 h-4 mr-2" />
                          কার্টে যোগ করুন
                        </Button>
                        <Button
                          className="w-full rounded-full bg-accent text-accent-foreground hover:bg-accent/90"
                          onClick={(e) => handleBuyNow(product, e)}
                        >
                          <Zap className="w-4 h-4 mr-2" />
                          এখনই কিনুন
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Product Info */}
                  <div className="p-4">
                    <h3 className="font-medium text-foreground mb-2 line-clamp-2 min-h-[3rem]">
                      {product.name}
                    </h3>
                    
                    {/* Rating */}
                    <div className="flex items-center gap-1 mb-2">
                      {[...Array(5)].map((_, i) => (
                        <Star 
                          key={i} 
                          className={`w-3 h-3 ${i < (product.rating || 4) ? 'fill-amber-400 text-amber-400' : 'text-muted'}`} 
                        />
                      ))}
                      <span className="text-xs text-muted-foreground ml-1">
                        ({product.review_count || Math.floor(Math.random() * 50) + 10})
                      </span>
                    </div>

                    {/* Price */}
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-primary">{formatPrice(product.price)}</span>
                      {product.original_price && product.original_price > product.price && (
                        <span className="text-sm text-muted-foreground line-through">
                          {formatPrice(product.original_price)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Promo Banner */}
      <section className="py-12 md:py-16 bg-background">
        <div className="container-custom">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Banner 1 */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 p-8 md:p-10 cursor-pointer group"
              onClick={() => navigate('/category/two-pcs')}
            >
              <div className="relative z-10">
                <Badge className="mb-3 bg-white/20 text-white border-0">সীমিত অফার</Badge>
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">
                  টু পিস কালেকশন
                </h3>
                <p className="text-white/90 mb-4">৩০% পর্যন্ত ছাড়</p>
                <Button className="bg-white text-rose-600 hover:bg-white/90 rounded-full">
                  এখনই কিনুন <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
              <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
            </motion.div>

            {/* Banner 2 */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-500 to-purple-500 p-8 md:p-10 cursor-pointer group"
              onClick={() => navigate('/category/three-pcs')}
            >
              <div className="relative z-10">
                <Badge className="mb-3 bg-white/20 text-white border-0">নতুন আগমন</Badge>
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">
                  থ্রি পিস স্পেশাল
                </h3>
                <p className="text-white/90 mb-4">প্রিমিয়াম কোয়ালিটি</p>
                <Button className="bg-white text-purple-600 hover:bg-white/90 rounded-full">
                  এখনই কিনুন <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
              <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* New Arrivals */}
      <section className="py-12 md:py-16 bg-secondary/30">
        <div className="container-custom">
          <div className="flex items-center justify-between mb-8">
            <div>
              <span className="text-primary font-medium text-sm tracking-wider uppercase">নতুন সংযোজন</span>
              <h2 className="text-2xl md:text-3xl font-bold mt-1">
                নিউ <span className="text-primary">অ্যারাইভালস</span>
              </h2>
            </div>
            <Button variant="outline" onClick={() => navigate('/products')} className="rounded-full">
              সব দেখুন <ChevronRight className="ml-1 w-4 h-4" />
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {displayNewArrivals.map((product: any, index) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group cursor-pointer"
                onClick={() => product.slug && navigate(`/product/${product.slug}`)}
              >
                <div className="relative overflow-hidden rounded-2xl bg-card mb-3">
                  <div className="aspect-[3/4] overflow-hidden">
                    <img
                      src={product.images?.[0] || `https://images.unsplash.com/photo-1596783074918-c84cb06531ca?w=400&q=80`}
                      alt={product.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  
                  <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground">
                    নতুন
                  </Badge>

                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity rounded-full bg-white/90 hover:bg-white"
                    onClick={(e) => handleToggleWishlist(product, e)}
                  >
                    <Heart className={`h-4 w-4 ${isInWishlist(product.id) ? 'fill-destructive text-destructive' : ''}`} />
                  </Button>

                  <div className="absolute bottom-3 left-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex flex-col gap-2">
                      <Button
                        className="w-full rounded-full bg-primary/90 backdrop-blur-md text-primary-foreground hover:bg-primary"
                        onClick={(e) => handleAddToCart(product, e)}
                      >
                        কার্টে যোগ করুন
                      </Button>
                      <Button
                        className="w-full rounded-full bg-accent/90 backdrop-blur-md text-accent-foreground hover:bg-accent"
                        onClick={(e) => handleBuyNow(product, e)}
                      >
                        এখনই কিনুন
                      </Button>
                    </div>
                  </div>
                </div>

                <h3 className="font-medium text-foreground mb-1 line-clamp-1">{product.name}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-primary">{formatPrice(product.price)}</span>
                  {product.original_price && product.original_price > product.price && (
                    <span className="text-sm text-muted-foreground line-through">{formatPrice(product.original_price)}</span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter / CTA */}
      <section className="py-16 md:py-20 bg-background">
        <div className="container-custom">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary to-accent p-8 md:p-16 text-center"
          >
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 left-0 w-40 h-40 bg-white rounded-full blur-3xl" />
              <div className="absolute bottom-0 right-0 w-60 h-60 bg-white rounded-full blur-3xl" />
            </div>

            <div className="relative z-10">
              <h2 className="text-2xl md:text-4xl font-bold text-primary-foreground mb-4">
                ৩০% ছাড় পান প্রথম অর্ডারে!
              </h2>
              <p className="text-lg text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
                আজই সাবস্ক্রাইব করুন এবং এক্সক্লুসিভ অফার, নতুন কালেকশন আপডেট পান।
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
                <Input
                  type="text"
                  placeholder="আপনার ফোন নম্বর"
                  className="flex-1 px-6 py-6 rounded-full bg-white/20 backdrop-blur-md border-white/30 text-primary-foreground placeholder:text-primary-foreground/60 focus:border-white"
                />
                <Button 
                  size="lg"
                  className="bg-white text-primary hover:bg-white/90 rounded-full px-8"
                >
                  সাবস্ক্রাইব
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-foreground text-background py-12 md:py-16">
        <div className="container-custom">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="text-2xl font-bold">এলিগ্যান্স</span>
              </div>
              <p className="text-background/70 text-sm">
                প্রিমিয়াম কোয়ালিটি টু পিস ও থ্রি পিস কালেকশন। আপনার স্টাইল, আপনার পছন্দ।
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">কুইক লিংক</h4>
              <ul className="space-y-2 text-sm text-background/70">
                <li><Link to="/products" className="hover:text-primary transition-colors">সব প্রোডাক্ট</Link></li>
                <li><Link to="/category/two-pcs" className="hover:text-primary transition-colors">টু পিস</Link></li>
                <li><Link to="/category/three-pcs" className="hover:text-primary transition-colors">থ্রি পিস</Link></li>
                <li><Link to="/about" className="hover:text-primary transition-colors">আমাদের সম্পর্কে</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">সাহায্য</h4>
              <ul className="space-y-2 text-sm text-background/70">
                <li><Link to="/contact" className="hover:text-primary transition-colors">যোগাযোগ</Link></li>
                <li><Link to="#" className="hover:text-primary transition-colors">শিপিং পলিসি</Link></li>
                <li><Link to="#" className="hover:text-primary transition-colors">রিটার্ন পলিসি</Link></li>
                <li><Link to="#" className="hover:text-primary transition-colors">FAQ</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">যোগাযোগ</h4>
              <ul className="space-y-2 text-sm text-background/70">
                <li>📞 ০১৭XX-XXXXXX</li>
                <li>✉️ info@elegance.com</li>
                <li>📍 ঢাকা, বাংলাদেশ</li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-background/20 pt-8 text-center text-sm text-background/60">
            <p>© ২০২৬ এলিগ্যান্স। সর্বস্বত্ব সংরক্ষিত।</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
