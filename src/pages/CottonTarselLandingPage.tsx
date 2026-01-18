import { useState, useEffect, useCallback, memo, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Truck,
  Shield,
  Phone,
  CheckCircle2,
  ShoppingBag,
  MessageCircle,
  Users,
  Clock,
  Flame,
  Gift,
  MapPin,
  Star,
  Heart,
  Sparkles,
  Check,
  Play,
  FileText,
} from "lucide-react";
import { getEmbedUrl } from "@/lib/videoEmbed";

import {
  ShippingMethodSelector,
  ShippingZone,
  SHIPPING_RATES,
} from "@/components/checkout/ShippingMethodSelector";
import { toast } from "sonner";

// ====== Interfaces ======
interface ProductVariation {
  id: string;
  name: string;
  price: number;
  original_price?: number;
  stock: number;
}

interface ProductData {
  id: string;
  name: string;
  price: number;
  original_price?: number;
  images: string[];
  video_url?: string;
  description?: string;
  short_description?: string;
  long_description?: string;
  slug: string;
  variations: ProductVariation[];
}

interface OrderForm {
  name: string;
  phone: string;
  address: string;
  note: string;
  quantity: number;
  selectedProductId: string;
  selectedVariationId: string;
  shippingZone?: ShippingZone;
  subtotal?: number;
  shippingCost?: number;
  total?: number;
}

// Product slugs for this landing page

// Product slugs for this landing page
const PRODUCT_SLUGS = ['new-cotton-tarsel-light-pink', 'new-cotton-tarsel-blue'];

