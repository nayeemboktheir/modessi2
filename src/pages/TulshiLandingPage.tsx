import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, Phone, MessageCircle, Leaf, Shield, Wind, ChevronDown, ChevronUp, Minus, Plus, Play, User, LayoutDashboard } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import productImage from '@/assets/tulshi-lungs-product.jpg';
import tulshiPlusImage from '@/assets/tulshi-plus-product.jpg';
import lungsGuardImage from '@/assets/lungs-guard-product.jpg';
import logoImage from '@/assets/logo.png';

const DEFAULT_PRODUCT = {
  name: 'Tulshi Plus & Lungs Guard Capsole',
  price: 1550,
  originalPrice: 2300,
  image: productImage,
};

const SHIPPING = {
  dhaka: 80,
  outside: 130,
};

export default function TulshiLandingPage() {
  const navigate = useNavigate();
  const [quantity, setQuantity] = useState(1);
  const [shippingZone, setShippingZone] = useState<'dhaka' | 'outside'>('dhaka');
  const [formData, setFormData] = useState({
    phone: '',
    name: '',
    address: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [productVideo, setProductVideo] = useState('');
  const [reviewVideos, setReviewVideos] = useState<string[]>([]);
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [product, setProduct] = useState(DEFAULT_PRODUCT);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from('admin_settings')
        .select('key, value')
        .in('key', ['landing_product_video', 'landing_review_videos', 'landing_product_name', 'landing_product_price', 'landing_product_original_price']);
      
      data?.forEach((item) => {
        if (item.key === 'landing_product_video') setProductVideo(item.value);
        if (item.key === 'landing_product_name') {
          setProduct(prev => ({ ...prev, name: item.value }));
        }
        if (item.key === 'landing_product_price') {
          setProduct(prev => ({ ...prev, price: Number(item.value) }));
        }
        if (item.key === 'landing_product_original_price') {
          setProduct(prev => ({ ...prev, originalPrice: Number(item.value) }));
        }
        if (item.key === 'landing_review_videos') {
          try {
            const videos = JSON.parse(item.value);
            setReviewVideos(videos.filter((v: string) => v.trim() !== ''));
          } catch {
            if (item.value) setReviewVideos([item.value]);
          }
        }
      });
    };
    fetchSettings();

    // Check auth status
    const checkAuth = async () => {
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
    };
    checkAuth();
  }, []);

  const getEmbedUrl = (url: string) => {
    if (!url) return '';
    // Handle YouTube Shorts
    if (url.includes('/shorts/')) {
      const videoId = url.split('/shorts/')[1]?.split('?')[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }
    // Handle regular YouTube links
    if (url.includes('watch?v=')) {
      return url.replace('watch?v=', 'embed/');
    }
    // Handle youtu.be short links
    if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1]?.split('?')[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }
    return url;
  };

  const subtotal = product.price * quantity;
  const shippingCost = SHIPPING[shippingZone];
  const total = subtotal + shippingCost;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.phone || !formData.name || !formData.address) {
      toast.error('সব তথ্য পূরণ করুন');
      return;
    }

    setIsSubmitting(true);

    try {
      // Create order via backend function (bypasses RLS safely)
      const { data, error } = await supabase.functions.invoke('place-order', {
        body: {
          userId: user?.id ?? null,
          items: [
            {
              productId: 'tulshi-combo', // non-UUID => will be treated as custom item
              productName: product.name,
              productImage: product.image,
              price: product.price,
              quantity,
            },
          ],
          shipping: {
            name: formData.name,
            phone: formData.phone,
            address: formData.address,
          },
          shippingZone: shippingZone === 'dhaka' ? 'inside_dhaka' : 'outside_dhaka',
          orderSource: 'web',
          notes: 'LP:tulshi',
        },
      });

      if (error) {
        const anyErr = error as any;
        const details =
          anyErr?.context?.body?.error ||
          anyErr?.context?.body?.message ||
          anyErr?.message ||
          'অর্ডার করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।';
        throw new Error(typeof details === 'string' ? details : JSON.stringify(details));
      }

      if (!data?.orderId) throw new Error('Order was not created');

      // Navigate to thank you page
      navigate('/order-confirmation', {
        state: {
          orderNumber: data.orderNumber || data.orderId,
          customerName: formData.name,
          phone: formData.phone,
          total: data.total || total,
          fromLandingPage: true,
          landingPageSlug: 'tulshi',
        },
      });
    } catch (error) {
      console.error('Order error:', error);
      const msg = error instanceof Error ? error.message : 'অর্ডার করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const faqs = [
    {
      question: 'কতদিন খেলে রেজাল্ট বোঝা যায়?',
      answer: 'সাধারণত ৭ থেকে ১৪ দিন নিয়মিত সেবন করলে পরিবর্তন লক্ষ্য করা যায়।',
    },
    {
      question: 'কোন সাইড ইফেক্ট আছে কি?',
      answer: 'এটি সম্পূর্ণ প্রাকৃতিক উপাদানে তৈরি, তাই সাধারণত কোনো ক্ষতিকর পার্শ্বপ্রতিক্রিয়া নেই।',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="container-custom py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={logoImage} alt="Natural Touch BD" className="h-10 w-10 object-contain" />
            <span className="font-bold text-lg text-foreground">Natural Touch BD</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="#order">
              <Button className="bg-primary hover:bg-primary/90">অর্ডার করুন</Button>
            </a>
            <Link to={user ? (isAdmin ? '/admin' : '/my-account') : '/auth'}>
              <Button variant="outline" size="icon" className="rounded-full">
                {user && isAdmin ? <LayoutDashboard className="h-5 w-5" /> : <User className="h-5 w-5" />}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-12 md:py-20 bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <div className="container-custom">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center md:text-left"
            >
              <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                100% Herbal | Ayurvedic Support
              </span>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 leading-tight">
                প্রাকৃতিক ভাবে ইমিউনিটি ও ফুসফুসের <span className="text-primary">ডাবল সাপোর্ট</span>
              </h1>
              <p className="text-muted-foreground text-lg mb-6">
                <span className="font-semibold text-foreground">Tulsi Plus</span> এবং{' '}
                <span className="font-semibold text-foreground">Lungs Guard</span> – ঠান্ডা, কাশি ও শ্বাসযন্ত্রের সুরক্ষায় একটি কমপ্লিট ন্যাচারাল কম্বো।
              </p>
              <div className="flex flex-wrap gap-4 mb-6 justify-center md:justify-start">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-primary" />
                  <span>হারবাল ফর্মুলা</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-primary" />
                  <span>ল্যাব টেস্টেড</span>
                </div>
              </div>
              <a href="#order" className="inline-block">
                <Button size="lg" className="bg-primary hover:bg-primary/90 gap-2">
                  <MessageCircle className="h-5 w-5" />
                  এখনই কম্বো অর্ডার করুন
                </Button>
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <img
                src={productImage}
                alt={product.name}
                className="w-full max-w-md mx-auto rounded-2xl shadow-xl"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Problems Section */}
      <section className="py-16 bg-muted/50">
        <div className="container-custom">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-10">
            কেন বারবার ঠান্ডা-কাশি বা শ্বাসকষ্ট হচ্ছে?
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Wind,
                title: 'বারবার ঠান্ডা-কাশি',
                desc: 'ঋতু বদলালেই সর্দি, কাশি বা গলা ব্যথায় ভোগেন এবং সহজে সারতে চায় না।',
              },
              {
                icon: Shield,
                title: 'ধুলা ও ধোঁয়ার সমস্যা',
                desc: 'রাস্তায় বের হলে বা ধূমপানের কারণে শ্বাস নিতে কষ্ট হয়, বুকে চাপ অনুভব করেন।',
              },
              {
                icon: Leaf,
                title: 'কফ ও শ্বাসকষ্ট',
                desc: 'গলায় কফ জমে থাকা বা খুসখুসে কাশির কারণে রাতে ঘুমাতে সমস্যা হয়।',
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-card p-6 rounded-xl shadow-md border border-border"
              >
                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                  <item.icon className="h-6 w-6 text-destructive" />
                </div>
                <h3 className="font-semibold text-lg text-foreground mb-2">{item.title}</h3>
                <p className="text-muted-foreground">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Product Video Section */}
      {productVideo && (
        <section className="py-16">
          <div className="container-custom">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-4">
              প্রোডাক্ট পরিচিতি ও কার্যকারিতা
            </h2>
            <p className="text-center text-muted-foreground mb-8">
              আমাদের প্রোডাক্টের বিস্তারিত জানুন এবং দেখুন কিভাবে এটি কাজ করে
            </p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="max-w-3xl mx-auto rounded-2xl overflow-hidden shadow-xl"
            >
              <div className="relative aspect-video bg-muted">
                <iframe
                  src={getEmbedUrl(productVideo)}
                  title="প্রোডাক্ট পরিচিতি"
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* Review Videos Section */}
      {reviewVideos.length > 0 && (
        <section className="py-16 bg-muted/50">
          <div className="container-custom">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-4">
              ভিডিও রিভিউ ও বিস্তারিত
            </h2>
            <p className="text-center text-muted-foreground mb-8">
              আমাদের কাস্টমারদের মতামত এবং প্রোডাক্টের কার্যকারিতা সরাসরি দেখুন
            </p>
            <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
              {reviewVideos.map((video, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="rounded-2xl overflow-hidden shadow-xl"
                >
                  <div className="relative aspect-video bg-muted">
                    <iframe
                      src={getEmbedUrl(video)}
                      title={`ভিডিও রিভিউ ${index + 1}`}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Solution Section */}
      <section className="py-16">
        <div className="container-custom">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-4">
            Tulsi Plus + Lungs Guard
          </h2>
          <p className="text-center text-muted-foreground mb-10">
            ডাবল একশন ন্যাচারাল সাপোর্ট – সুস্থতার চাবিকাঠি
          </p>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-card rounded-2xl overflow-hidden shadow-lg border border-border"
            >
              <img 
                src={tulshiPlusImage} 
                alt="Tulshi Plus - প্রাকৃতিকভাবে রোগ প্রতিরোধ ক্ষমতা বাড়ান" 
                className="w-full h-auto object-contain"
              />
              <div className="p-6">
                <h3 className="font-bold text-xl text-primary mb-2">Tulsi Plus</h3>
                <p className="text-muted-foreground">ভাইরাস ও ফ্লু থেকে সুরক্ষা দেয় এবং ইমিউনিটি বাড়ায়।</p>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-card rounded-2xl overflow-hidden shadow-lg border border-border"
            >
              <img 
                src={lungsGuardImage} 
                alt="Lungs Guard - ফুসফুসের সুরক্ষায় প্রাকৃতিক উপায়" 
                className="w-full h-auto object-contain"
              />
              <div className="p-6">
                <h3 className="font-bold text-xl text-secondary mb-2">Lungs Guard</h3>
                <p className="text-muted-foreground">ফুসফুস পরিষ্কার করে এবং শ্বাস নেওয়া সহজ করে তোলে।</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-muted/50">
        <div className="container-custom max-w-2xl">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-10">
            সচরাচর জিজ্ঞাসা (FAQ)
          </h2>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-card rounded-xl border border-border overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left"
                >
                  <span className="font-medium text-foreground">{faq.question}</span>
                  {openFaq === i ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-4 text-muted-foreground">{faq.answer}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-primary text-primary-foreground">
        <div className="container-custom text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">আজই কম্বো অর্ডার করুন</h2>
          <div className="flex items-center justify-center gap-3 mb-6">
            <span className="text-3xl font-bold">৳ {product.price.toLocaleString()}</span>
            <span className="text-xl line-through opacity-70">৳ {product.originalPrice.toLocaleString()}</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <a href="https://wa.me/8801330576687" target="_blank" rel="noopener noreferrer">
              <Button variant="secondary" size="lg" className="gap-2">
                <MessageCircle className="h-5 w-5" />
                WhatsApp এ অর্ডার
              </Button>
            </a>
            <a href="tel:01330576687">
              <Button variant="outline" size="lg" className="gap-2 bg-transparent border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary">
                <Phone className="h-5 w-5" />
                01330-576687
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Order Form Section */}
      <section id="order" className="py-16">
        <div className="container-custom max-w-4xl">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-10">
            অর্ডার করতে নিচের তথ্যগুলো দিন
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Product Selection */}
            <div className="bg-card p-6 rounded-xl border border-border">
              <h3 className="font-semibold text-lg text-foreground mb-4">প্রোডাক্ট সিলেক্ট করে বাকি তথ্য দিনঃ</h3>
              
              <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg mb-4">
                <img src={productImage} alt={product.name} className="w-20 h-20 object-cover rounded-lg" />
                <div className="flex-1">
                  <p className="font-medium text-foreground">{product.name}</p>
                  <p className="text-primary font-semibold">৳ {product.price.toLocaleString()}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 mb-6">
                <span className="text-muted-foreground">Quantity:</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-10 text-center font-medium">{quantity}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity(quantity + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Order Summary */}
              <div className="border-t border-border pt-4 space-y-2">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>৳ {subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Shipping</span>
                  <span>৳ {shippingCost}</span>
                </div>
                <div className="flex justify-between font-bold text-lg text-foreground pt-2 border-t border-border">
                  <span>Total</span>
                  <span className="text-primary">৳ {total.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Billing Form */}
            <form onSubmit={handleSubmit} className="bg-card p-6 rounded-xl border border-border">
              <h3 className="font-semibold text-lg text-foreground mb-4">Billing details</h3>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="phone">মোবাইল নাম্বার *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="01XXXXXXXXX"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="name">পুরো নাম *</Label>
                  <Input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="address">পুরো ঠিকানা *</Label>
                  <Input
                    id="address"
                    type="text"
                    value={formData.address}
                    onChange={(e) => {
                      const address = e.target.value;
                      setFormData({ ...formData, address });
                      
                      // Auto-detect shipping zone based on address
                      const lowerAddress = address.toLowerCase();
                      if (lowerAddress.includes('ঢাকা') || lowerAddress.includes('dhaka') || lowerAddress.includes('mirpur') || lowerAddress.includes('মিরপুর') || lowerAddress.includes('uttara') || lowerAddress.includes('উত্তরা') || lowerAddress.includes('gulshan') || lowerAddress.includes('গুলশান') || lowerAddress.includes('dhanmondi') || lowerAddress.includes('ধানমন্ডি') || lowerAddress.includes('motijheel') || lowerAddress.includes('মতিঝিল')) {
                        setShippingZone('dhaka');
                      } else if (address.length > 5) {
                        setShippingZone('outside');
                      }
                    }}
                    placeholder="এলাকা, থানা, জেলা"
                    required
                  />
                </div>

                <div>
                  <Label className="mb-3 block">Shipping</Label>
                  <RadioGroup
                    value={shippingZone}
                    onValueChange={(v) => setShippingZone(v as 'dhaka' | 'outside')}
                    className="space-y-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="dhaka" id="dhaka" />
                      <Label htmlFor="dhaka" className="font-normal cursor-pointer">
                        ঢাকার ভিতরে: ৳ {SHIPPING.dhaka}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="outside" id="outside" />
                      <Label htmlFor="outside" className="font-normal cursor-pointer">
                        ঢাকার বাইরে: ৳ {SHIPPING.outside}
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="bg-muted/50 p-3 rounded-lg text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Cash on delivery</p>
                  <p>Pay with cash upon delivery.</p>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90"
                  size="lg"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'অর্ডার হচ্ছে...' : 'অর্ডার কনফার্ম করুন'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-foreground text-background/80">
        <div className="container-custom text-center">
          <p className="text-sm">© {new Date().getFullYear()} Natural Touch BD. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
