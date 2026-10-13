import type { ReactNode } from 'react';
import { m, useReducedMotion } from 'framer-motion';
import { Heart, ShieldCheck, Truck } from 'lucide-react';
import { EASE_OUT } from '@/components/motion';
import heroSlide from '@/assets/hero-slide-1.png';

/**
 * Split layout for the sign-in / sign-up / password pages: a brand panel on
 * desktop, the form card alone on phones.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-brand-blush via-surface to-surface-warm py-10 sm:py-14">
      <div className="pointer-events-none absolute -left-24 top-10 h-80 w-80 rounded-full bg-brand/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-gold/15 blur-3xl" />

      <div className="shell relative grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        {/* Brand panel */}
        <m.div
          initial={reduce ? false : { opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: EASE_OUT }}
          className="relative hidden h-[600px] overflow-hidden rounded-[2rem] lg:block"
        >
          <img src={heroSlide} alt="" className="absolute inset-0 h-full w-full object-cover animate-ken-burns" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#241719]/90 via-[#241719]/40 to-transparent" />
          <div className="absolute -right-16 -top-16 h-64 w-64 animate-spin-slow rounded-full border-[28px] border-dashed border-white/15" />
          <div className="absolute inset-x-0 bottom-0 p-10 text-white">
            <p className="text-[11px] font-bold tracking-[0.17em] text-[#f4c4d0]">MODESSI</p>
            <h2 className="mt-3 text-4xl font-semibold leading-tight tracking-[-0.03em]">নিজের মতো সাজুন, প্রতিদিন</h2>
            <div className="mt-8 grid grid-cols-3 gap-3 border-t border-white/20 pt-6 text-xs text-white/85">
              {[
                { icon: Heart, label: 'নির্বাচিত ডিজাইন' },
                { icon: Truck, label: 'সারা দেশে ডেলিভারি' },
                { icon: ShieldCheck, label: 'মানের নিশ্চয়তা' },
              ].map(({ icon: Icon, label }, index) => (
                <m.span
                  key={label}
                  initial={reduce ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + index * 0.12 }}
                  className="flex flex-col gap-2"
                >
                  <Icon className="h-5 w-5 text-[#f4c4d0]" />
                  {label}
                </m.span>
              ))}
            </div>
          </div>
        </m.div>

        {/* Form */}
        <div className="mx-auto w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