// ====== Optimized Image ======
const OptimizedImage = memo(({ src, alt, className, priority = false }: { 
  src: string; alt: string; className?: string; priority?: boolean;
}) => {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!loaded && <div className="absolute inset-0 bg-gray-200 animate-pulse" />}
      <img
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={`w-full h-full object-cover transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
});
OptimizedImage.displayName = 'OptimizedImage';

// ====== Urgency Counter ======
const UrgencyBanner = memo(() => {
  const [viewers] = useState(() => Math.floor(Math.random() * 20) + 12);
  const [stock] = useState(() => Math.floor(Math.random() * 8) + 5);
  
  return (
    <div className="bg-gradient-to-r from-rose-500 via-pink-500 to-rose-500 text-white py-3 px-4">
      <div className="container mx-auto flex items-center justify-center gap-6 text-sm font-medium flex-wrap">
        <span className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
          </span>
          <Users className="h-4 w-4" />
          <span className="font-bold">{viewers} জন</span> এখন দেখছেন
        </span>
        <span className="hidden sm:block text-white/50">|</span>
        <span className="flex items-center gap-2">
          <Flame className="h-4 w-4 animate-pulse" />
          মাত্র <span className="font-bold">{stock}টি</span> প্রতিটি কালারে বাকি!
        </span>
      </div>
    </div>
  );
});
UrgencyBanner.displayName = 'UrgencyBanner';

// ====== Hero Section - Title on Top, Image, Then Price & CTA Below ======
const HeroSection = memo(({ products, onBuyNow, selectedProductId, onProductSelect }: { 
  products: ProductData[]; 
  onBuyNow: () => void;
  selectedProductId: string;
  onProductSelect: (productId: string) => void;
}) => {
  const activeProduct = products.find(p => p.id === selectedProductId) || products[0];
  const [currentImage, setCurrentImage] = useState(0);

  // Auto-slide images for active product
  useEffect(() => {
    if (!activeProduct?.images?.length || activeProduct.images.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % activeProduct.images.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [activeProduct]);

  // Reset image when product changes
  useEffect(() => {
    setCurrentImage(0);
  }, [selectedProductId]);

  const discount = activeProduct?.original_price 
    ? Math.round(((activeProduct.original_price - activeProduct.price) / activeProduct.original_price) * 100) 
    : 0;

  return (
    <section className="relative py-4 sm:py-6 md:py-10 overflow-hidden bg-gradient-to-br from-rose-50 via-pink-50 to-amber-50">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 w-40 h-40 bg-rose-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-60 h-60 bg-pink-200/30 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10 max-w-xl lg:max-w-6xl">
        {/* Desktop: Two Column Layout, Mobile: Single Column */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 items-center">
          
          {/* Left/Main Column - All content on mobile, Image on desktop */}
          <div className="lg:order-1">
            {/* Header Badge & Title - Shows on mobile only here */}
            <div className="text-center lg:hidden mb-4">
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-3"
              >
                <span className="inline-flex items-center gap-2 bg-gradient-to-r from-rose-500 to-pink-500 text-white px-5 py-2 rounded-full text-sm font-bold shadow-lg">
                  <Flame className="h-4 w-4" />
                  হট সেলিং প্রোডাক্ট
                </span>
              </motion.div>

              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
                প্রিমিয়াম কটন টারসেল
              </h1>
              <p className="text-gray-600 text-sm sm:text-base">
                টারসেল ডিজাইন, প্রিমিয়াম ফেব্রিক্স
              </p>
            </div>

            {/* Color Selector - On top of image */}
            <div id="product-selector" className="flex justify-center gap-3 mb-4">
              {products.map((product) => (
                <motion.button
                  key={product.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onProductSelect(product.id)}
                  className={`relative px-4 py-2 rounded-full font-semibold transition-all text-sm ${
                    selectedProductId === product.id
                      ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg scale-105'
                      : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-rose-300'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <div 
                      className={`w-3 h-3 rounded-full border-2 ${
                        product.slug.includes('pink') 
                          ? 'bg-pink-300 border-pink-400' 
                          : 'bg-blue-300 border-blue-400'
                      }`} 
                    />
                    {product.slug.includes('pink') ? 'লাইট পিংক' : 'ব্লু'}
                  </span>
                </motion.button>
              ))}
            </div>

            {/* Image Section */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeProduct?.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="relative"
              >
                {discount > 0 && (
                  <Badge className="absolute top-4 left-4 z-20 bg-red-500 text-white text-sm px-3 py-1.5 font-bold shadow-lg">
                    -{discount}% ছাড়
                  </Badge>
                )}
                
                <div className="relative aspect-square rounded-3xl overflow-hidden shadow-2xl bg-white ring-4 ring-rose-100 max-w-md mx-auto">
                  {activeProduct?.images?.[currentImage] && (
                    <OptimizedImage 
                      src={activeProduct.images[currentImage]} 
                      alt={activeProduct.name} 
                      className="w-full h-full" 
                      priority 
                    />
                  )}
                  
                  {activeProduct?.images && activeProduct.images.length > 1 && (
                    <>
                      <button
                        onClick={() => setCurrentImage((currentImage - 1 + activeProduct.images.length) % activeProduct.images.length)}
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur-sm rounded-full p-2.5 shadow-xl hover:scale-110 transition-all"
                      >
                        <ChevronLeft className="h-5 w-5 text-gray-700" />
                      </button>
                      <button
                        onClick={() => setCurrentImage((currentImage + 1) % activeProduct.images.length)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur-sm rounded-full p-2.5 shadow-xl hover:scale-110 transition-all"
                      >
                        <ChevronRight className="h-5 w-5 text-gray-700" />
                      </button>
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/20 backdrop-blur-sm px-3 py-2 rounded-full">
                        {activeProduct.images.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => setCurrentImage(idx)}
                            className={`h-2 rounded-full transition-all ${idx === currentImage ? "bg-white w-6" : "bg-white/50 w-2"}`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Thumbnails */}
                {activeProduct?.images && activeProduct.images.length > 1 && (
                  <div className="flex gap-2 mt-4 justify-center">
                    {activeProduct.images.slice(0, 6).map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentImage(idx)}
                        className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden border-2 transition-all ${
                          idx === currentImage 
                            ? "border-rose-500 scale-110 shadow-lg" 
                            : "border-gray-200 opacity-60 hover:opacity-100"
                        }`}
                      >
                        <OptimizedImage src={img} alt="" className="w-full h-full" />
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Price - Below Image on Mobile */}
            <div className="text-center mt-6 lg:hidden">
              {/* Price Section - Bigger & More Prominent */}
              <div className="flex items-center justify-center gap-3 flex-wrap">
                {activeProduct?.original_price && activeProduct.original_price > activeProduct.price && (
                  <span className="text-gray-400 line-through text-xl sm:text-2xl">
                    ৳{activeProduct.original_price.toLocaleString()}
                  </span>
                )}
                <span className="text-rose-600 font-bold text-4xl sm:text-5xl">
                  ৳{activeProduct?.price?.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column - Product Info (Desktop only) */}
          <div className="hidden lg:block lg:order-2 text-center lg:text-left">
            {/* Header Badge */}
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4"
            >
              <span className="inline-flex items-center gap-2 bg-gradient-to-r from-rose-500 to-pink-500 text-white px-5 py-2 rounded-full text-sm font-bold shadow-lg">
                <Flame className="h-4 w-4" />
                হট সেলিং প্রোডাক্ট
              </span>
            </motion.div>

            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
              প্রিমিয়াম কটন টারসেল
            </h1>
            <p className="text-gray-600 text-lg mb-6">
              টারসেল ডিজাইন, প্রিমিয়াম ফেব্রিক্স
            </p>

            {/* Price Section - Prominent */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 inline-block">
              <div className="flex items-center gap-3 flex-wrap">
                {activeProduct?.original_price && activeProduct.original_price > activeProduct.price && (
                  <span className="text-gray-400 line-through text-2xl">
                    ৳{activeProduct.original_price.toLocaleString()}
                  </span>
                )}
                <span className="text-rose-600 font-bold text-4xl lg:text-5xl">
                  ৳{activeProduct?.price?.toLocaleString()}
                </span>
              </div>
            </div>

            {/* CTA Button */}
            <div>
              <Button
                onClick={onBuyNow}
                size="lg"
                className="px-10 py-6 text-lg font-bold bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white rounded-2xl shadow-xl hover:shadow-2xl transition-all hover:scale-[1.02]"
              >
                <ShoppingBag className="mr-2 h-5 w-5" />
                এখনই অর্ডার করুন
              </Button>
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-4 mt-6">
              {[
                { icon: Shield, title: "১০০% গ্যারান্টি" },
                { icon: Truck, title: "সারাদেশে ডেলিভারি" },
                { icon: Gift, title: "ক্যাশ অন ডেলিভারি" },
              ].map((item, idx) => (
                <div key={idx} className="flex flex-col items-center gap-1 p-3 bg-white/60 backdrop-blur-sm rounded-xl border border-rose-100">
                  <div className="w-10 h-10 bg-rose-100 rounded-full flex items-center justify-center">
                    <item.icon className="h-5 w-5 text-rose-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-700 text-center">{item.title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});
HeroSection.displayName = 'HeroSection';

// ====== Features Banner ======
const FeaturesBanner = memo(() => (
  <section className="bg-gradient-to-r from-rose-500 via-pink-500 to-rose-500 py-5">
    <div className="container mx-auto px-4">
      <div className="flex flex-wrap justify-center gap-4 md:gap-8">
        {[
          { text: "প্রিমিয়াম কটন", icon: "✨" },
          { text: "এমব্রয়ডারি ওয়ার্ক", icon: "🎨" },
          { text: "কমফোর্টেবল ফিট", icon: "👕" },
          { text: "ইজি এক্সচেঞ্জ", icon: "🔄" }
        ].map((item, idx) => (
          <div key={idx} className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-white font-semibold text-sm">
            <span>{item.icon}</span>
            <CheckCircle2 className="h-4 w-4" />
            <span>{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  </section>
));
FeaturesBanner.displayName = 'FeaturesBanner';

// ====== All Products Gallery ======
const ProductsGallery = memo(({ products }: { products: ProductData[] }) => {
  return (
    <section className="py-12 md:py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <span className="inline-block bg-rose-100 text-rose-600 px-4 py-1.5 rounded-full text-sm font-medium mb-3">
            📸 গ্যালারি
          </span>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">দুটি সুন্দর কালার অপশন</h2>
          <p className="text-gray-600 mt-2">আপনার পছন্দের কালার বেছে নিন</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {products.map((product) => {
            const discount = product.original_price 
              ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
              : 0;
            
            return (
              <motion.div
                key={product.id}
                whileHover={{ y: -5 }}
                className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-3xl p-4 sm:p-6 shadow-lg border border-rose-100"
              >
                <div className="relative aspect-square rounded-2xl overflow-hidden mb-4 shadow-md">
                  {discount > 0 && (
                    <Badge className="absolute top-3 left-3 z-10 bg-red-500 text-white text-sm px-3 py-1.5 font-bold shadow-lg">
                      -{discount}% ছাড়
                    </Badge>
                  )}
                  <OptimizedImage 
                    src={product.images?.[0] || ''} 
                    alt={product.name} 
                    className="w-full h-full"
                  />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 text-center">{product.name}</h3>
                <div className="text-center mt-2">
                  {product.original_price && product.original_price > product.price && (
                    <span className="text-gray-400 line-through text-base mr-2">
                      ৳{product.original_price.toLocaleString()}
                    </span>
                  )}
                  <span className="text-rose-600 font-bold text-xl sm:text-2xl">
                    ৳{product.price.toLocaleString()}
                  </span>
                </div>
                
                {/* Mini gallery */}
                <div className="flex gap-2 mt-4 justify-center">
                  {product.images?.slice(1, 4).map((img, idx) => (
                    <div key={idx} className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden shadow-sm">
                      <OptimizedImage src={img} alt="" className="w-full h-full" />
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
});
ProductsGallery.displayName = 'ProductsGallery';

// ====== Delivery Info ======
const DeliverySection = memo(() => (
  <section className="py-10 md:py-14 bg-gray-50">
    <div className="container mx-auto px-4">
      <h2 className="text-xl md:text-2xl font-bold text-center text-gray-900 mb-8">ডেলিভারি ও পেমেন্ট</h2>
      <div className="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto">
        {[
          { icon: Truck, title: "ঢাকায় ৮০৳", sub: "বাইরে ১৩০৳", color: "bg-blue-500" },
          { icon: Clock, title: "১-৩ দিনে", sub: "ডেলিভারি", color: "bg-green-500" },
          { icon: Shield, title: "ক্যাশ অন", sub: "ডেলিভারি", color: "bg-purple-500" },
        ].map((item, idx) => (
          <div key={idx} className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm">
            <div className={`w-12 h-12 ${item.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
              <item.icon className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-900">{item.title}</p>
              <p className="text-sm text-gray-600">{item.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
));
DeliverySection.displayName = 'DeliverySection';

// ====== Product Description Section ======
const ProductDescriptionSection = memo(({ products }: { products: ProductData[] }) => {
  // Combine descriptions from both products or use the first one with description
  const product = products.find(p => p.long_description || p.description);
  const description = product?.long_description || product?.description;
  
  if (!description || !description.trim()) return null;
  
  const lines = description.split('\n').filter(line => line.trim());
  
  return (
    <section className="py-10 md:py-14 bg-gradient-to-b from-white to-gray-50">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <span className="inline-flex items-center gap-2 bg-rose-100 text-rose-600 px-4 py-1.5 rounded-full text-sm font-medium mb-3">
              📋 বিস্তারিত
            </span>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">প্রোডাক্ট বিবরণ</h2>
          </div>
          
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-rose-500 to-pink-500 p-4">
              <h3 className="text-lg font-bold text-white">এই প্রোডাক্টের বৈশিষ্ট্য</h3>
            </div>
            
            <div className="p-6">
              <ul className="space-y-3">
                {lines.map((line, idx) => {
                  const cleanLine = line.replace(/^[-•*]\s*/, '').trim();
                  if (!cleanLine) return null;
                  
                  return (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-rose-100 rounded-full flex items-center justify-center mt-0.5">
                        <Check className="h-4 w-4 text-rose-600" />
                      </span>
                      <span className="text-gray-700 leading-relaxed">{cleanLine}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});
ProductDescriptionSection.displayName = 'ProductDescriptionSection';

// ====== Video Section (Compact) ======
const VideoSection = memo(({ videoUrl }: { videoUrl?: string }) => {
  if (!videoUrl) return null;

  const raw = (videoUrl || "").trim();
  
  // Check if it's raw HTML (iframe embed code)
  const isRawHtml = raw.startsWith("<");
  
  // For Facebook embeds, we modify the URL to prevent redirect and keep it inline
  const getInlineEmbedUrl = (url: string) => {
    const embedUrl = getEmbedUrl(url);
    // Add parameters to keep video inline and prevent expansion
    if (embedUrl.includes("facebook.com/plugins/video.php")) {
      const separator = embedUrl.includes("?") ? "&" : "?";
      return `${embedUrl}${separator}show_text=false&lazy=true&autoplay=false`;
    }
    return embedUrl;
  };

  return (
    <section className="py-8 md:py-10 bg-gray-100">
      <div className="container mx-auto px-4">
        <div className="text-center mb-4">
          <span className="inline-flex items-center gap-2 bg-rose-500 text-white px-4 py-1.5 rounded-full text-sm font-medium">
            <Play className="h-4 w-4" />
            ভিডিও দেখুন
          </span>
        </div>

        {/* Responsive video container - centered with max width */}
        <div className="max-w-[280px] sm:max-w-xs mx-auto">
          <div
            className="relative rounded-xl overflow-hidden shadow-lg bg-gray-900"
            style={{ aspectRatio: "9/16" }}
          >
            {isRawHtml ? (
              <div
                className="absolute inset-0 [&>iframe]:!absolute [&>iframe]:!inset-0 [&>iframe]:!w-full [&>iframe]:!h-full [&>iframe]:!border-0"
                dangerouslySetInnerHTML={{ __html: raw }}
              />
            ) : raw.match(/\.(mp4|webm|ogg)$/i) ? (
              <video
                src={raw}
                controls
                className="absolute inset-0 w-full h-full object-cover"
                preload="metadata"
                playsInline
              />
            ) : (
              <iframe
                src={getInlineEmbedUrl(raw)}
                title="Video"
                allowFullScreen={false}
                allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
                referrerPolicy="no-referrer-when-downgrade"
                className="absolute inset-0 w-full h-full border-0 pointer-events-auto"
                scrolling="no"
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
});
VideoSection.displayName = "VideoSection";

// ====== Checkout Section ======
const CheckoutSection = memo(({ products, onSubmit, isSubmitting, selectedProductId, onProductSelect }: { 
  products: ProductData[]; 
  onSubmit: (form: OrderForm) => void; 
  isSubmitting: boolean;
  selectedProductId: string;
  onProductSelect: (productId: string) => void;
}) => {
  const [form, setForm] = useState<OrderForm>({
    name: "", phone: "", address: "", note: "", quantity: 1, 
    selectedProductId: "",
    selectedVariationId: "",
  });
  const [shippingZone, setShippingZone] = useState<ShippingZone>('outside_dhaka');
  const sizeSelectionRef = useRef<HTMLDivElement>(null);

  // Sync form with selected product from hero - but don't auto-select, let user choose
  useEffect(() => {
    if (selectedProductId) {
      setForm(prev => ({ ...prev, selectedProductId }));
    }
    // Don't auto-select first product - let user select manually
  }, [selectedProductId]);

  const selectedProduct = useMemo(
    () => products.find(p => p.id === form.selectedProductId),
    [products, form.selectedProductId]
  );

  const variations = useMemo(() => {
    const seen = new Set<string>();
    const out: ProductVariation[] = [];
    for (const v of selectedProduct?.variations || []) {
      const key = String(v.name || '').trim().toLowerCase();
      if (!key) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(v);
    }
    return out;
  }, [selectedProduct?.variations]);

  const selectedVariation = useMemo(
    () => variations.find(v => v.id === form.selectedVariationId),
    [variations, form.selectedVariationId]
  );

  const unitPrice = selectedVariation?.price || selectedProduct?.price || 0;
  const subtotal = unitPrice * form.quantity;
  const shippingCost = SHIPPING_RATES[shippingZone];
  const total = subtotal + shippingCost;

  // Reset variation when product changes
  useEffect(() => {
    setForm(prev => ({ ...prev, selectedVariationId: "" }));
  }, [form.selectedProductId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.selectedProductId) {
      toast.error("প্রোডাক্ট সিলেক্ট করুন");
      // Scroll to product selection in checkout, not hero
      document.getElementById("checkout-product-selector")?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    
    if (variations.length > 0 && !form.selectedVariationId) {
      toast.error("সাইজ সিলেক্ট করুন");
      sizeSelectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    
    if (!form.name.trim() || !form.phone.trim() || !form.address.trim()) {
      toast.error("সব তথ্য পূরণ করুন");
      return;
    }
    
    if (!/^01[3-9]\d{8}$/.test(form.phone.replace(/\s/g, ''))) {
      toast.error("সঠিক মোবাইল নম্বর দিন");
      return;
    }
    
    onSubmit({ ...form, shippingZone, subtotal, shippingCost, total });
  };

  const updateForm = useCallback((key: keyof OrderForm, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  return (
    <section id="checkout" className="py-10 md:py-14 bg-gradient-to-b from-rose-50 to-white">
      <div className="container mx-auto px-4">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-6">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">অর্ডার করুন</h2>
            <p className="text-gray-600 text-sm mt-1">পণ্য হাতে পেয়ে মূল্য পরিশোধ করুন</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Product Selection with visual indicator */}
            <div id="checkout-product-selector" className={`bg-white rounded-xl shadow-lg overflow-hidden border-2 ${!form.selectedProductId ? 'border-rose-300' : 'border-transparent'}`}>
              <div className="bg-gradient-to-r from-rose-500 to-pink-500 text-white py-3 px-4 font-bold flex items-center gap-2">
                <Heart className="h-4 w-4" />
                কালার সিলেক্ট করুন {!form.selectedProductId && <span className="text-yellow-200">*</span>}
              </div>
              
              <div className="p-4">
                {!form.selectedProductId && (
                  <p className="text-sm text-rose-500 mb-3 font-medium">👇 এখান থেকে কালার সিলেক্ট করুন</p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {products.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => {
                        updateForm('selectedProductId', product.id);
                        onProductSelect(product.id);
                      }}
                      className={`relative p-3 rounded-xl border-2 transition-all ${
                        form.selectedProductId === product.id
                          ? 'border-rose-500 bg-rose-50 shadow-md'
                          : 'border-gray-200 hover:border-rose-300'
                      }`}
                    >
                      <div className="aspect-square rounded-lg overflow-hidden mb-2">
                        <OptimizedImage 
                          src={product.images?.[0] || ''} 
                          alt={product.name} 
                          className="w-full h-full"
                        />
                      </div>
                      <p className="text-sm font-medium text-gray-800 line-clamp-1">
                        {product.slug.includes('pink') ? 'লাইট পিংক' : 'ব্লু'}
                      </p>
                      <p className="text-rose-600 font-bold">৳{product.price.toLocaleString()}</p>
                      
                      {form.selectedProductId === product.id && (
                        <div className="absolute top-2 right-2 w-6 h-6 bg-rose-500 rounded-full flex items-center justify-center">
                          <Check className="h-4 w-4 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Size Selection */}
            {variations.length > 0 && (
              <div ref={sizeSelectionRef} className="bg-white rounded-xl shadow-lg p-4 border">
                <p className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-rose-500" />
                  সাইজ নির্বাচন করুন <span className="text-red-500">*</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {variations.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => updateForm('selectedVariationId', v.id)}
                      className={`px-5 py-3 rounded-xl font-semibold transition-all border-2 ${
                        form.selectedVariationId === v.id
                          ? 'border-rose-500 bg-rose-500 text-white shadow-md'
                          : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-rose-300'
                      }`}
                    >
                      {v.name}
                    </button>
                  ))}
                </div>
                {!form.selectedVariationId && (
                  <p className="text-xs text-red-500 mt-2">* সাইজ সিলেক্ট করুন</p>
                )}
              </div>
            )}

            {/* Quantity */}
            <div className="bg-white rounded-xl shadow-lg p-4 border">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-700">পরিমাণ</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => updateForm('quantity', Math.max(1, form.quantity - 1))}
                    className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 font-bold text-lg"
                  >−</button>
                  <span className="text-xl font-bold w-8 text-center">{form.quantity}</span>
                  <button
                    type="button"
                    onClick={() => updateForm('quantity', form.quantity + 1)}
                    className="w-10 h-10 rounded-full bg-rose-500 text-white flex items-center justify-center hover:bg-rose-600 font-bold text-lg"
                  >+</button>
                </div>
              </div>
            </div>

            {/* Customer Info */}
            <div className="bg-white rounded-xl shadow-lg p-4 border space-y-3">
              <h3 className="font-bold flex items-center gap-2 text-gray-900">
                <Phone className="h-4 w-4 text-rose-500" />
                আপনার তথ্য
              </h3>
              <Input
                value={form.phone}
                onChange={(e) => updateForm('phone', e.target.value)}
                placeholder="মোবাইল নম্বর *"
                type="tel"
                inputMode="numeric"
                required
                className="h-12 text-base rounded-lg border-2 focus:border-rose-500"
              />
              <Input
                value={form.name}
                onChange={(e) => updateForm('name', e.target.value)}
                placeholder="আপনার নাম *"
                required
                className="h-12 text-base rounded-lg border-2 focus:border-rose-500"
              />
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Textarea
                  value={form.address}
                  onChange={(e) => updateForm('address', e.target.value)}
                  placeholder="সম্পূর্ণ ঠিকানা (বাড়ি, রোড, থানা, জেলা) *"
                  required
                  rows={2}
                  className="pl-10 text-base rounded-lg border-2 focus:border-rose-500 resize-none"
                />
              </div>
              
              {/* Note Field */}
              <div className="relative">
                <FileText className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Textarea
                  value={form.note}
                  onChange={(e) => updateForm('note', e.target.value)}
                  placeholder="আপনি অন্য কিছু নিতে চাইলে বা কিছু বলতে চাইলে এখানে লিখুন (ঐচ্ছিক)"
                  rows={2}
                  className="pl-10 text-base rounded-lg border-2 focus:border-rose-500 resize-none"
                />
              </div>
            </div>

            {/* Shipping */}
            <div className="bg-white rounded-xl shadow-lg p-4 border">
              <h3 className="font-bold flex items-center gap-2 text-gray-900 mb-3">
                <Truck className="h-4 w-4 text-rose-500" />
                ডেলিভারি এরিয়া
              </h3>
              <ShippingMethodSelector
                address={form.address}
                selectedZone={shippingZone}
                onZoneChange={setShippingZone}
              />
            </div>

            {/* Order Summary */}
            <div className="bg-gradient-to-r from-rose-600 to-pink-600 rounded-xl p-4 text-white">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-rose-100">সাবটোটাল ({form.quantity}টি)</span>
                  <span>৳{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-rose-100">ডেলিভারি</span>
                  <span>৳{shippingCost}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-rose-400">
                  <span>সর্বমোট</span>
                  <span>৳{total.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-14 text-lg font-bold bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-xl shadow-xl disabled:opacity-70"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  প্রসেসিং...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  অর্ডার কনফার্ম করুন — ৳{total.toLocaleString()}
                </span>
              )}
            </Button>

            {/* Contact */}
            <div className="text-center text-sm text-gray-600 space-y-1">
              <p>
                কল করুন: <a href="tel:+8801995909243" className="font-bold text-gray-900">01995909243</a>
              </p>
              <a 
                href="https://wa.me/8801995909243"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-green-600 font-medium"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </a>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
});
CheckoutSection.displayName = 'CheckoutSection';

// ====== Main Component ======
const CottonTarselLandingPage = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFloatingCta, setShowFloatingCta] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState("");
  const checkoutRef = useRef<HTMLDivElement>(null);

  // Hide floating CTA when checkout section is visible
  useEffect(() => {
    const checkVisibility = () => {
      if (checkoutRef.current) {
        const rect = checkoutRef.current.getBoundingClientRect();
        const isCheckoutVisible = rect.top < window.innerHeight * 0.7;
        setShowFloatingCta(!isCheckoutVisible);
      }
    };

    window.addEventListener('scroll', checkVisibility, { passive: true });
    const timer = setTimeout(checkVisibility, 100);

    return () => {
      window.removeEventListener('scroll', checkVisibility);
      clearTimeout(timer);
    };
  }, []);

  const { data: products, isLoading, error } = useQuery({
    queryKey: ["cotton-tarsel-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .in("slug", PRODUCT_SLUGS)
        .eq("is_active", true);

      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Products not found");

      // Fetch variations for each product
      const productsWithVariations = await Promise.all(
        data.map(async (product) => {
          const { data: variations } = await supabase
            .from("product_variations")
            .select("*")
            .eq("product_id", product.id)
            .eq("is_active", true)
            .order("sort_order");
          return { ...product, variations: variations || [] } as ProductData;
        })
      );

      return productsWithVariations;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch video URL from admin_settings
  const { data: videoUrl } = useQuery({
    queryKey: ["cotton-tarsel-video-url"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_settings")
        .select("value")
        .eq("key", "cotton_tarsel_video_url")
        .maybeSingle();

      if (error) throw error;
      return data?.value || "";
    },
    staleTime: 5 * 60 * 1000,
  });

  const scrollToCheckout = useCallback(() => {
    // If no product selected, scroll to product selector first
    if (!selectedProductId) {
      toast.error("প্রোডাক্ট সিলেক্ট করুন");
      document.getElementById("product-selector")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    document.getElementById("checkout")?.scrollIntoView({ behavior: "smooth" });
  }, [selectedProductId]);

  const handleOrderSubmit = async (form: OrderForm) => {
    const selectedProduct = products?.find(p => p.id === form.selectedProductId);
    if (!selectedProduct) return;
    
    setIsSubmitting(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('place-order', {
        body: {
          userId: null,
          items: [{ 
            productId: selectedProduct.id, 
            variationId: form.selectedVariationId || null, 
            quantity: form.quantity 
          }],
          shipping: { name: form.name, phone: form.phone, address: form.address },
          shippingZone: form.shippingZone,
          orderSource: 'landing_page',
          notes: form.note ? `LP:cotton-tarsel-collection | কাস্টমার নোট: ${form.note}` : 'LP:cotton-tarsel-collection',
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      if (!data?.orderId) {
        throw new Error('Order was not created');
      }

      navigate('/order-confirmation', {
        state: {
          orderNumber: data.orderNumber || data.orderId,
          customerName: form.name,
          phone: form.phone,
          total: form.total,
          items: [{ 
            productId: selectedProduct.id, 
            productName: selectedProduct.name, 
            price: form.subtotal! / form.quantity, 
            quantity: form.quantity 
          }],
          numItems: form.quantity,
          fromLandingPage: true,
          landingPageSlug: 'cotton-tarsel-collection',
        }
      });
    } catch (err) {
      console.error("Order error:", err);
      toast.error("অর্ডার করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-rose-50">
        <div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !products || products.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <h1 className="text-xl font-bold mb-4">প্রোডাক্ট পাওয়া যায়নি</h1>
        <Button onClick={() => navigate("/")} className="bg-rose-500 hover:bg-rose-600">
          হোম পেজে যান
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <HeroSection 
        products={products} 
        onBuyNow={scrollToCheckout} 
        selectedProductId={selectedProductId}
        onProductSelect={setSelectedProductId}
      />
      <FeaturesBanner />
      <ProductsGallery products={products} />
      <ProductDescriptionSection products={products} />
      <VideoSection videoUrl={videoUrl} />
      <DeliverySection />
      <div ref={checkoutRef}>
        <CheckoutSection 
          products={products} 
          onSubmit={handleOrderSubmit} 
          isSubmitting={isSubmitting}
          selectedProductId={selectedProductId}
          onProductSelect={setSelectedProductId}
        />
      </div>
      
      {/* Floating CTA */}
      {showFloatingCta && (
        <div className="fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur-sm border-t md:hidden z-50 safe-area-inset-bottom">
          <Button
            onClick={scrollToCheckout}
            className="w-full h-12 text-base font-bold bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-xl shadow-lg"
          >
            <ShoppingBag className="mr-2 h-5 w-5" />
            এখনই অর্ডার করুন
          </Button>
        </div>
      )}
    </div>
  );
};

export default CottonTarselLandingPage;
