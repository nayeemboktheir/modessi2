import { useState, useEffect, useCallback, memo, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronLeft, 
  ChevronRight, 
  Truck, 
  Shield, 
  Phone,
  CheckCircle2,
  ShoppingBag,
  MessageCircle,
  Play,
  Users,
  Clock,
  Flame,
  Gift,
  MapPin
} from "lucide-react";
import { ShippingMethodSelector, ShippingZone, SHIPPING_RATES } from "@/components/checkout/ShippingMethodSelector";
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
  variations: ProductVariation[];
}

interface OrderForm {
  name: string;
  phone: string;
  address: string;
  quantity: number;
  selectedVariationId: string;
  shippingZone?: ShippingZone;
  subtotal?: number;
  shippingCost?: number;
  total?: number;
}

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
  const [viewers] = useState(() => Math.floor(Math.random() * 15) + 8);
  const [stock] = useState(() => Math.floor(Math.random() * 10) + 3);
  
  return (
    <div className="bg-gradient-to-r from-primary via-primary to-accent text-primary-foreground py-2.5 px-4">
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
          মাত্র <span className="font-bold text-white">{stock}টি</span> স্টকে আছে!
        </span>
      </div>
    </div>
  );
});
UrgencyBanner.displayName = 'UrgencyBanner';

