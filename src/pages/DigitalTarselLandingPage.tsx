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
  Users,
  Flame,
  Gift,
  MapPin,
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
import { useFacebookPixel } from "@/hooks/useFacebookPixel";
import { useServerTracking } from "@/hooks/useServerTracking";

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

// Product slugs for Digital Tarsel landing page
const PRODUCT_SLUGS = ['new-digital-tarsel-surma-color', 'new-digital-tarsel-black-color'];

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
    <div className="bg-gradient-to-r from-slate-700 via-gray-800 to-slate-700 text-white py-3 px-4">
      <div className="container mx-auto flex items-center justify-center gap-6 text-sm font-medium flex-wrap">
        <span className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
          </span>
          <Users className="h-4 w-4" />
          <span className="font-bold">{viewers} জন</span> এখন দেখছেন
        </span>
        <span className="hidden sm:block text-white/50">|</span>
        <span className="flex items-center gap-2">
          <Flame className="h-4 w-4 animate-pulse text-amber-400" />
          মাত্র <span className="font-bold">{stock}টি</span> প্রতিটি কালারে বাকি!
        </span>
      </div>
    </div>
  );
});
UrgencyBanner.displayName = 'UrgencyBanner';

// ====== Hero Section ======
const HeroSection = memo(({ products, onBuyNow, selectedProductId, onProductSelect }: { 
  products: ProductData[]; 
  onBuyNow: () => void;
  selectedProductId: string;
  onProductSelect: (productId: string) => void;
}) => {
  const activeProduct = products.find(p => p.id === selectedProductId) || products[0];
  const [currentImage, setCurrentImage] = useState(0);

  useEffect(() => {
    if (!activeProduct?.images?.length || activeProduct.images.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % activeProduct.images.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [activeProduct]);

  useEffect(() => {
    setCurrentImage(0);
  }, [selectedProductId]);

  const discount = activeProduct?.original_price 
    ? Math.round(((activeProduct.original_price - activeProduct.price) / activeProduct.original_price) * 100) 
    : 0;

  const getColorLabel = (slug: string) => {
    if (slug.includes('surma')) return 'সুরমা কালার';
    if (slug.includes('black')) return 'ব্ল্যাক কালার';
    return 'কালার';
  };

  const getColorDot = (slug: string) => {
    if (slug.includes('surma')) return 'bg-slate-500 border-slate-600';
    if (slug.includes('black')) return 'bg-gray-900 border-gray-800';
    return 'bg-gray-400 border-gray-500';
  };

  return (
    <section className="relative py-4 sm:py-6 md:py-10 overflow-hidden bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-100">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 w-40 h-40 bg-slate-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-60 h-60 bg-gray-200/30 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10 max-w-xl lg:max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 items-center">
          
          <div className="lg:order-1">
            <div className="text-center lg:hidden mb-4">
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-3"
              >
                <span className="inline-flex items-center gap-2 bg-gradient-to-r from-slate-700 to-gray-800 text-white px-6 py-2.5 rounded-full text-base font-bold shadow-lg">
                  <Sparkles className="h-5 w-5 text-amber-400" />
                  ডিজিটাল টারসেল কালেকশন
                </span>
              </motion.div>

              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
                নিউ ডিজিটাল টারসেল
              </h1>
              <p className="text-gray-600 text-base sm:text-lg">
                ডিজিটাল প্রিন্ট, প্রিমিয়াম কোয়ালিটি
              </p>
            </div>

            <div id="product-selector" className="flex justify-center gap-3 mb-4">
              {products.map((product) => (
                <motion.button
                  key={product.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onProductSelect(product.id)}
                  className={`relative px-4 py-2 rounded-full font-semibold transition-all text-sm ${
                    selectedProductId === product.id
                      ? 'bg-gradient-to-r from-slate-700 to-gray-800 text-white shadow-lg scale-105'
                      : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-slate-400'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full border-2 ${getColorDot(product.slug)}`} />
                    {getColorLabel(product.slug)}
                  </span>
                </motion.button>
              ))}
            </div>

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
                  <Badge className="absolute top-4 left-4 z-20 bg-amber-500 text-white text-sm px-3 py-1.5 font-bold shadow-lg">
                    -{discount}% ছাড়
                  </Badge>
                )}
                
                <div className="relative aspect-square rounded-3xl overflow-hidden shadow-2xl bg-white ring-4 ring-slate-100 max-w-md mx-auto">
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

                {activeProduct?.images && activeProduct.images.length > 1 && (
                  <div className="flex gap-2 mt-4 justify-center">
                    {activeProduct.images.slice(0, 6).map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentImage(idx)}
                        className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden border-2 transition-all ${
                          idx === currentImage 
                            ? "border-slate-600 scale-110 shadow-lg" 
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

            <div className="text-center mt-6 lg:hidden">
              <div className="flex items-center justify-center gap-3 flex-wrap">
                {activeProduct?.original_price && activeProduct.original_price > activeProduct.price && (
                  <span className="text-gray-400 line-through text-xl sm:text-2xl">
                    ৳{activeProduct.original_price.toLocaleString()}
                  </span>
                )}
                <span className="text-slate-700 font-bold text-4xl sm:text-5xl">
                  ৳{activeProduct?.price?.toLocaleString()} টাকা
                </span>
              </div>
            </div>
          </div>

          <div className="hidden lg:block lg:order-2 text-center lg:text-left">
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4"
            >
              <span className="inline-flex items-center gap-2 bg-gradient-to-r from-slate-700 to-gray-800 text-white px-5 py-2 rounded-full text-sm font-bold shadow-lg">
                <Sparkles className="h-4 w-4 text-amber-400" />
                ডিজিটাল টারসেল কালেকশন
              </span>
            </motion.div>

            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
              নিউ ডিজিটাল টারসেল
            </h1>
            <p className="text-gray-600 text-lg mb-6">
              ডিজিটাল প্রিন্ট, প্রিমিয়াম কোয়ালিটি
            </p>

            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 inline-block">
              <div className="flex items-center gap-3 flex-wrap">
                {activeProduct?.original_price && activeProduct.original_price > activeProduct.price && (
                  <span className="text-gray-400 line-through text-2xl">
                    ৳{activeProduct.original_price.toLocaleString()}
                  </span>
                )}
                <span className="text-slate-700 font-bold text-4xl lg:text-5xl">
                  ৳{activeProduct?.price?.toLocaleString()}
                </span>
              </div>
            </div>

            <div>
              <Button
                onClick={onBuyNow}
                size="lg"
                className="px-10 py-6 text-lg font-bold bg-gradient-to-r from-slate-700 to-gray-800 hover:from-slate-800 hover:to-gray-900 text-white rounded-2xl shadow-xl hover:shadow-2xl transition-all hover:scale-[1.02]"
              >
                <ShoppingBag className="mr-2 h-5 w-5" />
                এখনই অর্ডার করুন
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-6">
              {[
                { icon: Shield, title: "১০০% গ্যারান্টি" },
                { icon: Truck, title: "সারাদেশে ডেলিভারি" },
                { icon: Gift, title: "ক্যাশ অন ডেলিভারি" },
              ].map((item, idx) => (
                <div key={idx} className="flex flex-col items-center gap-1 p-3 bg-white/60 backdrop-blur-sm rounded-xl border border-slate-100">
                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                    <item.icon className="h-5 w-5 text-slate-600" />
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
  <section className="bg-gradient-to-r from-slate-700 via-gray-800 to-slate-700 py-5">
    <div className="container mx-auto px-4">
      <div className="flex flex-wrap justify-center gap-4 md:gap-8">
        {[
          { text: "ডিজিটাল প্রিন্ট", icon: "🖨️" },
          { text: "প্রিমিয়াম ফেব্রিক", icon: "✨" },
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
  const [imageIndices, setImageIndices] = useState<Record<string, number>>({});
  
  const getColorLabel = (slug: string) => {
    if (slug.includes('surma')) return 'সুরমা কালার';
    if (slug.includes('black')) return 'ব্ল্যাক কালার';
    return 'কালার';
  };
  
  return (
    <section className="py-12 md:py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <span className="inline-block bg-slate-100 text-slate-600 px-4 py-1.5 rounded-full text-sm font-medium mb-3">
            📸 গ্যালারি
          </span>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">দুটি স্টাইলিশ কালার অপশন</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {products.map((product) => {
            const currentIdx = imageIndices[product.id] || 0;
            return (
              <div key={product.id} className="bg-gradient-to-br from-slate-50 to-gray-100 rounded-2xl p-4 shadow-lg">
                <div className="aspect-square rounded-xl overflow-hidden mb-3 bg-white">
                  <OptimizedImage
                    src={product.images?.[currentIdx] || product.images?.[0] || ''}
                    alt={product.name}
                    className="w-full h-full"
                  />
                </div>
                
                {product.images && product.images.length > 1 && (
                  <div className="flex gap-2 justify-center mb-3">
                    {product.images.slice(0, 4).map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setImageIndices(prev => ({ ...prev, [product.id]: idx }))}
                        className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                          currentIdx === idx ? "border-slate-600 scale-105" : "border-gray-200 opacity-70 hover:opacity-100"
                        }`}
                      >
                        <OptimizedImage src={img} alt="" className="w-full h-full" />
                      </button>
                    ))}
                  </div>
                )}
                
                <div className="text-center">
                  <h3 className="font-bold text-gray-900">{getColorLabel(product.slug)}</h3>
                  <p className="text-slate-600 font-bold text-lg">৳{product.price.toLocaleString()}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
});
ProductsGallery.displayName = 'ProductsGallery';

// ====== Delivery Section ======
const DeliverySection = memo(() => (
  <section className="py-10 md:py-14 bg-white">
    <div className="container mx-auto px-4">
      <div className="text-center mb-8">
        <span className="inline-block bg-slate-100 text-slate-600 px-4 py-1.5 rounded-full text-sm font-medium mb-3">
          🚚 ডেলিভারি
        </span>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900">ডেলিভারি ও পেমেন্ট</h2>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
        {[
          { icon: Truck, title: "সারাদেশে ডেলিভারি", sub: "৩-৫ দিনের মধ্যে", color: "bg-slate-600" },
          { icon: Gift, title: "ক্যাশ অন ডেলিভারি", sub: "পণ্য দেখে পেমেন্ট", color: "bg-gray-700" },
          { icon: Shield, title: "রিটার্ন গ্যারান্টি", sub: "৭ দিনের মধ্যে", color: "bg-slate-700" },
        ].map((item, idx) => (
          <div key={idx} className="flex items-center gap-3 p-4 bg-gradient-to-br from-slate-50 to-gray-100 rounded-xl">
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
  const product = products.find(p => p.long_description || p.description);
  const description = product?.long_description || product?.description;
  
  if (!description || !description.trim()) return null;
  
  const lines = description.split('\n').filter(line => line.trim());
  
  return (
    <section className="py-10 md:py-14 bg-gradient-to-b from-white to-gray-50">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <span className="inline-flex items-center gap-2 bg-slate-100 text-slate-600 px-4 py-1.5 rounded-full text-sm font-medium mb-3">
              📋 বিস্তারিত
            </span>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">প্রোডাক্ট বিবরণ</h2>
          </div>
          
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-slate-700 to-gray-800 p-4">
              <h3 className="text-lg font-bold text-white">এই প্রোডাক্টের বৈশিষ্ট্য</h3>
            </div>
            
            <div className="p-6">
              <ul className="space-y-3">
                {lines.map((line, idx) => {
                  const cleanLine = line.replace(/^[-•*]\s*/, '').trim();
                  if (!cleanLine) return null;
                  
                  return (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center mt-0.5">
                        <Check className="h-4 w-4 text-slate-600" />
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

// ====== Video Section ======
const VideoSection = memo(({ videoUrl }: { videoUrl?: string }) => {
  if (!videoUrl) return null;

  const raw = (videoUrl || "").trim();
  const isRawHtml = raw.startsWith("<");
  
  const getInlineEmbedUrl = (url: string) => {
    const embedUrl = getEmbedUrl(url);
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
          <span className="inline-flex items-center gap-2 bg-slate-700 text-white px-4 py-1.5 rounded-full text-sm font-medium">
            <Play className="h-4 w-4" />
            ভিডিও দেখুন
          </span>
        </div>

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
  const [productImageIndex, setProductImageIndex] = useState<Record<string, number>>({});

  useEffect(() => {
    if (selectedProductId) {
      setForm(prev => ({ ...prev, selectedProductId }));
    }
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

  useEffect(() => {
    setForm(prev => ({ ...prev, selectedVariationId: "" }));
  }, [form.selectedProductId]);

  const getColorLabel = (slug: string) => {
    if (slug.includes('surma')) return 'সুরমা কালার';
    if (slug.includes('black')) return 'ব্ল্যাক কালার';
    return 'কালার';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.selectedProductId) {
      toast.error("প্রোডাক্ট সিলেক্ট করুন");
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
    <section id="checkout" className="py-10 md:py-14 bg-gradient-to-b from-slate-50 to-white">
      <div className="container mx-auto px-4">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-6">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">অর্ডার করুন</h2>
            <p className="text-gray-600 text-sm mt-1">পণ্য হাতে পেয়ে মূল্য পরিশোধ করুন</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div id="checkout-product-selector" className={`bg-white rounded-xl shadow-lg overflow-hidden border-2 ${!form.selectedProductId ? 'border-slate-400' : 'border-transparent'}`}>
              <div className="bg-gradient-to-r from-slate-700 to-gray-800 text-white py-3 px-4 font-bold flex items-center gap-2">
                <Heart className="h-4 w-4" />
                কালার সিলেক্ট করুন {!form.selectedProductId && <span className="text-amber-300">*</span>}
              </div>
              
              <div className="p-4">
                {!form.selectedProductId && (
                  <p className="text-sm text-slate-600 mb-3 font-medium">👇 এখান থেকে কালার সিলেক্ট করুন</p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {products.map((product) => {
                    const currentImageIdx = productImageIndex[product.id] || 0;
                    const images = product.images || [];
                    
                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => {
                          updateForm('selectedProductId', product.id);
                          onProductSelect(product.id);
                        }}
                        className={`relative p-3 rounded-xl border-2 transition-all ${
                          form.selectedProductId === product.id
                            ? 'border-slate-600 bg-slate-50 shadow-md'
                            : 'border-gray-200 hover:border-slate-400'
                        }`}
                      >
                        <div className="aspect-square rounded-lg overflow-hidden mb-2">
                          <OptimizedImage 
                            src={images[currentImageIdx] || images[0] || ''} 
                            alt={product.name} 
                            className="w-full h-full"
                          />
                        </div>
                        
                        {images.length > 1 && (
                          <div className="flex gap-1 justify-center mb-2">
                            {images.slice(0, 3).map((img, idx) => (
                              <div
                                key={idx}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setProductImageIndex(prev => ({ ...prev, [product.id]: idx }));
                                }}
                                className={`w-10 h-10 rounded overflow-hidden border-2 cursor-pointer transition-all ${
                                  currentImageIdx === idx 
                                    ? 'border-slate-600 scale-105' 
                                    : 'border-gray-200 opacity-70 hover:opacity-100'
                                }`}
                              >
                                <OptimizedImage src={img} alt="" className="w-full h-full" />
                              </div>
                            ))}
                          </div>
                        )}
                        
                        <p className="text-sm font-medium text-gray-800 line-clamp-1">
                          {getColorLabel(product.slug)}
                        </p>
                        <p className="text-slate-600 font-bold">৳{product.price.toLocaleString()}</p>
                        
                        {form.selectedProductId === product.id && (
                          <div className="absolute top-2 right-2 w-6 h-6 bg-slate-600 rounded-full flex items-center justify-center">
                            <Check className="h-4 w-4 text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {variations.length > 0 && (
              <div ref={sizeSelectionRef} className="bg-white rounded-xl shadow-lg p-4 border">
                <p className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-slate-600" />
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
                          ? 'border-slate-600 bg-slate-600 text-white shadow-md'
                          : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-slate-400'
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
                    className="w-10 h-10 rounded-full bg-slate-600 text-white flex items-center justify-center hover:bg-slate-700 font-bold text-lg"
                  >+</button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-4 border space-y-3">
              <h3 className="font-bold flex items-center gap-2 text-gray-900">
                <Phone className="h-4 w-4 text-slate-600" />
                আপনার তথ্য
              </h3>
              <Input
                value={form.phone}
                onChange={(e) => updateForm('phone', e.target.value)}
                placeholder="মোবাইল নম্বর *"
                type="tel"
                inputMode="numeric"
                required
                className="h-12 text-base rounded-lg border-2 focus:border-slate-500"
              />
              <Input
                value={form.name}
                onChange={(e) => updateForm('name', e.target.value)}
                placeholder="আপনার নাম *"
                required
                className="h-12 text-base rounded-lg border-2 focus:border-slate-500"
              />
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Textarea
                  value={form.address}
                  onChange={(e) => updateForm('address', e.target.value)}
                  placeholder="সম্পূর্ণ ঠিকানা (বাড়ি, রোড, থানা, জেলা) *"
                  required
                  rows={2}
                  className="pl-10 text-base rounded-lg border-2 focus:border-slate-500 resize-none"
                />
              </div>
              
              <div className="relative">
                <FileText className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Textarea
                  value={form.note}
                  onChange={(e) => updateForm('note', e.target.value)}
                  placeholder="অতিরিক্ত তথ্য (ঐচ্ছিক)"
                  rows={2}
                  className="pl-10 text-base rounded-lg border-2 focus:border-slate-500 resize-none"
                />
              </div>
            </div>

            <ShippingMethodSelector
              selectedZone={shippingZone}
              onZoneChange={setShippingZone}
              address={form.address}
            />

            <div className="bg-gradient-to-br from-slate-50 to-gray-100 rounded-xl p-4 border-2 border-slate-200">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">সাবটোটাল:</span>
                  <span className="font-medium">৳{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">ডেলিভারি:</span>
                  <span className="font-medium">৳{shippingCost}</span>
                </div>
                <div className="h-px bg-slate-200 my-2" />
                <div className="flex justify-between text-lg font-bold">
                  <span>মোট:</span>
                  <span className="text-slate-700">৳{total.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-14 text-lg font-bold bg-gradient-to-r from-slate-700 to-gray-800 hover:from-slate-800 hover:to-gray-900 text-white rounded-xl shadow-xl"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  অর্ডার হচ্ছে...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5" />
                  অর্ডার কনফার্ম করুন
                </span>
              )}
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
});
CheckoutSection.displayName = 'CheckoutSection';

// ====== Main Component ======
const DigitalTarselLandingPage = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [showFloatingCta, setShowFloatingCta] = useState(true);
  const checkoutRef = useRef<HTMLDivElement>(null);
  const hasTrackedViewContent = useRef(false);

  const { 
    isReady: pixelReady, 
    trackViewContentWithEventId, 
    trackInitiateCheckoutWithEventId,
    generateEventId 
  } = useFacebookPixel();
  const serverTracking = useServerTracking();

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
    queryKey: ["digital-tarsel-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .in("slug", PRODUCT_SLUGS)
        .eq("is_active", true);

      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Products not found");

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

  useEffect(() => {
    if (products && products.length > 0 && pixelReady && !hasTrackedViewContent.current) {
      hasTrackedViewContent.current = true;
      const firstProduct = products[0];
      const eventId = generateEventId('ViewContent');
      
      trackViewContentWithEventId({
        content_ids: products.map(p => p.id),
        content_name: 'Digital Tarsel Collection',
        content_type: 'product_group',
        value: firstProduct.price,
        currency: 'BDT',
      }, eventId);

      serverTracking.trackViewContent({
        contentId: firstProduct.id,
        contentName: 'Digital Tarsel Collection',
        value: firstProduct.price,
      });
      
      console.log('[Digital Tarsel] ViewContent tracked with event_id:', eventId);
    }
  }, [products, pixelReady, trackViewContentWithEventId, generateEventId, serverTracking]);

  const { data: videoUrl } = useQuery({
    queryKey: ["digital-tarsel-video-url"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_settings")
        .select("value")
        .eq("key", "digital_tarsel_video_url")
        .maybeSingle();

      if (error) throw error;
      return data?.value || "";
    },
    staleTime: 5 * 60 * 1000,
  });

  const trackCheckoutView = useCallback(() => {
    if (!products || products.length === 0 || !pixelReady) return;
    
    const firstProduct = products[0];
    const eventId = generateEventId('InitiateCheckout');
    
    trackInitiateCheckoutWithEventId({
      content_ids: products.map(p => p.id),
      num_items: 1,
      value: firstProduct.price,
      currency: 'BDT',
    }, eventId);

    serverTracking.trackInitiateCheckout({
      contentIds: products.map(p => p.id),
      value: firstProduct.price,
      numItems: 1,
      eventId,
    });
    
    console.log('[Digital Tarsel] InitiateCheckout tracked with event_id:', eventId);
  }, [products, pixelReady, trackInitiateCheckoutWithEventId, generateEventId, serverTracking]);

  const scrollToCheckout = useCallback(() => {
    trackCheckoutView();
    document.getElementById("checkout")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [trackCheckoutView]);

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
          notes: form.note ? `LP:digital-tarsel-collection | কাস্টমার নোট: ${form.note}` : 'LP:digital-tarsel-collection',
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
          landingPageSlug: 'digital-tarsel-collection',
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-slate-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !products || products.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <h1 className="text-xl font-bold mb-4">প্রোডাক্ট পাওয়া যায়নি</h1>
        <Button onClick={() => navigate("/")} className="bg-slate-600 hover:bg-slate-700">
          হোম পেজে যান
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <UrgencyBanner />
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
      
      {showFloatingCta && (
        <div className="fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur-sm border-t md:hidden z-50 safe-area-inset-bottom">
          <Button
            onClick={scrollToCheckout}
            className="w-full h-12 text-base font-bold bg-gradient-to-r from-slate-700 to-gray-800 text-white rounded-xl shadow-lg"
          >
            <ShoppingBag className="mr-2 h-5 w-5" />
            এখনই অর্ডার করুন
          </Button>
        </div>
      )}
    </div>
  );
};

export default DigitalTarselLandingPage;
