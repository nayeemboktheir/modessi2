import { useState, useEffect } from "react";
import { Section, ThemeSettings } from "./types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getEmbedUrl, parseIframeHtml } from "@/lib/videoEmbed";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";


interface SectionPreviewProps {
  section: Section;
  theme: ThemeSettings;
}

export const SectionPreview = ({ section, theme }: SectionPreviewProps) => {
  const [currentImage, setCurrentImage] = useState(0);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  // Countdown effect
  useEffect(() => {
    if (section.type !== 'countdown') return;
    const settings = section.settings as { endDate: string };
    if (!settings.endDate) return;

    const timer = setInterval(() => {
      const end = new Date(settings.endDate).getTime();
      const now = Date.now();
      const diff = Math.max(0, end - now);

      setCountdown({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [section]);

  const renderHeroProduct = () => {
    const settings = section.settings as {
      images: string[];
      title: string;
      subtitle: string;
      price: string;
      originalPrice: string;
      buttonText: string;
      buttonLink: string;
      badges: Array<{ text: string; subtext: string }>;
      backgroundColor: string;
      textColor: string;
      layout: string;
    };

    const images = settings.images || [];
    const isLeftImage = settings.layout !== 'right-image';
    const isCenter = settings.layout === 'center';

    const imageSection = (
      <div className="relative">
        {images.length > 0 ? (
          <div className="relative aspect-[3/4] max-w-md mx-auto">
            <img
              src={images[currentImage]}
              alt=""
              className="w-full h-full object-cover rounded-lg"
            />
            {images.length > 1 && (
              <>
                <button
                  onClick={() => setCurrentImage((p) => (p - 1 + images.length) % images.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-1"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setCurrentImage((p) => (p + 1) % images.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-1"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                  {images.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentImage(idx)}
                      className={`w-2 h-2 rounded-full ${idx === currentImage ? 'bg-white' : 'bg-white/50'}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="aspect-[3/4] max-w-md mx-auto bg-muted rounded-lg flex items-center justify-center">
            <span className="text-muted-foreground">Add Images</span>
          </div>
        )}
      </div>
    );

    const textSection = (
      <div className={`space-y-4 ${isCenter ? 'text-center' : ''}`}>
        <h1 className="text-3xl md:text-4xl font-bold" style={{ color: settings.textColor }}>
          {settings.title || 'Product Title'}
        </h1>
        <p className="text-lg opacity-80" style={{ color: settings.textColor }}>
          {settings.subtitle || 'Product description'}
        </p>
        <div className="flex items-baseline gap-2" style={{ justifyContent: isCenter ? 'center' : 'flex-start' }}>
          <span className="text-2xl font-bold" style={{ color: theme.accentColor }}>
            দাম
          </span>
          <span className="text-4xl font-bold" style={{ color: theme.accentColor }}>
            {settings.price ? `${settings.price}৳` : '0৳'}
          </span>
          {settings.originalPrice && (
            <span className="text-lg line-through opacity-50" style={{ color: settings.textColor }}>
              {settings.originalPrice}৳
            </span>
          )}
        </div>
        <Button
          size="lg"
          className="px-8"
          style={{
            backgroundColor: theme.primaryColor,
            color: '#fff',
            borderRadius: theme.borderRadius,
          }}
        >
          {settings.buttonText || 'Buy Now'}
        </Button>

        {/* Badges */}
        {settings.badges?.length > 0 && (
          <div className="flex flex-wrap gap-4 mt-6" style={{ justifyContent: isCenter ? 'center' : 'flex-start' }}>
            {settings.badges.map((badge, idx) => (
              <div key={idx} className="text-center">
                <div className="text-xl font-bold" style={{ color: settings.textColor }}>
                  {badge.text}
                </div>
                <div className="text-sm opacity-70" style={{ color: settings.textColor }}>
                  {badge.subtext}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );

    return (
      <section
        className="py-12 px-6"
        style={{ backgroundColor: settings.backgroundColor }}
      >
        {isCenter ? (
          <div className="max-w-4xl mx-auto space-y-8">
            {imageSection}
            {textSection}
          </div>
        ) : (
          <div className={`max-w-6xl mx-auto grid md:grid-cols-2 gap-8 items-center ${!isLeftImage ? 'direction-rtl' : ''}`}>
            {isLeftImage ? (
              <>
                {imageSection}
                {textSection}
              </>
            ) : (
              <>
                {textSection}
                {imageSection}
              </>
            )}
          </div>
        )}
      </section>
    );
  };

  const renderFeatureBadges = () => {
    const settings = section.settings as {
      title: string;
      badges: Array<{ icon: string; title: string; description: string }>;
      columns: number;
      backgroundColor: string;
      textColor: string;
    };

    return (
      <section
        className="py-12 px-6"
        style={{ backgroundColor: settings.backgroundColor, color: settings.textColor }}
      >
        <div className="max-w-6xl mx-auto">
          {settings.title && (
            <h2 className="text-2xl font-bold text-center mb-8">{settings.title}</h2>
          )}
          <div
            className="grid gap-6"
            style={{ gridTemplateColumns: `repeat(${settings.columns || 3}, 1fr)` }}
          >
            {(settings.badges || []).map((badge, idx) => (
              <div key={idx} className="text-center p-4">
                <div className="text-xl font-bold mb-1">{badge.title}</div>
                <div className="text-sm opacity-80">{badge.description}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  };

  const renderTextBlock = () => {
    const settings = section.settings as {
      content: string;
      alignment: string;
      fontSize: string;
      backgroundColor: string;
      textColor: string;
      padding: string;
    };

    return (
      <section
        className="px-6"
        style={{
          backgroundColor: settings.backgroundColor || 'transparent',
          color: settings.textColor,
          padding: settings.padding,
          textAlign: settings.alignment as 'left' | 'center' | 'right',
          fontSize: settings.fontSize,
        }}
      >
        <div className="max-w-4xl mx-auto whitespace-pre-wrap">
          {settings.content || 'Enter your text...'}
        </div>
      </section>
    );
  };

  const renderCheckoutForm = () => {
    const settings = section.settings as {
      title: string;
      buttonText: string;
      backgroundColor: string;
      accentColor: string;
    };

    return (
      <section
        id="checkout"
        className="py-12 px-6"
        style={{ backgroundColor: settings.backgroundColor }}
      >
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-6">{settings.title}</h2>
          <div className="space-y-4">
            <Input placeholder="আপনার নাম" />
            <Input placeholder="মোবাইল নম্বর" type="tel" />
            <Textarea placeholder="সম্পূর্ণ ঠিকানা" rows={3} />
            <Button
              className="w-full"
              size="lg"
              style={{
                backgroundColor: settings.accentColor,
                color: '#fff',
                borderRadius: theme.borderRadius,
              }}
            >
              {settings.buttonText}
            </Button>
          </div>
        </div>
      </section>
    );
  };

  const renderCTABanner = () => {
    const settings = section.settings as {
      title: string;
      subtitle: string;
      buttonText: string;
      buttonLink: string;
      backgroundColor: string;
      textColor: string;
    };

    return (
      <section
        className="py-16 px-6 text-center"
        style={{ backgroundColor: settings.backgroundColor, color: settings.textColor }}
      >
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-4">{settings.title}</h2>
          {settings.subtitle && <p className="text-lg mb-6 opacity-90">{settings.subtitle}</p>}
          {settings.buttonText && (
            <Button
              size="lg"
              variant="secondary"
              style={{ borderRadius: theme.borderRadius }}
            >
              {settings.buttonText}
            </Button>
          )}
        </div>
      </section>
    );
  };

  const renderImageGallery = () => {
    const settings = section.settings as {
      images: string[];
      columns: number;
      gap: string;
      aspectRatio: string;
    };

    const aspectClass = {
      square: 'aspect-square',
      portrait: 'aspect-[3/4]',
      landscape: 'aspect-video',
      auto: '',
    }[settings.aspectRatio] || 'aspect-square';

    return (
      <section className="py-8 px-6">
        <div
          className="max-w-6xl mx-auto grid"
          style={{
            gridTemplateColumns: `repeat(${settings.columns || 3}, 1fr)`,
            gap: settings.gap || '16px',
          }}
        >
          {(settings.images || []).map((img, idx) => (
            <div key={idx} className={aspectClass}>
              <img
                src={img}
                alt=""
                className="w-full h-full object-cover rounded-lg"
              />
            </div>
          ))}
        </div>
      </section>
    );
  };

  const renderImageText = () => {
    const settings = section.settings as {
      image: string;
      title: string;
      description: string;
      buttonText: string;
      buttonLink: string;
      imagePosition: string;
      backgroundColor: string;
    };

    const isLeft = settings.imagePosition !== 'right';

    return (
      <section
        className="py-12 px-6"
        style={{ backgroundColor: settings.backgroundColor }}
      >
        <div className={`max-w-6xl mx-auto grid md:grid-cols-2 gap-8 items-center`}>
          {isLeft && (
            <div className="aspect-video">
              {settings.image ? (
                <img src={settings.image} alt="" className="w-full h-full object-cover rounded-lg" />
              ) : (
                <div className="w-full h-full bg-muted rounded-lg flex items-center justify-center">
                  <span className="text-muted-foreground">Add Image</span>
                </div>
              )}
            </div>
          )}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">{settings.title}</h2>
            <p className="opacity-80">{settings.description}</p>
            {settings.buttonText && (
              <Button style={{ borderRadius: theme.borderRadius }}>{settings.buttonText}</Button>
            )}
          </div>
          {!isLeft && (
            <div className="aspect-video">
              {settings.image ? (
                <img src={settings.image} alt="" className="w-full h-full object-cover rounded-lg" />
              ) : (
                <div className="w-full h-full bg-muted rounded-lg flex items-center justify-center">
                  <span className="text-muted-foreground">Add Image</span>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    );
  };

  const renderTestimonials = () => {
    const settings = section.settings as {
      title: string;
      items: Array<{ name: string; role: string; content: string; avatar: string }>;
      layout: string;
      columns: number;
    };

    return (
      <section className="py-12 px-6 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          {settings.title && (
            <h2 className="text-2xl font-bold text-center mb-8">{settings.title}</h2>
          )}
          <div
            className="grid gap-6"
            style={{ gridTemplateColumns: `repeat(${settings.columns || 3}, 1fr)` }}
          >
            {(settings.items || []).map((item, idx) => (
              <div key={idx} className="bg-background p-6 rounded-lg shadow-sm">
                <p className="mb-4 text-muted-foreground">"{item.content}"</p>
                <div className="flex items-center gap-3">
                  {item.avatar ? (
                    <img src={item.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="font-medium">{item.name?.charAt(0)}</span>
                    </div>
                  )}
                  <div>
                    <div className="font-medium">{item.name}</div>
                    <div className="text-sm text-muted-foreground">{item.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  };

  const renderFAQ = () => {
    const settings = section.settings as {
      title: string;
      items?: Array<{ question: string; answer: string }>;
      faqs?: Array<{ question: string; answer: string }>;
      backgroundColor?: string;
      textColor?: string;
    };

    const faqItems = settings.faqs || settings.items || [];

    return (
      <section
        className="py-12 px-6"
        style={{ backgroundColor: settings.backgroundColor || '#ffffff', color: settings.textColor }}
      >
        <div className="max-w-3xl mx-auto">
          {settings.title && (
            <h2 className="text-2xl font-bold text-center mb-8">{settings.title}</h2>
          )}
          <Accordion type="single" collapsible className="w-full">
            {faqItems.map((item, idx) => (
              <AccordionItem key={idx} value={`faq-${idx}`}>
                <AccordionTrigger>{item.question}</AccordionTrigger>
                <AccordionContent>{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
    );
  };

  const renderVideo = () => {
    const settings = section.settings as {
      videoUrl?: string;
      youtubeUrl?: string;
      title?: string;
      autoplay: boolean;
      controls: boolean;
      loop: boolean;
      backgroundColor?: string;
      textColor?: string;
    };

    const videoUrl = settings.videoUrl || settings.youtubeUrl;

    if (!videoUrl) {
      return (
        <section className="py-8 px-6" style={{ backgroundColor: settings.backgroundColor }}>
          <div className="max-w-4xl mx-auto">
            {settings.title && (
              <h2 className="text-2xl font-bold text-center mb-6" style={{ color: settings.textColor }}>{settings.title}</h2>
            )}
            <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
              <span className="text-muted-foreground">Add Video URL or Embed Code</span>
            </div>
          </div>
        </section>
      );
    }

    // Check if it's raw iframe HTML first (Elementor-style)
    const iframeHtml = parseIframeHtml(videoUrl);
    if (iframeHtml) {
      return (
        <section className="py-8 px-6" style={{ backgroundColor: settings.backgroundColor }}>
          <div className="max-w-4xl mx-auto">
            {settings.title && (
              <h2 className="text-2xl font-bold text-center mb-6" style={{ color: settings.textColor }}>{settings.title}</h2>
            )}
            <div className="aspect-video relative w-full rounded-lg shadow-lg overflow-hidden">
              <div
                className="absolute inset-0"
                dangerouslySetInnerHTML={{ __html: iframeHtml }}
              />
            </div>
          </div>
        </section>
      );
    }

    let embedUrl = getEmbedUrl(videoUrl);

    // Facebook: prefer plugin iframe with the *original* public URL (Elementor-style)
    if (
      (videoUrl.includes("facebook.com") || videoUrl.includes("fb.watch")) &&
      !videoUrl.includes("facebook.com/plugins/video.php")
    ) {
      const absolute = /^https?:\/\//i.test(videoUrl)
        ? videoUrl
        : videoUrl.startsWith("//")
          ? `https:${videoUrl}`
          : `https://${videoUrl}`;
      embedUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(absolute)}&show_text=false&lazy=true`;
    }

    const isEmbed =
      embedUrl.includes("youtube.com/embed") ||
      embedUrl.includes("vimeo.com") ||
      embedUrl.includes("facebook.com/plugins/video.php");

    return (
      <section className="py-8 px-6" style={{ backgroundColor: settings.backgroundColor }}>
        <div className="max-w-4xl mx-auto">
          {settings.title && (
            <h2 className="text-2xl font-bold text-center mb-6" style={{ color: settings.textColor }}>{settings.title}</h2>
          )}
          <div className="aspect-video">
            {isEmbed ? (
              <iframe
                src={embedUrl}
                className="w-full h-full rounded-lg shadow-lg"
                scrolling="no"
                frameBorder={0}
                allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                allowFullScreen
                {...(!embedUrl.includes("facebook.com/plugins/video.php")
                  ? { referrerPolicy: "no-referrer-when-downgrade" as const }
                  : {})}
              />
            ) : (
              <video
                src={videoUrl}
                className="w-full h-full rounded-lg"
                autoPlay={settings.autoplay}
                controls={settings.controls !== false}
                loop={settings.loop}
              />
            )}
          </div>
        </div>
      </section>
    );
  };

  const renderCountdown = () => {
    const settings = section.settings as {
      title: string;
      endDate: string;
      backgroundColor: string;
      textColor: string;
    };

    return (
      <section
        className="py-8 px-6 text-center"
        style={{ backgroundColor: settings.backgroundColor, color: settings.textColor }}
      >
        <div className="max-w-4xl mx-auto">
          {settings.title && <h2 className="text-xl font-bold mb-4">{settings.title}</h2>}
          <div className="flex justify-center gap-4">
            {[
              { label: 'Days', value: countdown.days },
              { label: 'Hours', value: countdown.hours },
              { label: 'Minutes', value: countdown.minutes },
              { label: 'Seconds', value: countdown.seconds },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <div className="text-4xl font-bold">{String(item.value).padStart(2, '0')}</div>
                <div className="text-sm opacity-80">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  };

  const renderDivider = () => {
    const settings = section.settings as {
      style: string;
      color: string;
      thickness: string;
      width: string;
    };

    return (
      <div className="px-6">
        <hr
          style={{
            borderStyle: settings.style as 'solid' | 'dashed' | 'dotted',
            borderColor: settings.color,
            borderWidth: `${settings.thickness} 0 0 0`,
            width: settings.width,
            margin: '0 auto',
          }}
        />
      </div>
    );
  };

  const renderSpacer = () => {
    const settings = section.settings as { height: string };
    return <div style={{ height: settings.height }} />;
  };

  const renderHeroGradient = () => {
    const settings = section.settings as {
      badge: string;
      title: string;
      subtitle: string;
      description: string;
      features: Array<{ icon: string; text: string }>;
      buttonText: string;
      buttonLink: string;
      image?: string;
      heroImage?: string;
      gradientFrom: string;
      gradientTo: string;
      textColor: string;
    };

    const imageUrl = settings.heroImage || settings.image;

    return (
      <section
        className="py-16 px-6"
        style={{
          background: `linear-gradient(135deg, ${settings.gradientFrom || '#b8860b'}, ${settings.gradientTo || '#d4a520'})`,
          color: settings.textColor || '#ffffff',
        }}
      >
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-8 items-center">
          <div className="space-y-6">
            {settings.badge && (
              <span className="inline-block px-4 py-2 bg-white/20 rounded-full text-sm backdrop-blur-sm">
                🌴 {settings.badge}
              </span>
            )}
            <h1 className="text-3xl md:text-4xl font-bold">{settings.title}</h1>
            {settings.subtitle && <p className="text-xl opacity-90">{settings.subtitle}</p>}
            {settings.description && <p className="opacity-80">{settings.description}</p>}
            {settings.features?.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {settings.features.map((f, i) => (
                  <span key={i} className="px-4 py-2 bg-white/20 rounded-full text-sm backdrop-blur-sm">
                    {f.icon} {f.text}
                  </span>
                ))}
              </div>
            )}
            {settings.buttonText && (
              <Button size="lg" className="bg-white text-gray-900 hover:bg-white/90">
                {settings.buttonText}
              </Button>
            )}
          </div>
          <div className="flex justify-center">
            {imageUrl ? (
              <div className="bg-white/20 rounded-2xl p-4 backdrop-blur-sm">
                <img src={imageUrl} alt="" className="max-w-full h-auto rounded-lg" />
              </div>
            ) : (
              <div className="w-64 h-64 bg-white/20 rounded-2xl flex items-center justify-center">
                <span className="opacity-60">Add Image</span>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  };

  const renderProblemSection = () => {
    const settings = section.settings as {
      title: string;
      problems: Array<{ icon: string; title: string }>;
      footerText: string;
      backgroundColor: string;
      textColor: string;
    };

    return (
      <section className="py-12 px-6" style={{ backgroundColor: settings.backgroundColor, color: settings.textColor }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">{settings.title}</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {(settings.problems || []).map((p, i) => (
              <div key={i} className="flex items-center gap-4 p-4 bg-red-50 rounded-lg border border-red-100">
                <span className="text-3xl">{p.icon}</span>
                <span className="font-medium">{p.title}</span>
              </div>
            ))}
          </div>
          {settings.footerText && (
            <p className="text-center mt-8 text-lg font-medium text-green-600">{settings.footerText}</p>
          )}
        </div>
      </section>
    );
  };

  const renderBenefitsGrid = () => {
    const settings = section.settings as {
      title: string;
      benefits: Array<{ icon: string; title: string; description: string }>;
      columns: number;
      backgroundColor: string;
      textColor: string;
    };

    return (
      <section className="py-12 px-6" style={{ backgroundColor: settings.backgroundColor, color: settings.textColor }}>
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">{settings.title}</h2>
          <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${settings.columns || 3}, 1fr)` }}>
            {(settings.benefits || []).map((b, i) => (
              <div key={i} className="text-center p-6 bg-white rounded-xl shadow-sm">
                <div className="text-4xl mb-3">{b.icon}</div>
                <h3 className="font-bold mb-2">{b.title}</h3>
                <p className="text-sm opacity-70">{b.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  };

  const renderTrustBadges = () => {
    const settings = section.settings as {
      title: string;
      badges: Array<{ title: string; description: string }>;
      checkColor: string;
      backgroundColor: string;
      textColor: string;
    };

    return (
      <section className="py-12 px-6" style={{ backgroundColor: settings.backgroundColor, color: settings.textColor }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">{settings.title}</h2>
          <div className="space-y-4">
            {(settings.badges || []).map((b, i) => (
              <div key={i} className="flex items-start gap-4 p-4 bg-green-50 rounded-lg">
                <span className="text-2xl" style={{ color: settings.checkColor }}>✓</span>
                <div>
                  <h3 className="font-bold">{b.title}</h3>
                  <p className="text-sm opacity-70">{b.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  };

  const renderGuaranteeSection = () => {
    const settings = section.settings as {
      title: string;
      guarantees: Array<{ icon: string; title: string; subtitle: string }>;
      buttonText: string;
      backgroundColor: string;
      accentColor: string;
    };

    return (
      <section className="py-12 px-6" style={{ backgroundColor: settings.backgroundColor }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">{settings.title}</h2>
          <div className="flex flex-wrap justify-center gap-6 mb-8">
            {(settings.guarantees || []).map((g, i) => (
              <div key={i} className="text-center p-4 bg-white rounded-xl shadow-sm min-w-[140px]">
                <div className="text-3xl mb-2">{g.icon}</div>
                <h3 className="font-bold text-sm">{g.title}</h3>
                <p className="text-xs opacity-70">{g.subtitle}</p>
              </div>
            ))}
          </div>
          {settings.buttonText && (
            <div className="text-center">
              <Button size="lg" style={{ backgroundColor: settings.accentColor, color: '#fff' }}>
                {settings.buttonText}
              </Button>
            </div>
          )}
        </div>
      </section>
    );
  };

  switch (section.type) {
    case 'hero-product':
      return renderHeroProduct();
    case 'hero-gradient':
      return renderHeroGradient();
    case 'problem-section':
      return renderProblemSection();
    case 'benefits-grid':
      return renderBenefitsGrid();
    case 'trust-badges':
      return renderTrustBadges();
    case 'guarantee-section':
      return renderGuaranteeSection();
    case 'feature-badges':
      return renderFeatureBadges();
    case 'text-block':
      return renderTextBlock();
    case 'checkout-form':
      return renderCheckoutForm();
    case 'cta-banner':
      return renderCTABanner();
    case 'image-gallery':
      return renderImageGallery();
    case 'image-text':
      return renderImageText();
    case 'testimonials':
      return renderTestimonials();
    case 'faq':
    case 'faq-accordion':
      return renderFAQ();
    case 'video':
    case 'youtube-video':
      return renderVideo();
    case 'countdown':
      return renderCountdown();
    case 'divider':
      return renderDivider();
    case 'spacer':
      return renderSpacer();
    default:
      return <div className="p-4 text-muted-foreground">Unknown section type</div>;
  }
};
