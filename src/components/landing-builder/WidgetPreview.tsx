import { useState, useEffect } from "react";
import { Widget, ThemeSettings } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getEmbedUrl, parseIframeHtml } from "@/lib/videoEmbed";

interface WidgetPreviewProps {
  widget: Widget;
  theme: ThemeSettings;
}

export const WidgetPreview = ({ widget, theme }: WidgetPreviewProps) => {
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const settings = widget.settings;

  useEffect(() => {
    if (widget.type !== 'countdown') return;
    const endDate = settings.endDate as string;
    if (!endDate) return;

    const timer = setInterval(() => {
      const end = new Date(endDate).getTime();
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
  }, [widget.type, settings.endDate]);

  switch (widget.type) {
    case 'heading': {
      const Tag = (settings.tag as 'h1' | 'h2' | 'h3' | 'h4') || 'h2';
      const sizes = { h1: 'text-4xl', h2: 'text-3xl', h3: 'text-2xl', h4: 'text-xl' };
      return (
        <Tag
          className={`font-bold ${sizes[Tag]}`}
          style={{
            textAlign: (settings.alignment as 'left' | 'center' | 'right') || 'center',
            color: (settings.color as string) || 'inherit',
            fontSize: (settings.fontSize as string) || undefined,
          }}
        >
          {(settings.text as string) || 'Heading'}
        </Tag>
      );
    }

    case 'text':
      return (
        <div
          className="whitespace-pre-wrap"
          style={{
            textAlign: (settings.alignment as 'left' | 'center' | 'right') || 'left',
            color: (settings.color as string) || 'inherit',
            fontSize: (settings.fontSize as string) || '16px',
          }}
        >
          {(settings.content as string) || 'Enter your text...'}
        </div>
      );

    case 'image': {
      const src = settings.src as string;
      const img = src ? (
        <img
          src={src}
          alt={(settings.alt as string) || ''}
          style={{
            width: (settings.width as string) || '100%',
            borderRadius: (settings.borderRadius as string) || theme.borderRadius,
          }}
          className="object-cover"
        />
      ) : (
        <div className="bg-muted rounded-lg aspect-video flex items-center justify-center text-muted-foreground">
          Add Image URL
        </div>
      );
      return (
        <div style={{ textAlign: (settings.alignment as 'left' | 'center' | 'right') || 'center' }}>
          {settings.link ? <a href={settings.link as string}>{img}</a> : img}
        </div>
      );
    }

    case 'button': {
      const style = settings.style as string || 'filled';
      const size = settings.size as string || 'md';
      const sizeClass = { sm: 'px-3 py-1 text-sm', md: 'px-4 py-2', lg: 'px-6 py-3 text-lg' }[size] || 'px-4 py-2';
      return (
        <div style={{ textAlign: (settings.alignment as 'left' | 'center' | 'right') || 'center' }}>
          <button
            className={`rounded font-medium transition-colors ${sizeClass} ${settings.fullWidth ? 'w-full' : ''}`}
            style={{
              backgroundColor: style === 'filled' ? ((settings.backgroundColor as string) || theme.primaryColor) : 'transparent',
              color: style === 'filled' ? ((settings.textColor as string) || '#fff') : ((settings.backgroundColor as string) || theme.primaryColor),
              border: style === 'outline' ? `2px solid ${(settings.backgroundColor as string) || theme.primaryColor}` : 'none',
              borderRadius: theme.borderRadius,
            }}
          >
            {(settings.text as string) || 'Click Here'}
          </button>
        </div>
      );
    }

    case 'spacer':
      return <div style={{ height: (settings.height as string) || '40px' }} />;

    case 'divider':
      return (
        <hr
          style={{
            borderStyle: (settings.style as string) || 'solid',
            borderColor: (settings.color as string) || '#e5e7eb',
            borderWidth: (settings.thickness as string) || '1px',
            width: (settings.width as string) || '100%',
          }}
        />
      );

    case 'icon-box':
      return (
        <div
          className={`${(settings.iconPosition as string) === 'left' ? 'flex items-start gap-4' : 'text-center'}`}
          style={{ textAlign: (settings.alignment as 'left' | 'center' | 'right') || 'center' }}
        >
          <div className="text-4xl mb-2">{(settings.icon as string) || '⭐'}</div>
          <div>
            <h4 className="font-semibold text-lg">{(settings.title as string) || 'Feature'}</h4>
            <p className="text-muted-foreground text-sm">{(settings.description as string) || ''}</p>
          </div>
        </div>
      );

    case 'form':
      return (
        <div className="p-4 rounded-lg" style={{ backgroundColor: (settings.backgroundColor as string) || '#f9fafb' }}>
          <h3 className="text-xl font-bold text-center mb-4">{(settings.title as string) || 'Order Form'}</h3>
          <div className="space-y-3">
            <Input placeholder="আপনার নাম" />
            <Input placeholder="মোবাইল নম্বর" type="tel" />
            <Textarea placeholder="সম্পূর্ণ ঠিকানা" rows={3} />
            <Button
              className="w-full"
              style={{ backgroundColor: (settings.accentColor as string) || theme.accentColor, color: '#fff' }}
            >
              {(settings.buttonText as string) || 'অর্ডার কনফার্ম করুন'}
            </Button>
          </div>
        </div>
      );

    case 'price-box':
      return (
        <div className="text-center p-6 border rounded-lg">
          <h3 className="text-xl font-bold mb-2">{(settings.title as string) || 'Product'}</h3>
          <div className="flex items-baseline justify-center gap-2 mb-4">
            <span className="text-3xl font-bold" style={{ color: theme.accentColor }}>
              {(settings.currency as string) || '৳'}{(settings.price as string) || '0'}
            </span>
            {settings.originalPrice && (
              <span className="text-lg line-through text-muted-foreground">
                {(settings.currency as string) || '৳'}{String(settings.originalPrice)}
              </span>
            )}
          </div>
          <Button style={{ backgroundColor: theme.primaryColor, borderRadius: theme.borderRadius }}>
            {(settings.buttonText as string) || 'Order Now'}
          </Button>
        </div>
      );

    case 'countdown':
      return (
        <div
          className="py-6 px-4 text-center rounded-lg"
          style={{ backgroundColor: (settings.backgroundColor as string) || '#ef4444', color: (settings.textColor as string) || '#fff' }}
        >
          <h4 className="text-lg font-semibold mb-3">{(settings.title as string) || 'Offer Ends In'}</h4>
          <div className="flex justify-center gap-4">
            {[{ v: countdown.days, l: 'Days' }, { v: countdown.hours, l: 'Hours' }, { v: countdown.minutes, l: 'Min' }, { v: countdown.seconds, l: 'Sec' }].map((t, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl font-bold">{String(t.v).padStart(2, '0')}</div>
                <div className="text-xs opacity-80">{t.l}</div>
              </div>
            ))}
          </div>
        </div>
      );

    case 'video': {
      const url = (settings.url as string) || '';
      if (!url) {
        return (
          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
            Add Video URL or Embed Code
          </div>
        );
      }

      // Check if it's raw iframe HTML first (Elementor-style)
      const iframeHtml = parseIframeHtml(url);
      if (iframeHtml) {
        return (
          <div className="aspect-video relative w-full rounded-lg overflow-hidden">
            <div
              className="absolute inset-0"
              dangerouslySetInnerHTML={{ __html: iframeHtml }}
            />
          </div>
        );
      }

      let embedUrl = getEmbedUrl(url);

      // Facebook: prefer plugin iframe with the *original* public URL (Elementor-style)
      if (
        (url.includes("facebook.com") || url.includes("fb.watch")) &&
        !url.includes("facebook.com/plugins/video.php")
      ) {
        const absolute = /^https?:\/\//i.test(url)
          ? url
          : url.startsWith("//")
            ? `https:${url}`
            : `https://${url}`;
        embedUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(absolute)}&show_text=false&lazy=true`;
      }

      const isEmbed =
        embedUrl.includes("youtube.com/embed") ||
        embedUrl.includes("vimeo.com") ||
        embedUrl.includes("facebook.com/plugins/video.php");

      return (
        <div className="aspect-video">
          {isEmbed ? (
            <iframe
              src={embedUrl}
              className="w-full h-full rounded-lg"
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
              src={url}
              controls={settings.controls as boolean}
              autoPlay={settings.autoplay as boolean}
              loop={settings.loop as boolean}
              className="w-full rounded-lg"
            />
          )}
        </div>
      );
    }

    case 'testimonial':
      return (
        <div className="bg-muted/30 p-4 rounded-lg">
          <p className="mb-3 italic">"{(settings.content as string) || 'Great product!'}"</p>
          <div className="flex items-center gap-3">
            {settings.avatar ? (
              <img src={settings.avatar as string} className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-medium">
                {((settings.name as string) || 'C').charAt(0)}
              </div>
            )}
            <div>
              <div className="font-medium">{(settings.name as string) || 'Customer'}</div>
              <div className="text-sm text-muted-foreground">{(settings.role as string) || ''}</div>
            </div>
          </div>
        </div>
      );

    case 'faq-item':
      return (
        <details className="border rounded-lg">
          <summary className="p-3 font-medium cursor-pointer">{(settings.question as string) || 'Question?'}</summary>
          <div className="p-3 pt-0 text-muted-foreground">{(settings.answer as string) || 'Answer'}</div>
        </details>
      );

    case 'gallery': {
      const images = (settings.images as string[]) || [];
      return (
        <div className="grid" style={{ gridTemplateColumns: `repeat(${settings.columns || 3}, 1fr)`, gap: (settings.gap as string) || '8px' }}>
          {images.map((img, i) => (
            <img key={i} src={img} className="w-full aspect-square object-cover rounded" />
          ))}
        </div>
      );
    }

    case 'html':
      return <div dangerouslySetInnerHTML={{ __html: (settings.code as string) || '' }} />;

    default:
      return <div className="p-4 bg-muted rounded text-muted-foreground text-sm">Unknown widget</div>;
  }
};
