import type { LucideIcon } from 'lucide-react';
import { ArrowRight, Gift, MoveUpRight, RotateCcw, ShieldCheck, Star, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { m, useReducedMotion } from 'framer-motion';
import { toast } from 'sonner';
import { Marquee, Parallax, Reveal, EASE_OUT } from '@/components/motion';
import { SectionHeading } from './SectionHeading';
import type { Feature, Testimonial } from './content';

function iconFor(name?: string): LucideIcon {
  const icons: Record<string, LucideIcon> = { Gift, RotateCcw, Truck, Shield: ShieldCheck, ShieldCheck };
  return icons[name || ''] || ShieldCheck;
}

/**
 * Uneven photo grid: widths alternate 5/7 then 7/5 on a 12-column grid, each card
 * a product photo with the promise in a pill and a round arrow, sliding up into view.
 */
export function TrustSection({ tagline, title, features, images }: { tagline: string; title: string; features: Feature[]; images: string[] }) {
  const reduce = useReducedMotion();
  const last = features.length - 1;

  const span = (index: number) => {
    if (index === 0) return 'sm:col-span-5';
    if (index === 1) return 'sm:col-span-7';
    if (index === last - 1) return 'sm:col-span-7';
    if (index === last) return 'sm:col-span-5';
    return 'sm:col-span-6';
  };

  return (
    <section className="bg-white py-14 sm:py-20">
      <div className="shell">
        <SectionHeading eyebrow={tagline} title={title} align="center" />
        <div className="grid grid-cols-12 gap-4">
          {features.map((feature, index) => {
            const Icon = iconFor(feature.icon);
            const image = images.length ? images[index % images.length] : undefined;
            return (
              <m.article
                key={(feature.title || 'feature') + index}
                initial={reduce ? false : { y: 50, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                transition={{ ease: 'easeOut', duration: 0.6 }}
                viewport={{ once: false, amount: 0.25 }}
                className={'group relative col-span-12 h-[240px] overflow-hidden rounded-3xl sm:h-[300px] lg:h-[340px] ' + span(index)}
              >
                <Link to="/about" aria-label={feature.title} className="absolute inset-0">
                  {image ? (
                    <img src={image} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105" />
                  ) : (
                    <span className="grid h-full w-full place-items-center bg-gradient-to-br from-brand-blush to-surface-sand">
                      <Icon className="h-16 w-16 text-brand-soft" />
                    </span>
                  )}
                  <span className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                </Link>

                <div className="pointer-events-none absolute bottom-0 flex w-full items-end justify-between gap-3 p-4 lg:bottom-2">
                  <div className="rounded-2xl bg-ink/90 px-4 py-2.5 text-white backdrop-blur-sm">
                    <h3 className="flex items-center gap-2 text-sm font-semibold lg:text-lg">
                      <Icon className="h-4 w-4 shrink-0 text-[#f4c4d0] lg:h-5 lg:w-5" />
                      {feature.title}
                    </h3>
                    {feature.desc && <p className="mt-0.5 text-[11px] text-white/70 lg:text-xs">{feature.desc}</p>}
                  </div>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-white transition-transform duration-500 group-hover:rotate-45 lg:h-12 lg:w-12">
                    <MoveUpRight className="h-4 w-4 lg:h-5 lg:w-5" />
                  </span>
                </div>
              </m.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function StorySection({ images }: { images: string[] }) {
  const reduce = useReducedMotion();
  const [first, second, third] = images;
  const lines = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE_OUT } } };

  return (
    <section className="overflow-hidden bg-surface py-14 sm:py-20">
      <div className="shell grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
        <article className="relative overflow-hidden rounded-[2rem] bg-[#7f1c3a] px-7 py-12 text-white sm:px-12 sm:py-16">
          <div className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 animate-spin-slow rounded-full border-[34px] border-dashed border-white/10" />
          <div className="pointer-events-none absolute -bottom-28 -left-10 h-64 w-64 rounded-full border-[22px] border-white/5" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_120%,hsl(var(--accent)/0.25),transparent_55%)]" />
          <m.div
            className="relative max-w-xl"
            initial={reduce ? false : 'hidden'}
            whileInView="show"
            viewport={{ once: true, amount: 0.4 }}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.14 } } }}
          >
            <m.p variants={lines} className="text-[11px] font-bold tracking-[0.16em] text-[#f6c8d4]">STORY OF MODESSI</m.p>
            <m.h2 variants={lines} className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.025em] sm:text-[40px]">পোশাকের চেয়েও বেশি, নিজের একটি অনুভূতি</m.h2>
            <m.p variants={lines} className="mt-5 max-w-lg text-sm leading-7 text-white/80">বাংলাদেশী নারীর প্রতিদিনের আরাম, আত্মবিশ্বাস এবং নিজস্ব স্টাইলকে ঘিরেই আমাদের পথচলা। যত্নে বাছাই করা প্রতিটি নকশা আপনাকে নিজের মতো করে তুলে ধরে।</m.p>
            <m.div variants={lines}>
              <Link to="/about" className="group mt-8 inline-flex items-center gap-2 rounded-full border border-white/60 px-6 py-3 text-xs font-bold transition-all hover:gap-3 hover:bg-white hover:text-[#7f1c3a]">
                আমাদের গল্প জানুন <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </m.div>
          </m.div>
        </article>

        {first && (
          <div className="relative hidden h-[460px] lg:block">
            <Parallax distance={90} className="absolute left-0 top-6 h-[340px] w-[58%]">
              <img src={first} alt="" loading="lazy" className="h-full w-full rounded-[1.75rem] object-cover shadow-[0_30px_50px_-25px_rgba(74,30,40,0.55)]" />
            </Parallax>
            {second && (
              <Parallax distance={-120} className="absolute right-0 top-0 h-[260px] w-[46%]">
                <img src={second} alt="" loading="lazy" className="h-full w-full rounded-[1.75rem] object-cover shadow-[0_30px_50px_-25px_rgba(74,30,40,0.55)]" />
              </Parallax>
            )}
            {third && (
              <Parallax distance={60} className="absolute bottom-0 right-[8%] h-[180px] w-[38%]">
                <img src={third} alt="" loading="lazy" className="h-full w-full rounded-[1.75rem] border-4 border-surface object-cover shadow-[0_30px_50px_-25px_rgba(74,30,40,0.55)]" />
              </Parallax>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export function TestimonialMarquee({ tagline, title, items }: { tagline: string; title: string; items: Testimonial[] }) {
  // Repeat short lists so the track is always wider than the screen.
  const track = items.length < 4 ? [...items, ...items, ...items] : items;

  return (
    <section className="overflow-hidden bg-surface-warm py-14 sm:py-20">
      <div className="shell">
        <SectionHeading eyebrow={tagline} title={title} align="center" />
      </div>
      <Reveal>
        <Marquee duration={Math.max(28, track.length * 9)} className="[mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
          {track.map((item, index) => <TestimonialCard key={(item.name || '') + index} item={item} />)}
        </Marquee>
      </Reveal>
    </section>
  );
}

function TestimonialCard({ item }: { item: Testimonial }) {
  return (
    <article className="mx-2.5 w-[290px] shrink-0 rounded-3xl border border-line bg-white p-6 shadow-[0_8px_24px_-14px_rgba(70,46,41,0.25)] transition-transform duration-300 hover:-translate-y-1 sm:w-[340px]">
      <div className="flex items-center justify-between">
        <div className="flex gap-0.5 text-gold">
          {Array.from({ length: 5 }).map((_, index) => <Star key={index} className={'h-3.5 w-3.5 ' + (index < (item.rating || 5) ? 'fill-current' : '')} />)}
        </div>
        <span className="font-serif text-4xl leading-none text-brand/15">“</span>
      </div>
      <p className="mt-3 min-h-[72px] whitespace-normal text-sm leading-6 text-ink-soft">“{item.text}”</p>
      <div className="mt-5 flex items-center gap-3 border-t border-line pt-4">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-brand to-brand-soft text-sm font-bold text-white">{item.name?.slice(0, 1)}</span>
        <span>
          <strong className="block text-xs text-ink">{item.name}</strong>
          <small className="text-[11px] text-ink-muted">{item.location}</small>
        </span>
      </div>
    </article>
  );
}

export function Newsletter() {
  return (
    <section className="animate-gradient-pan bg-[linear-gradient(120deg,#f0e7df,#f7dfe5,#f3e7d6,#f0e7df)] bg-[length:300%_300%] py-14 sm:py-16">
      <Reveal className="shell mx-auto max-w-2xl text-center" scale>
        <p className="text-[11px] font-bold tracking-[0.14em] text-[#994057]">MODESSI LETTER</p>
        <h2 className="mt-2 text-xl font-semibold text-[#493a36] sm:text-2xl">সর্বশেষ কালেকশন ও অফার আপডেট পেতে সাবস্ক্রাইব করুন</h2>
        <form
          className="mx-auto mt-6 flex max-w-md rounded-full bg-white p-1.5 shadow-[0_6px_20px_rgba(89,57,44,0.08)] ring-1 ring-transparent transition-all duration-500 focus-within:max-w-xl focus-within:shadow-[0_18px_40px_-16px_rgba(110,25,50,0.4)] focus-within:ring-brand/30"
          onSubmit={(event) => { event.preventDefault(); toast.success('আপনার আগ্রহ নথিভুক্ত করা হয়েছে'); }}
        >
          <input required aria-label="ইমেইল বা ফোন নম্বর" placeholder="আপনার ইমেইল বা ফোন নম্বর" className="min-w-0 flex-1 rounded-full bg-transparent px-4 text-xs outline-none placeholder:text-[#a99a92] sm:text-sm" />
          <button type="submit" className="group inline-flex shrink-0 items-center gap-1 rounded-full bg-brand px-5 py-3 text-xs font-bold text-white transition-colors hover:bg-brand-deep sm:px-7">
            সাবস্ক্রাইব <ArrowRight className="hidden h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 sm:block" />
          </button>
        </form>
      </Reveal>
    </section>
  );
}
