import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, m, useReducedMotion, useScroll, useTransform, type PanInfo } from 'framer-motion';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { Magnetic, EASE_OUT, useCanHover } from '@/components/motion';
import { cn } from '@/lib/utils';
import { fallbackHeroImage, type HeroSlide } from './content';

const SLIDE_MS = 3500;

type HomeHeroProps = {
  slides: HeroSlide[];
  onExplore: (link: string) => void;
  /** Hold a placeholder until the configured slides arrive, so the built-in
      default slide never flashes up and animates away. */
  loading?: boolean;
};

export function HomeHero({ slides, onExplore, loading = false }: HomeHeroProps) {
  const reduce = useReducedMotion();
  const canHover = useCanHover();
  const ref = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [paused, setPaused] = useState(false);

  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const imageY = useTransform(scrollYProgress, [0, 1], ['0%', '18%']);
  const copyY = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  const copyOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const parallax = !reduce && canHover;

  const count = slides.length;
  const current = slides[index] || slides[0];

  const go = useCallback((next: number, dir: number) => {
    setDirection(dir);
    setIndex(((next % count) + count) % count);
  }, [count]);
  const next = useCallback(() => go(index + 1, 1), [go, index]);
  const previous = useCallback(() => go(index - 1, -1), [go, index]);

  useEffect(() => {
    if (index >= count) setIndex(0);
  }, [index, count]);

  useEffect(() => {
    if (count < 2 || reduce || paused) return;
    const timer = window.setTimeout(next, SLIDE_MS);
    return () => window.clearTimeout(timer);
  }, [count, reduce, paused, next, index]);

  const onPanEnd = (_: unknown, info: PanInfo) => {
    if (count < 2) return;
    if (info.offset.x < -60) next();
    else if (info.offset.x > 60) previous();
  };

  // Every hero image is a banner surface. Older slides only populated `image`,
  // so treating that field as a campaign image keeps it full-bleed.
  const desktopImage = current.desktopImage || current.image || fallbackHeroImage;
  const mobileImage = current.mobileImage || desktopImage;
  const words = current.title.split(' ');

  // The section itself stays mounted through loading: useScroll binds to the
  // element `ref` holds at mount, so swapping in a new section would leave the
  // parallax tracking a detached node (stuck at the end of its range).
  return (
    <m.section
      ref={ref}
      onPanEnd={onPanEnd}
      onHoverStart={() => setPaused(true)}
      onHoverEnd={() => setPaused(false)}
      style={{ touchAction: 'pan-y' }}
      className="relative isolate min-h-[620px] overflow-hidden bg-[#342026] sm:min-h-[700px] lg:min-h-[800px]"
      aria-roledescription="carousel"
      aria-busy={loading}
    >
      {loading ? (
        <>
          <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-[#241719] via-[#3d2a2f] to-[#2b1c20]" />
          <div className="shell relative flex min-h-[620px] flex-col justify-center gap-4 sm:min-h-[700px] lg:min-h-[800px]">
            <div className="h-6 w-40 rounded-full bg-white/10" />
            <div className="h-12 w-3/4 max-w-[480px] rounded-xl bg-white/10" />
            <div className="h-4 w-2/3 max-w-[380px] rounded bg-white/10" />
            <div className="mt-4 h-12 w-40 rounded-full bg-white/15" />
          </div>
        </>
      ) : (
      <>
      {/* Slides */}
      <AnimatePresence initial={false} custom={direction}>
        <m.div
          key={current.id + index}
          custom={direction}
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.1, ease: EASE_OUT }}
          className="absolute inset-0"
        >
          <m.div className="absolute inset-0" style={parallax ? { y: imageY } : undefined}>
            <picture className="absolute inset-0">
              <source media="(max-width: 639px)" srcSet={mobileImage} />
              <img
                src={desktopImage}
                alt={current.title}
                className={cn('h-full w-full object-cover', !reduce && 'animate-ken-burns')}
                fetchPriority={index === 0 ? 'high' : 'auto'}
              />
            </picture>
          </m.div>
        </m.div>
      </AnimatePresence>

      {/* Legibility gradients */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#241719]/95 via-[#241719]/55 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#241719]/70 to-transparent" />

      {/* Copy */}
      <m.div className="shell relative z-10 flex min-h-[620px] items-center py-14 sm:min-h-[700px] lg:min-h-[800px]" style={parallax ? { y: copyY, opacity: copyOpacity } : undefined}>
        <AnimatePresence mode="wait">
          <m.div
            key={current.id + index}
            className="max-w-[540px]"
            initial="hidden"
            animate="show"
            exit="exit"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: reduce ? 0 : 0.06, delayChildren: 0.15 } },
              exit: { opacity: 0, y: -12, transition: { duration: 0.25 } },
            }}
          >
            <m.p variants={fadeUp} className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-bold tracking-[0.17em] text-[#f4c4d0] backdrop-blur-sm">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold" />
              {current.eyebrow}
            </m.p>
            <h1 className="text-shadow-hero mt-4 text-[38px] font-semibold leading-[1.13] tracking-[-0.04em] text-white sm:text-5xl lg:text-[60px]">
              {words.map((word, wordIndex) => (
                <span key={wordIndex} className="inline-block overflow-hidden pb-1 align-bottom">
                  <m.span variants={wordUp} className="inline-block">
                    {word}{wordIndex < words.length - 1 ? ' ' : ''}
                  </m.span>
                </span>
              ))}
            </h1>
            <m.p variants={fadeUp} className="text-shadow-hero mt-5 max-w-md text-sm leading-6 text-white/90 sm:text-[15px]">
              {current.subtitle}
            </m.p>
            <m.div variants={fadeUp} className="mt-8">
              <Magnetic className="inline-block">
                <button
                  type="button"
                  onClick={() => onExplore(current.link)}
                  className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-white px-6 py-3.5 text-sm font-bold text-brand-deep shadow-[0_14px_30px_rgba(0,0,0,0.25)] transition-colors hover:bg-[#f9e8ec]"
                >
                  এখনই দেখুন
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </button>
              </Magnetic>
            </m.div>
            <m.div variants={fadeUp} className="text-shadow-hero mt-10 grid max-w-sm grid-cols-3 gap-3 border-t border-white/20 pt-5 text-xs text-white/90">
              <span><strong className="block text-sm text-white">নির্বাচিত</strong> ডিজাইন</span>
              <span><strong className="block text-sm text-white">সারা দেশ</strong> ডেলিভারি</span>
              <span><strong className="block text-sm text-white">সহজ</strong> এক্সচেঞ্জ</span>
            </m.div>
          </m.div>
        </AnimatePresence>
      </m.div>

      {/* Controls */}
      {count > 1 && (
        <>
          <button type="button" aria-label="আগের স্লাইড" onClick={previous} className="absolute left-4 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/30 bg-white/10 text-white backdrop-blur-md transition-all hover:scale-110 hover:bg-white hover:text-brand sm:grid">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button type="button" aria-label="পরের স্লাইড" onClick={next} className="absolute right-4 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/30 bg-white/10 text-white backdrop-blur-md transition-all hover:scale-110 hover:bg-white hover:text-brand sm:grid">
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2">
            {slides.map((slide, value) => (
              <button
                key={slide.id + value}
                type="button"
                aria-label={(value + 1) + ' নম্বর স্লাইড'}
                aria-current={value === index}
                onClick={() => go(value, value > index ? 1 : -1)}
                className={cn('relative h-1.5 overflow-hidden rounded-full bg-white/35 transition-all duration-500', value === index ? 'w-12' : 'w-1.5 hover:bg-white/60')}
              >
                {value === index && (
                  <m.span
                    key={index + (paused ? 'p' : 'r')}
                    className="absolute inset-y-0 left-0 rounded-full bg-white"
                    initial={{ width: reduce || paused ? '100%' : '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: reduce || paused ? 0 : SLIDE_MS / 1000, ease: 'linear' }}
                  />
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Scroll cue */}
      {!reduce && (
        <m.div
          aria-hidden="true"
          className="absolute bottom-6 right-6 z-20 hidden h-10 w-6 justify-center rounded-full border border-white/40 pt-2 lg:flex"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
        >
          <m.span className="h-2 w-1 rounded-full bg-white" animate={{ y: [0, 10, 0], opacity: [1, 0.2, 1] }} transition={{ duration: 1.8, repeat: Infinity }} />
        </m.div>
      )}
      </>
      )}
    </m.section>
  );
}

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE_OUT } },
};

const wordUp = {
  hidden: { y: '110%' },
  show: { y: '0%', transition: { duration: 0.8, ease: EASE_OUT } },
};
