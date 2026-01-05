import { useState, useEffect, useCallback, memo, useMemo } from "react";
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
  Star, 
  Truck, 
  Shield, 
  Clock, 
  Phone,
  CheckCircle2,
  ShoppingBag,
  MessageCircle,
  Play
} from "lucide-react";
import { ShippingMethodSelector, ShippingZone, SHIPPING_RATES } from "@/components/checkout/ShippingMethodSelector";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

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
  description?: string;
  short_description?: string;
  variations: ProductVariation[];
}

// ====== Optimized Image Component with lazy loading ======
const OptimizedImage = memo(({ 
  src, 
  alt, 
  className, 
  priority = false 
}: { 
  src: string; 
  alt: string; 
  className?: string; 
  priority?: boolean;
}) => {
  const [loaded, setLoaded] = useState(false);
  
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!loaded && (
        <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse" />
      )}
      <img
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        onLoad={() => setLoaded(true)}
        className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
});

OptimizedImage.displayName = 'OptimizedImage';

// ====== Hero Section ======
const HeroSection = memo(({ 
  product, 
  currentImage, 
  setCurrentImage,
  onBuyNow 
}: { 
  product: ProductData; 
  currentImage: number;
  setCurrentImage: (i: number) => void;
  onBuyNow: () => void;
}) => {
  const images = product.images || [];
  const discount = product.original_price 
    ? Math.round(((product.original_price - product.price) / product.original_price) * 100) 
    : 0;

  const nextImage = useCallback(() => {
    setCurrentImage((currentImage + 1) % images.length);
  }, [currentImage, images.length, setCurrentImage]);

  const prevImage = useCallback(() => {
    setCurrentImage((currentImage - 1 + images.length) % images.length);
  }, [currentImage, images.length, setCurrentImage]);

  // Auto-slide
  useEffect(() => {
    if (images.length <= 1) return;
    const timer = setInterval(nextImage, 4000);
    return () => clearInterval(timer);
  }, [nextImage, images.length]);

  return (
    <section className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>

      <div className="container mx-auto px-4 py-8 md:py-16 relative z-10">
        <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
          {/* Image Gallery */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="relative"
          >
            {discount > 0 && (
              <Badge className="absolute top-4 left-4 z-20 bg-red-500 text-white text-lg px-4 py-2 font-bold shadow-lg">
                -{discount}% ছাড়
              </Badge>
            )}
            
            <div className="relative aspect-[3/4] max-w-md mx-auto rounded-2xl overflow-hidden shadow-2xl">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentImage}
                  initial={{ opacity: 0, scale: 1.05 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0"
                >
                  {images[currentImage] && (
                    <OptimizedImage
                      src={images[currentImage]}
                      alt={product.name}
                      className="w-full h-full"
                      priority={currentImage === 0}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
              
              {images.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur-sm rounded-full p-3 shadow-lg hover:bg-white transition-all hover:scale-110"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="h-5 w-5 text-gray-800" />
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur-sm rounded-full p-3 shadow-lg hover:bg-white transition-all hover:scale-110"
                    aria-label="Next image"
                  >
                    <ChevronRight className="h-5 w-5 text-gray-800" />
                  </button>
                  
                  {/* Thumbnail Dots */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                    {images.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentImage(idx)}
                        className={`w-3 h-3 rounded-full transition-all ${
                          idx === currentImage 
                            ? "bg-white scale-125 shadow-lg" 
                            : "bg-white/50 hover:bg-white/80"
                        }`}
                        aria-label={`View image ${idx + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
            
            {/* Thumbnail Strip */}
            {images.length > 1 && (
              <div className="flex gap-2 mt-4 justify-center overflow-x-auto pb-2">
                {images.slice(0, 6).map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentImage(idx)}
                    className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${
                      idx === currentImage 
                        ? "border-amber-400 scale-105" 
                        : "border-transparent opacity-60 hover:opacity-100"
                    }`}
                  >
                    <OptimizedImage src={img} alt="" className="w-full h-full" />
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          {/* Product Info */}
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-white space-y-6"
          >
            <h1 className="text-3xl md:text-5xl font-bold leading-tight">
              {product.name}
            </h1>
            
            {product.short_description && (
              <p className="text-lg md:text-xl text-gray-300 leading-relaxed">
                {product.short_description}
              </p>
            )}

            {/* Price */}
            <div className="flex items-baseline gap-4 flex-wrap">
              <span className="text-amber-400 text-xl">দাম</span>
              <span className="text-5xl md:text-6xl font-bold text-amber-400">
                {product.price.toLocaleString()}৳
              </span>
              {product.original_price && product.original_price > product.price && (
                <span className="text-2xl text-gray-400 line-through">
                  {product.original_price.toLocaleString()}৳
                </span>
              )}
            </div>

            {/* CTA Button */}
            <Button
              onClick={onBuyNow}
              size="lg"
              className="w-full md:w-auto px-12 py-7 text-xl font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-gray-900 rounded-xl shadow-xl hover:shadow-2xl transition-all hover:scale-105"
            >
              <ShoppingBag className="mr-2 h-6 w-6" />
              এখনই অর্ডার করুন
            </Button>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-4 pt-4">
              {[
                { icon: Shield, title: "১০০%", subtitle: "কোয়ালিটি গ্যারান্টি" },
                { icon: Truck, title: "সারা বাংলাদেশ", subtitle: "ডেলিভারি সার্ভিস" },
                { icon: CheckCircle2, title: "ক্যাশ অন", subtitle: "ডেলিভারি" },
              ].map((badge, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + idx * 0.1 }}
                  className="text-center p-3 rounded-xl bg-white/10 backdrop-blur-sm"
                >
                  <badge.icon className="h-6 w-6 mx-auto mb-2 text-amber-400" />
                  <div className="font-bold text-sm">{badge.title}</div>
                  <div className="text-xs text-gray-400">{badge.subtitle}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
});

HeroSection.displayName = 'HeroSection';

// ====== Features Banner ======
const FeaturesBanner = memo(({ description }: { description?: string }) => {
  const features = [
    "১০০% প্রিমিয়াম ফ্যাব্রিক",
    "এমব্রয়ডারি কাজ করা",
    "সাইজ ৩৬-৪৬",
    "কালার গ্যারান্টি",
    "সুপার কমফোর্টেবল ফিট",
  ];

  return (
    <section className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 py-6 overflow-hidden">
      <div className="container mx-auto px-4">
        <motion.h2 
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-4"
        >
          প্রিমিয়াম ফিচার সমূহ
        </motion.h2>
        <div className="flex flex-wrap justify-center gap-3 md:gap-6">
          {features.map((feature, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.05 }}
              className="flex items-center gap-2 bg-white/30 backdrop-blur-sm px-4 py-2 rounded-full text-gray-900 font-medium"
            >
              <span className="text-lg">👉</span>
              <span>{feature}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
});

FeaturesBanner.displayName = 'FeaturesBanner';

// ====== Product Gallery Section ======
const GallerySection = memo(({ images }: { images: string[] }) => {
  if (!images || images.length < 2) return null;

  return (
    <section className="py-12 md:py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <h2 className="text-2xl md:text-4xl font-bold text-gray-900 mb-2">
            প্রোডাক্ট গ্যালারি
          </h2>
          <p className="text-gray-600">বিভিন্ন কোণ থেকে দেখুন</p>
        </motion.div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {images.slice(0, 6).map((img, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="aspect-square rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow"
            >
              <OptimizedImage src={img} alt="" className="w-full h-full hover:scale-105 transition-transform duration-500" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
});

GallerySection.displayName = 'GallerySection';

// ====== Delivery Info Section ======
const DeliverySection = memo(() => {
  const deliveryInfo = [
    { 
      icon: Truck, 
      title: "ডেলিভারি চার্জ", 
      details: ["ঢাকার ভিতরে ৮০ টাকা", "ঢাকার বাইরে ১৩০ টাকা"],
      color: "bg-blue-500"
    },
    { 
      icon: Clock, 
      title: "ডেলিভারি সময়", 
      details: ["ঢাকায় ১-২ দিন", "ঢাকার বাইরে ২-৩ দিন"],
      color: "bg-green-500"
    },
    { 
      icon: Shield, 
      title: "ক্যাশ অন ডেলিভারি", 
      details: ["পণ্য হাতে পেয়ে", "টাকা পরিশোধ করুন"],
      color: "bg-purple-500"
    },
  ];

  return (
    <section className="py-12 md:py-16 bg-white">
      <div className="container mx-auto px-4">
        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-2xl md:text-4xl font-bold text-center text-gray-900 mb-10"
        >
          ডেলিভারি ও পেমেন্ট
        </motion.h2>
        
        <div className="grid md:grid-cols-3 gap-6">
          {deliveryInfo.map((info, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="relative bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow group"
            >
              <div className={`absolute -top-4 left-6 w-12 h-12 ${info.color} rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                <info.icon className="h-6 w-6 text-white" />
              </div>
              <div className="pt-6">
                <h3 className="text-xl font-bold text-gray-900 mb-3">{info.title}</h3>
                {info.details.map((detail, i) => (
                  <p key={i} className="text-gray-600 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    {detail}
                  </p>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
});

DeliverySection.displayName = 'DeliverySection';

// ====== WhatsApp CTA ======
const WhatsAppCTA = memo(() => (
  <section className="py-12 bg-gradient-to-r from-green-600 to-green-500">
    <div className="container mx-auto px-4 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        className="max-w-2xl mx-auto"
      >
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
          সরাসরি অর্ডার করতে
        </h2>
        <p className="text-green-100 text-lg mb-6">হোয়াটসঅ্যাপে মেসেজ করুন</p>
        <a
          href="https://wa.me/8801704466603"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-3 bg-white text-green-600 px-8 py-4 rounded-xl font-bold text-lg shadow-xl hover:shadow-2xl hover:scale-105 transition-all"
        >
          <MessageCircle className="h-6 w-6" />
          হোয়াটসঅ্যাপে মেসেজ করুন
        </a>
      </motion.div>
    </div>
  </section>
));

WhatsAppCTA.displayName = 'WhatsAppCTA';

// ====== Checkout Form Section ======
const CheckoutSection = memo(({ 
  product, 
  onSubmit,
  isSubmitting 
}: { 
  product: ProductData;
  onSubmit: (form: OrderForm) => void;
  isSubmitting: boolean;
}) => {
  const [form, setForm] = useState<OrderForm>({
    name: "",
    phone: "",
    address: "",
    quantity: 1,
    selectedVariationId: product.variations[0]?.id || "",
  });
  const [shippingZone, setShippingZone] = useState<ShippingZone>('outside_dhaka');

  const selectedVariation = useMemo(() => 
    product.variations.find(v => v.id === form.selectedVariationId),
    [product.variations, form.selectedVariationId]
  );

  const subtotal = (selectedVariation?.price || product.price) * form.quantity;
  const shippingCost = SHIPPING_RATES[shippingZone];
  const total = subtotal + shippingCost;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.address) {
      toast.error("সব তথ্য পূরণ করুন");
      return;
    }
    onSubmit({ ...form, shippingZone, subtotal, shippingCost, total });
  };

  return (
    <section id="checkout" className="py-12 md:py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto"
        >
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-4xl font-bold text-gray-900 mb-2">
              অর্ডার করতে নিচের তথ্যগুলো দিন
            </h2>
            <p className="text-gray-600">প্রোডাক্ট সিলেক্ট করে বাকি তথ্য দিন</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Product Selection */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
              <div className="bg-gray-900 text-white p-4">
                <h3 className="font-bold flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5" />
                  প্রোডাক্ট সিলেক্ট করুন
                </h3>
              </div>
              
              {product.variations.length > 0 ? (
                <div className="p-4 space-y-3">
                  {product.variations.map((variation) => (
                    <label
                      key={variation.id}
                      className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all border-2 ${
                        form.selectedVariationId === variation.id
                          ? 'border-amber-500 bg-amber-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name="variation"
                        value={variation.id}
                        checked={form.selectedVariationId === variation.id}
                        onChange={() => setForm(prev => ({ ...prev, selectedVariationId: variation.id }))}
                        className="w-5 h-5 text-amber-500"
                      />
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
                        {product.images?.[0] && (
                          <OptimizedImage src={product.images[0]} alt="" className="w-full h-full" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-gray-900">{product.name}</p>
                        <p className="text-sm text-gray-500">{variation.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-xl text-amber-600">৳{variation.price.toLocaleString()}</p>
                        {variation.original_price && variation.original_price > variation.price && (
                          <p className="text-sm text-gray-400 line-through">৳{variation.original_price.toLocaleString()}</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="p-4">
                  <div className="flex items-center gap-4 p-4 rounded-xl border-2 border-amber-500 bg-amber-50">
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
                      {product.images?.[0] && (
                        <OptimizedImage src={product.images[0]} alt="" className="w-full h-full" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-900">{product.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-xl text-amber-600">৳{product.price.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Quantity */}
              <div className="px-4 pb-4">
                <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl">
                  <span className="font-medium text-gray-700">পরিমাণ</span>
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, quantity: Math.max(1, prev.quantity - 1) }))}
                      className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 transition-colors font-bold text-lg"
                    >
                      −
                    </button>
                    <span className="text-xl font-bold w-8 text-center">{form.quantity}</span>
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, quantity: prev.quantity + 1 }))}
                      className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center hover:bg-amber-600 transition-colors font-bold text-lg"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Billing Details */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <Phone className="h-5 w-5 text-amber-500" />
                বিলিং তথ্য
              </h3>
              <div className="space-y-4">
                <Input
                  value={form.phone}
                  onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="মোবাইল নম্বর *"
                  type="tel"
                  required
                  className="h-14 text-lg rounded-xl border-2 focus:border-amber-500"
                />
                <Input
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="আপনার নাম *"
                  required
                  className="h-14 text-lg rounded-xl border-2 focus:border-amber-500"
                />
                <Textarea
                  value={form.address}
                  onChange={(e) => setForm(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="সম্পূর্ণ ঠিকানা (রোড, বাড়ি, থানা, জেলা) *"
                  required
                  rows={3}
                  className="text-lg rounded-xl border-2 focus:border-amber-500"
                />
              </div>
            </div>

            {/* Shipping */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <Truck className="h-5 w-5 text-amber-500" />
                ডেলিভারি এরিয়া
              </h3>
              <ShippingMethodSelector
                address={form.address}
                selectedZone={shippingZone}
                onZoneChange={setShippingZone}
              />
            </div>

            {/* Order Summary */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-xl p-6 text-white">
              <h3 className="font-bold text-lg mb-4">অর্ডার সামারি</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">সাবটোটাল</span>
                  <span>৳{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">ডেলিভারি চার্জ</span>
                  <span>৳{shippingCost}</span>
                </div>
                <div className="h-px bg-gray-700 my-3" />
                <div className="flex justify-between text-xl font-bold">
                  <span>মোট</span>
                  <span className="text-amber-400">৳{total.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-16 text-xl font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-gray-900 rounded-xl shadow-xl hover:shadow-2xl transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                  প্রসেসিং...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <ShoppingBag className="h-6 w-6" />
                  অর্ডার কনফার্ম করুন — ৳{total.toLocaleString()}
                </span>
              )}
            </Button>

            {/* Contact Info */}
            <div className="text-center space-y-2 text-gray-600">
              <p className="flex items-center justify-center gap-2">
                <Phone className="h-4 w-4" />
                যেকোনো প্রশ্নের জন্য কল করুন: 
                <a href="tel:+8801704466603" className="font-bold text-gray-900 hover:text-amber-600">+8801704466603</a>
              </p>
              <a 
                href="https://wa.me/8801704466603"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-green-600 hover:text-green-700 font-medium"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp এ মেসেজ করুন
              </a>
            </div>
          </form>
        </motion.div>
      </div>
    </section>
  );
});

CheckoutSection.displayName = 'CheckoutSection';

// ====== Order Form Interface ======
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

// ====== Main Page Component ======
const ProductLandingPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [currentImage, setCurrentImage] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch product data
  const { data: product, isLoading, error } = useQuery({
    queryKey: ["product-landing", slug],
    queryFn: async () => {
      // First try landing_pages table
      const { data: landingPage } = await supabase
        .from("landing_pages")
        .select("*")
        .eq("slug", slug)
        .eq("is_published", true)
        .single();

      if (landingPage?.product_ids?.length) {
        const productId = landingPage.product_ids[0];
        const { data: productData } = await supabase
          .from("products")
          .select("*")
          .eq("id", productId)
          .single();

        if (productData) {
          const { data: variations } = await supabase
            .from("product_variations")
            .select("*")
            .eq("product_id", productId)
            .eq("is_active", true)
            .order("sort_order");

          return {
            ...productData,
            images: productData.images || [],
            variations: variations || [],
          } as ProductData;
        }
      }

      // Fallback: try products table by slug
      const { data: directProduct } = await supabase
        .from("products")
        .select("*")
        .eq("slug", slug)
        .single();

      if (directProduct) {
        const { data: variations } = await supabase
          .from("product_variations")
          .select("*")
          .eq("product_id", directProduct.id)
          .eq("is_active", true)
          .order("sort_order");

        return {
          ...directProduct,
          images: directProduct.images || [],
          variations: variations || [],
        } as ProductData;
      }

      throw new Error("Product not found");
    },
  });

  const scrollToCheckout = useCallback(() => {
    document.getElementById("checkout")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleOrderSubmit = async (form: OrderForm) => {
    if (!product) return;

    setIsSubmitting(true);
    try {
      const variation = product.variations.find(v => v.id === form.selectedVariationId);
      const price = variation?.price || product.price;
      
      const { data, error } = await supabase.functions.invoke('place-order', {
        body: {
          userId: null,
          items: [{
            productId: product.id,
            variationId: form.selectedVariationId || null,
            quantity: form.quantity,
          }],
          shipping: {
            name: form.name,
            phone: form.phone,
            address: form.address,
          },
          shippingZone: form.shippingZone,
          orderSource: 'landing_page',
          notes: `LP:${slug}`,
        },
      });

      if (error) throw error;

      navigate('/order-confirmation', {
        state: {
          orderNumber: data.orderNumber || data.orderId,
          customerName: form.name,
          phone: form.phone,
          total: form.total,
          fromLandingPage: true,
          landingPageSlug: slug,
        }
      });
    } catch (error) {
      console.error("Order error:", error);
      toast.error("অর্ডার করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">লোড হচ্ছে...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">প্রোডাক্ট পাওয়া যায়নি</h1>
        <p className="text-gray-600 mb-6">এই প্রোডাক্টটি বর্তমানে উপলব্ধ নয়।</p>
        <Button onClick={() => navigate("/")} className="bg-amber-500 hover:bg-amber-600">
          হোম পেজে যান
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <HeroSection 
        product={product} 
        currentImage={currentImage}
        setCurrentImage={setCurrentImage}
        onBuyNow={scrollToCheckout}
      />
      <FeaturesBanner description={product.description} />
      <GallerySection images={product.images} />
      <DeliverySection />
      <WhatsAppCTA />
      <CheckoutSection 
        product={product} 
        onSubmit={handleOrderSubmit}
        isSubmitting={isSubmitting}
      />
      
      {/* Floating CTA for mobile */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-sm border-t md:hidden z-50">
        <Button
          onClick={scrollToCheckout}
          className="w-full h-14 text-lg font-bold bg-gradient-to-r from-amber-500 to-amber-600 text-gray-900 rounded-xl"
        >
          <ShoppingBag className="mr-2 h-5 w-5" />
          এখনই অর্ডার করুন — ৳{product.price.toLocaleString()}
        </Button>
      </div>
    </div>
  );
};

export default ProductLandingPage;
