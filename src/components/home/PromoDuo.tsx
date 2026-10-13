import { ArrowRight } from 'lucide-react';
import { Parallax, Reveal } from '@/components/motion';
import type { Promo } from './content';

export function PromoDuo({ promos, onOpen }: { promos: Promo[]; onOpen: (link: string) => void }) {
  return (
    <section className="pb-4 sm:pb-6">
      <div className="shell grid gap-5 lg:grid-cols-2">
        {promos.map((promo, index) => (
          <Reveal key={index} direction={index === 0 ? 'right' : 'left'} delay={index * 0.1}>
            <PromoCard promo={promo} index={index} onOpen={() => onOpen(promo.link || '/products')} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function PromoCard({ promo, index, onOpen }: { promo: Promo; index: number; onOpen: () => void }) {
  const hasImage = Boolean(promo.image || promo.mobileImage);
  const tone = index === 0 ? 'from-[#f3e7d6] via-[#eedcc5] to-[#ddc4a7]' : 'from-[#f5dfe1] via-[#f2d1d7] to-[#dfabb8]';

  return (
    <button
      type="button"
      onClick={onOpen}
      className={'group relative block min-h-[250px] w-full overflow-hidden rounded-[1.75rem] bg-gradient-to-r p-7 text-left shadow-[0_10px_30px_-18px_rgba(74,46,39,0.4)] transition-shadow duration-500 hover:shadow-[0_30px_50px_-24px_rgba(110,25,50,0.5)] sm:min-h-[290px] sm:p-9 ' + tone}
    >
      {hasImage && (
        <Parallax distance={50} className="absolute inset-y-[-25px] right-0 w-[48%]">
          <picture className="block h-full w-full">
            {promo.mobileImage && <source media="(max-width: 639px)" srcSet={promo.mobileImage} />}
            <img src={promo.image || promo.mobileImage} alt="" className="h-full w-full object-cover object-[50%_30%] transition-transform duration-[900ms] ease-out group-hover:scale-110" loading="lazy" />
          </picture>
        </Parallax>
      )}

      {/* Light sweep on hover */}
      <span className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-1000 ease-out group-hover:translate-x-[420%]" />
      {/* Decorative ring */}
      <span className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full border-[24px] border-white/25 transition-transform duration-700 group-hover:scale-125" />

      <span className="relative z-10 block max-w-[260px]">
        <small className="text-[10px] font-bold tracking-[0.16em] text-[#7e655a]">{promo.tagline || 'MODESSI COLLECTION'}</small>
        <strong className="mt-2 block text-2xl font-semibold leading-[1.12] tracking-[-0.03em] text-[#45312c] sm:text-[30px]">{promo.title || 'নতুন একটি সুন্দর গল্প'}</strong>
        <span className="mt-3 block text-xs leading-5 text-[#66524a]">{promo.subtitle || 'আপনার পছন্দের জন্য বাছাই করা নতুন ডিজাইন।'}</span>
        <span className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-[#4d332b] px-5 py-2.5 text-xs font-bold text-white transition-all duration-300 group-hover:gap-3 group-hover:bg-brand">
          {promo.buttonText || 'দেখুন'} <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </span>
    </button>
  );
}