// ====== Hero Section ======
const HeroSection = memo(({ product, currentImage, setCurrentImage, onBuyNow }: { 
  product: ProductData; currentImage: number; setCurrentImage: (i: number) => void; onBuyNow: () => void;
}) => {
  const images = product.images || [];
  const discount = product.original_price 
    ? Math.round(((product.original_price - product.price) / product.original_price) * 100) 
    : 0;

  useEffect(() => {
    if (images.length <= 1) return;
    const timer = setInterval(() => setCurrentImage((currentImage + 1) % images.length), 4000);
    return () => clearInterval(timer);
  }, [currentImage, images.length, setCurrentImage]);

  return (
    <section className="gradient-dark py-8 md:py-14">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center max-w-5xl mx-auto">
          {/* Image */}
          <div className="relative max-w-lg mx-auto w-full">
            {discount > 0 && (
              <Badge className="absolute top-4 left-4 z-20 bg-destructive text-destructive-foreground text-base px-4 py-2 font-bold shadow-lg">
                -{discount}% ছাড়
              </Badge>
            )}
            
            <div className="relative aspect-square rounded-3xl overflow-hidden shadow-2xl bg-card ring-4 ring-white/10">
              {images[currentImage] && (
                <OptimizedImage src={images[currentImage]} alt={product.name} className="w-full h-full" priority />
              )}
              
              {images.length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentImage((currentImage - 1 + images.length) % images.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-background/95 backdrop-blur-sm rounded-full p-2.5 shadow-xl hover:scale-110 transition-all border border-border"
                    aria-label="Previous"
                  >
                    <ChevronLeft className="h-5 w-5 text-foreground" />
                  </button>
                  <button
                    onClick={() => setCurrentImage((currentImage + 1) % images.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-background/95 backdrop-blur-sm rounded-full p-2.5 shadow-xl hover:scale-110 transition-all border border-border"
                    aria-label="Next"
                  >
                    <ChevronRight className="h-5 w-5 text-foreground" />
                  </button>
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/30 backdrop-blur-sm px-3 py-2 rounded-full">
                    {images.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentImage(idx)}
                        className={`h-2 rounded-full transition-all duration-300 ${idx === currentImage ? "bg-accent w-8" : "bg-white/60 w-2 hover:bg-white"}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-3 mt-4 justify-center">
                {images.slice(0, 5).map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentImage(idx)}
                    className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all duration-300 ${
                      idx === currentImage 
                        ? "border-accent scale-110 shadow-lg ring-2 ring-accent/30" 
                        : "border-transparent opacity-60 hover:opacity-100 hover:scale-105"
                    }`}
                  >
                    <OptimizedImage src={img} alt="" className="w-full h-full" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="text-primary-foreground space-y-5 text-center md:text-left">
            <div>
              <span className="inline-block bg-accent/20 text-accent px-3 py-1 rounded-full text-sm font-medium mb-3">
                🔥 হট সেলিং প্রোডাক্ট
              </span>
              <h1 className="text-3xl md:text-5xl font-bold leading-tight">{product.name}</h1>
            </div>
            
            {product.short_description && (
              <p className="text-base md:text-lg text-primary-foreground/80 leading-relaxed">{product.short_description}</p>
            )}

            {/* Price */}
            <div className="flex items-baseline gap-4 flex-wrap py-3 px-5 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10">
              <span className="text-4xl md:text-5xl font-bold text-accent">৳{product.price.toLocaleString()}</span>
              {product.original_price && product.original_price > product.price && (
                <span className="text-xl text-primary-foreground/50 line-through">৳{product.original_price.toLocaleString()}</span>
              )}
              {discount > 0 && (
                <Badge className="bg-green-500 text-white font-bold px-3 py-1">
                  ৳{(product.original_price! - product.price).toLocaleString()} সেভ!
                </Badge>
              )}
            </div>

            {/* CTA */}
            <Button
              onClick={onBuyNow}
              size="lg"
              className="w-full md:w-auto px-12 py-7 text-xl font-bold bg-gradient-to-r from-accent to-yellow-500 hover:from-yellow-500 hover:to-accent text-foreground rounded-2xl shadow-cta hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
            >
              <ShoppingBag className="mr-2 h-6 w-6" />
              এখনই অর্ডার করুন
            </Button>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-3 pt-3">
              {[
                { icon: Shield, text: "১০০% গ্যারান্টি", color: "text-green-400" },
                { icon: Truck, text: "সারাদেশে ডেলিভারি", color: "text-blue-400" },
                { icon: Gift, text: "ক্যাশ অন ডেলিভারি", color: "text-purple-400" },
              ].map((item, idx) => (
                <div key={idx} className="text-center p-3 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-colors">
                  <item.icon className={`h-6 w-6 mx-auto mb-1.5 ${item.color}`} />
                  <span className="text-xs font-medium text-primary-foreground/90">{item.text}</span>
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

// ====== Features ======
const FeaturesBanner = memo(() => (
  <section className="bg-gradient-to-r from-accent via-yellow-400 to-accent py-5 overflow-hidden relative">
    <div className="container mx-auto px-4 relative">
      <div className="flex flex-wrap justify-center gap-4 md:gap-8">
        {[
          { text: "প্রিমিয়াম কোয়ালিটি", icon: "✨" },
          { text: "কালার গ্যারান্টি", icon: "🎨" },
          { text: "কমফোর্টেবল ফিট", icon: "👕" },
          { text: "ইজি এক্সচেঞ্জ", icon: "🔄" }
        ].map((item, idx) => (
          <div key={idx} className="flex items-center gap-2 bg-white/50 backdrop-blur-sm px-4 py-2 rounded-full text-foreground font-semibold text-sm shadow-sm hover:bg-white/70 transition-colors">
            <span>{item.icon}</span>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span>{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  </section>
));
FeaturesBanner.displayName = 'FeaturesBanner';

// ====== Gallery ======
const GallerySection = memo(({ images }: { images: string[] }) => {
  if (!images || images.length < 2) return null;
  return (
    <section className="py-12 md:py-16 gradient-elegant">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <span className="inline-block bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-medium mb-3">
              📸 গ্যালারি
            </span>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">প্রোডাক্ট গ্যালারি</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {images.slice(0, 6).map((img, idx) => (
              <div key={idx} className="group aspect-square rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 ring-1 ring-border">
                <OptimizedImage src={img} alt="" className="w-full h-full group-hover:scale-110 transition-transform duration-500" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
});
GallerySection.displayName = 'GallerySection';

// ====== Video ======
const VideoSection = memo(({ videoUrl }: { videoUrl?: string }) => {
  if (!videoUrl) return null;

  const isIframe = videoUrl.trim().startsWith('<iframe');
  
  // Extract aspect ratio from iframe if available
  const extractIframeInfo = (html: string) => {
    const widthMatch = html.match(/width=["']?(\d+)/);
    const heightMatch = html.match(/height=["']?(\d+)/);
    const width = widthMatch ? parseInt(widthMatch[1]) : 16;
    const height = heightMatch ? parseInt(heightMatch[1]) : 9;
    return { aspectRatio: width / height };
  };
  
  const getEmbedUrl = (url: string) => {
    const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?rel=0`;
    
    if (url.includes('facebook.com')) return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`;
    if (url.match(/\.(mp4|webm|ogg)$/i)) return url;
    return url;
  };

  const iframeInfo = isIframe ? extractIframeInfo(videoUrl) : null;
  // For portrait videos (9:16), use taller container. For landscape (16:9), use standard aspect-video
  const isPortrait = iframeInfo && iframeInfo.aspectRatio < 1;

  return (
    <section className="py-10 md:py-16 gradient-dark">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <span className="inline-flex items-center gap-2 bg-primary/20 text-primary-foreground px-4 py-1.5 rounded-full text-sm font-medium mb-3">
            <Play className="h-4 w-4" />
            ভিডিও দেখুন
          </span>
          <h2 className="text-2xl md:text-3xl font-bold text-white">প্রোডাক্ট ভিডিও</h2>
        </div>
        
        <div className={`max-w-3xl mx-auto ${isPortrait ? 'max-w-sm' : ''}`}>
          <div 
            className="relative rounded-2xl overflow-hidden shadow-2xl bg-black ring-1 ring-white/10"
            style={{ 
              aspectRatio: isPortrait ? '9/16' : '16/9'
            }}
          >
            {isIframe ? (
              <div 
                className="absolute inset-0 [&>iframe]:!w-full [&>iframe]:!h-full [&>iframe]:!border-0" 
                dangerouslySetInnerHTML={{ 
                  __html: videoUrl.replace(/width=["']?\d+["']?/gi, 'width="100%"').replace(/height=["']?\d+["']?/gi, 'height="100%"')
                }} 
              />
            ) : videoUrl.match(/\.(mp4|webm|ogg)$/i) ? (
              <video 
                src={videoUrl} 
                controls 
                className="absolute inset-0 w-full h-full object-contain" 
                preload="metadata"
                playsInline
              />
            ) : (
              <iframe 
                src={getEmbedUrl(videoUrl)} 
                title="Video" 
                allowFullScreen 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                className="absolute inset-0 w-full h-full border-0" 
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
});
VideoSection.displayName = 'VideoSection';

// ====== Product Description ======
const ProductDescriptionSection = memo(({ description }: { description?: string }) => {
  if (!description || !description.trim()) return null;
  
  // Parse description - split by newlines and handle bullet points
  const lines = description.split('\n').filter(line => line.trim());
  
  return (
    <section className="py-10 md:py-16 bg-gradient-to-b from-white to-gray-50">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <span className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-medium mb-3">
              📋 বিস্তারিত
            </span>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground font-bengali">প্রোডাক্ট বিবরণ</h2>
          </div>
          
          {/* Description Cards */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-primary to-accent p-4">
              <h3 className="text-lg font-bold text-primary-foreground font-bengali">
                এই প্রোডাক্টের বৈশিষ্ট্য
              </h3>
            </div>
            
            <div className="p-6">
              <ul className="space-y-3">
                {lines.map((line, idx) => {
                  // Remove ALL leading emoji/bullet/special chars including diamond ◊
                  const cleanLine = line
                    .replace(/^[\s◊◆●○▪▫•✓✔✅👉👍🔘🌴\-\*\u25CA\u25C6\u25CF\u25CB\u25AA\u25AB]+/g, '')
                    .trim();
                  if (!cleanLine) return null;
                  
                  return (
                    <li 
                      key={idx}
                      className="p-4 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100 hover:shadow-md transition-all duration-300"
                    >
                      <span className="text-gray-800 font-medium text-base md:text-lg leading-relaxed font-bengali">
                        {cleanLine}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
            
            {/* Trust Footer */}
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 p-4 border-t border-amber-100">
              <p className="text-center text-amber-700 font-medium font-bengali">
                ১০০% কোয়ালিটি গ্যারান্টি সহ
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});
ProductDescriptionSection.displayName = 'ProductDescriptionSection';

// ====== Delivery Info ======
const DeliverySection = memo(() => (
  <section className="py-8 md:py-12 bg-white">
    <div className="container mx-auto px-4">
      <h2 className="text-xl md:text-2xl font-bold text-center text-gray-900 mb-6">ডেলিভারি ও পেমেন্ট</h2>
      <div className="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto">
        {[
          { icon: Truck, title: "ঢাকায় ৮০৳", sub: "বাইরে ১৩০৳", color: "bg-blue-500" },
          { icon: Clock, title: "১-৩ দিনে", sub: "ডেলিভারি", color: "bg-green-500" },
          { icon: Shield, title: "ক্যাশ অন", sub: "ডেলিভারি", color: "bg-purple-500" },
        ].map((item, idx) => (
          <div key={idx} className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
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

// ====== Checkout Form ======
const CheckoutSection = memo(({ product, onSubmit, isSubmitting }: { 
  product: ProductData; onSubmit: (form: OrderForm) => void; isSubmitting: boolean;
}) => {
  const [form, setForm] = useState<OrderForm>({
    name: "", phone: "", address: "", quantity: 1, selectedVariationId: "",
  });
  const [shippingZone, setShippingZone] = useState<ShippingZone>('outside_dhaka');
  const formRef = useRef<HTMLFormElement>(null);
  const sizeSelectionRef = useRef<HTMLDivElement>(null);

  const variations = useMemo(() => {
    // De-dupe by variation name to avoid showing the same "Size" multiple times
    const seen = new Set<string>();
    const out: ProductVariation[] = [];
    for (const v of product.variations || []) {
      const key = String(v.name || '').trim().toLowerCase();
      if (!key) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(v);
    }
    return out;
  }, [product.variations]);

  const selectedVariation = useMemo(
    () => variations.find(v => v.id === form.selectedVariationId),
    [variations, form.selectedVariationId]
  );

  const unitPrice = selectedVariation?.price || product.price;
  const subtotal = unitPrice * form.quantity;
  const shippingCost = SHIPPING_RATES[shippingZone];
  const total = subtotal + shippingCost;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (variations.length > 0 && !form.selectedVariationId) {
      toast.error("সাইজ সিলেক্ট করুন");
      // Scroll to size selection area
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
    <section id="checkout" className="py-8 md:py-12 bg-gradient-to-b from-gray-100 to-white">
      <div className="container mx-auto px-4">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-6">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">অর্ডার করুন</h2>
            <p className="text-gray-600 text-sm mt-1">পণ্য হাতে পেয়ে মূল্য পরিশোধ করুন</p>
          </div>

          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
            {/* Product Card */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden border">
              <div className="bg-gray-900 text-white py-3 px-4 font-bold flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" />
                প্রোডাক্ট
              </div>
              
              <div className="p-4">
                {/* Product Info Row */}
                <div className="flex gap-3 items-center mb-4">
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    {product.images?.[0] && <OptimizedImage src={product.images[0]} alt="" className="w-full h-full" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 truncate">{product.name}</p>
                    <p className="text-xl font-bold text-amber-600">৳{unitPrice.toLocaleString()}</p>
                  </div>
                </div>

                {/* Size Selection */}
                {variations.length > 0 && (
                  <div ref={sizeSelectionRef} className="mb-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">সাইজ নির্বাচন করুন <span className="text-red-500">*</span></p>
                    <div className="flex flex-wrap gap-2">
                      {variations.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => updateForm('selectedVariationId', v.id)}
                          className={`px-4 py-2.5 rounded-lg font-semibold transition-all border-2 ${
                            form.selectedVariationId === v.id
                              ? 'border-amber-500 bg-amber-500 text-white shadow-md'
                              : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-amber-300'
                          }`}
                        >
                          {v.name}
                        </button>
                      ))}
                    </div>
                    {!form.selectedVariationId && (
                      <p className="text-xs text-red-500 mt-1">* সাইজ সিলেক্ট করুন</p>
                    )}
                  </div>
                )}

                {/* Quantity */}
                <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                  <span className="font-medium text-gray-700">পরিমাণ</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => updateForm('quantity', Math.max(1, form.quantity - 1))}
                      className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 font-bold text-lg"
                    >−</button>
                    <span className="text-lg font-bold w-6 text-center">{form.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateForm('quantity', form.quantity + 1)}
                      className="w-9 h-9 rounded-full bg-amber-500 text-white flex items-center justify-center hover:bg-amber-600 font-bold text-lg"
                    >+</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Customer Info */}
            <div className="bg-white rounded-xl shadow-lg p-4 border space-y-3">
              <h3 className="font-bold flex items-center gap-2 text-gray-900">
                <Phone className="h-4 w-4 text-amber-500" />
                আপনার তথ্য
              </h3>
              <Input
                value={form.phone}
                onChange={(e) => updateForm('phone', e.target.value)}
                placeholder="মোবাইল নম্বর *"
                type="tel"
                inputMode="numeric"
                required
                className="h-12 text-base rounded-lg border-2 focus:border-amber-500"
              />
              <Input
                value={form.name}
                onChange={(e) => updateForm('name', e.target.value)}
                placeholder="আপনার নাম *"
                required
                className="h-12 text-base rounded-lg border-2 focus:border-amber-500"
              />
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Textarea
                  value={form.address}
                  onChange={(e) => updateForm('address', e.target.value)}
                  placeholder="সম্পূর্ণ ঠিকানা (বাড়ি, রোড, থানা, জেলা) *"
                  required
                  rows={2}
                  className="pl-10 text-base rounded-lg border-2 focus:border-amber-500 resize-none"
                />
              </div>
            </div>

            {/* Shipping */}
            <div className="bg-white rounded-xl shadow-lg p-4 border">
              <h3 className="font-bold flex items-center gap-2 text-gray-900 mb-3">
                <Truck className="h-4 w-4 text-amber-500" />
                ডেলিভারি এরিয়া
              </h3>
              <ShippingMethodSelector
                address={form.address}
                selectedZone={shippingZone}
                onZoneChange={setShippingZone}
              />
            </div>

            {/* Order Summary */}
            <div className="bg-gray-900 rounded-xl p-4 text-white">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">সাবটোটাল ({form.quantity}টি)</span>
                  <span>৳{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">ডেলিভারি</span>
                  <span>৳{shippingCost}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-700">
                  <span>সর্বমোট</span>
                  <span className="text-amber-400">৳{total.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-14 text-lg font-bold bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl shadow-xl disabled:opacity-70"
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
                কল করুন: <a href="tel:+8801704466603" className="font-bold text-gray-900">01704466603</a>
              </p>
              <a 
                href="https://wa.me/8801704466603"
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
const ProductLandingPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [currentImage, setCurrentImage] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFloatingCta, setShowFloatingCta] = useState(true);
  const checkoutRef = useRef<HTMLDivElement>(null);

  // Hide floating CTA when checkout section is visible
  useEffect(() => {
    const checkVisibility = () => {
      if (checkoutRef.current) {
        const rect = checkoutRef.current.getBoundingClientRect();
        // Hide floating button when checkout section top is in lower 70% of viewport
        const isCheckoutVisible = rect.top < window.innerHeight * 0.7;
        setShowFloatingCta(!isCheckoutVisible);
      }
    };

    // Check on scroll
    window.addEventListener('scroll', checkVisibility, { passive: true });
    // Initial check after a small delay to ensure DOM is ready
    const timer = setTimeout(checkVisibility, 100);

    return () => {
      window.removeEventListener('scroll', checkVisibility);
      clearTimeout(timer);
    };
  }, []);


  const { data: product, isLoading, error } = useQuery({
    queryKey: ["product-landing", slug],
    queryFn: async () => {
      const { data: landingPage } = await supabase
        .from("landing_pages")
        .select("*")
        .eq("slug", slug)
        .eq("is_published", true)
        .single();

      const productId = landingPage?.product_ids?.[0];
      
      if (productId) {
        const { data: productData } = await supabase.from("products").select("*, long_description").eq("id", productId).single();
        if (productData) {
          const { data: variations } = await supabase
            .from("product_variations")
            .select("*")
            .eq("product_id", productId)
            .eq("is_active", true)
            .order("sort_order");
          return { ...productData, images: productData.images || [], variations: variations || [], long_description: productData.long_description } as ProductData;
        }
      }

      const { data: directProduct } = await supabase.from("products").select("*, long_description").eq("slug", slug).single();
      if (directProduct) {
        const { data: variations } = await supabase
          .from("product_variations")
          .select("*")
          .eq("product_id", directProduct.id)
          .eq("is_active", true)
          .order("sort_order");
        return { ...directProduct, images: directProduct.images || [], variations: variations || [], long_description: directProduct.long_description } as ProductData;
      }

      throw new Error("Product not found");
    },
    staleTime: 5 * 60 * 1000,
  });

  const scrollToCheckout = useCallback(() => {
    document.getElementById("checkout")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleOrderSubmit = async (form: OrderForm) => {
    if (!product) return;
    setIsSubmitting(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('place-order', {
        body: {
          userId: null,
          items: [{ productId: product.id, variationId: form.selectedVariationId || null, quantity: form.quantity }],
          shipping: { name: form.name, phone: form.phone, address: form.address },
          shippingZone: form.shippingZone,
          orderSource: 'landing_page',
          notes: `LP:${slug}`,
        },
      });

      if (error) throw error;

      // place-order returns 200 even for blocked attempts (data.error + errorCode)
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
          items: [{ productId: product.id, productName: product.name, price: form.subtotal! / form.quantity, quantity: form.quantity }],
          numItems: form.quantity,
          fromLandingPage: true,
          landingPageSlug: slug,
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <h1 className="text-xl font-bold mb-4">প্রোডাক্ট পাওয়া যায়নি</h1>
        <Button onClick={() => navigate("/")} className="bg-amber-500 hover:bg-amber-600">হোম পেজে যান</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <UrgencyBanner />
      <HeroSection product={product} currentImage={currentImage} setCurrentImage={setCurrentImage} onBuyNow={scrollToCheckout} />
      <FeaturesBanner />
      <ProductDescriptionSection description={product.long_description} />
      <GallerySection images={product.images} />
      <VideoSection videoUrl={product.video_url} />
      <DeliverySection />
      <div ref={checkoutRef}>
        <CheckoutSection product={product} onSubmit={handleOrderSubmit} isSubmitting={isSubmitting} />
      </div>
      
      {/* Floating CTA - hidden when checkout is visible */}
      {showFloatingCta && (
        <div className="fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur-sm border-t md:hidden z-50 safe-area-inset-bottom">
          <Button
            onClick={scrollToCheckout}
            className="w-full h-12 text-base font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-gray-900 rounded-xl shadow-lg"
          >
            <ShoppingBag className="mr-2 h-5 w-5" />
            এখনই অর্ডার করুন
          </Button>
        </div>
      )}
    </div>
  );
};

export default ProductLandingPage;
