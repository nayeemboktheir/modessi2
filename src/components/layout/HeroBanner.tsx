import { useState, useEffect, useCallback } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import heroSlide1 from '@/assets/hero-slide-1.jpg';
import heroSlide2 from '@/assets/hero-slide-2.jpg';
import heroSlide3 from '@/assets/hero-slide-3.jpg';

interface HeroSlide {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  link: string;
  badge: string;
}

interface HeroBannerProps {
  compact?: boolean;
}

export default function HeroBanner({ compact = false }: HeroBannerProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const defaultSlides: HeroSlide[] = [
    {
      id: '1',
      title: 'নতুন টু পিস কালেকশন',
      subtitle: 'এক্সক্লুসিভ ডিজাইন, প্রিমিয়াম কোয়ালিটি - ৩০% পর্যন্ত ছাড়',
      image: heroSlide1,
      link: '/products?category=two-piece',
      badge: '৩০% ছাড়'
    },
    {
      id: '2',
      title: 'থ্রি পিস স্পেশাল',
      subtitle: 'প্রিমিয়াম ফেব্রিক, এলিগ্যান্ট ডিজাইন - নতুন আগমন',
      image: heroSlide2,
      link: '/products?category=three-piece',
      badge: 'নতুন'
    },
    {
      id: '3',
      title: 'সামার কালেকশন ২০২৬',
      subtitle: 'কমফোর্টেবল এবং স্টাইলিশ - গরমের জন্য পারফেক্ট',
      image: heroSlide3,
      link: '/products',
      badge: 'ট্রেন্ডিং'
    }
  ];

  useEffect(() => {
    const fetchSlides = async () => {
      try {
        // Try to get slides from home_page_content
        const { data: homeContent } = await supabase
          .from('home_page_content')
          .select('content')
          .eq('section_key', 'hero_slides')
          .single();

        if (homeContent?.content) {
          const content = homeContent.content as { slides?: any[] };
          if (content.slides?.length > 0) {
            const contentSlides = content.slides;
            if (contentSlides.some((s: any) => s.image)) {
              setHeroSlides(contentSlides.map((s: any, index: number) => ({
                id: s.id || String(index),
                title: s.title || '',
                subtitle: s.subtitle || '',
                image: s.image || defaultSlides[index]?.image || heroSlide1,
                link: s.link || '/products',
                badge: s.badge || ''
              })));
              setIsLoading(false);
              return;
            }
          }
        }

        // Try banners
        const { data: bannersData } = await supabase
          .from('banners')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        if (bannersData && bannersData.length > 0) {
          setHeroSlides(bannersData.map(b => ({
            id: b.id,
            title: b.title,
            subtitle: b.subtitle || '',
            image: b.image_url,
            link: b.link_url || '/products',
            badge: 'নতুন'
          })));
        } else {
          setHeroSlides(defaultSlides);
        }
      } catch (error) {
        console.error('Error fetching slides:', error);
        setHeroSlides(defaultSlides);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSlides();
  }, []);

  // Auto-slide
  useEffect(() => {
    if (heroSlides.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [heroSlides.length]);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
  }, [heroSlides.length]);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length);
  }, [heroSlides.length]);

  if (isLoading || heroSlides.length === 0) {
    return (
      <div className={`relative ${compact ? 'h-[30vh] md:h-[40vh]' : 'h-[50vh] md:h-[70vh]'} bg-muted animate-pulse`} />
    );
  }

  return (
    <section className={`relative ${compact ? 'h-[30vh] md:h-[40vh]' : 'h-[50vh] md:h-[70vh]'} overflow-hidden`}>
      <AnimatePresence mode="wait">
        <m.div
          key={currentSlide}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/40 to-transparent z-10" />
          <img
            loading="eager"
            fetchPriority="high"
            decoding="async"
            src={heroSlides[currentSlide].image}
            alt={heroSlides[currentSlide].title}
            className="w-full h-full object-cover"
          />
          
          <div className="absolute inset-0 z-20 flex items-center">
            <div className="container-custom">
              <m.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="max-w-xl"
              >
                {heroSlides[currentSlide].badge && (
                  <Badge className="mb-4 bg-primary text-primary-foreground px-4 py-1 text-sm">
                    {heroSlides[currentSlide].badge}
                  </Badge>
                )}
                <h2 className={`font-display font-bold text-white mb-4 ${
                  compact ? 'text-2xl md:text-4xl' : 'text-3xl md:text-5xl lg:text-6xl'
                }`}>
                  {heroSlides[currentSlide].title}
                </h2>
                <p className={`text-white/90 mb-6 ${compact ? 'text-sm md:text-base' : 'text-base md:text-lg'}`}>
                  {heroSlides[currentSlide].subtitle}
                </p>
                <div className="flex gap-4">
                  <Link to={heroSlides[currentSlide].link}>
                    <Button size={compact ? 'default' : 'lg'} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                      এখনই কিনুন
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link to="/products">
                    <Button size={compact ? 'default' : 'lg'} variant="outline" className="border-white text-white hover:bg-white/10">
                      সব দেখুন
                    </Button>
                  </Link>
                </div>
              </m.div>
            </div>
          </div>
        </m.div>
      </AnimatePresence>

      {/* Navigation Arrows */}
      {heroSlides.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 top-1/2 -translate-y-1/2 z-30 h-12 w-12 rounded-full bg-black/30 text-white hover:bg-black/50"
            onClick={prevSlide}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-1/2 -translate-y-1/2 z-30 h-12 w-12 rounded-full bg-black/30 text-white hover:bg-black/50"
            onClick={nextSlide}
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </>
      )}

      {/* Dots Indicator */}
      {heroSlides.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex gap-2">
          {heroSlides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === currentSlide 
                  ? 'w-8 bg-primary' 
                  : 'w-2 bg-white/50 hover:bg-white/80'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
