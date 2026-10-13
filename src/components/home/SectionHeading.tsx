import { ArrowRight } from 'lucide-react';
import { m, useReducedMotion } from 'framer-motion';
import { EASE_OUT } from '@/components/motion';
import { cn } from '@/lib/utils';

type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  action?: string;
  onAction?: () => void;
  align?: 'left' | 'center';
  light?: boolean;
};

/** Eyebrow + title, with an underline that draws in and an optional "see all" link. */
export function SectionHeading({ eyebrow, title, action, onAction, align = 'left', light = false }: SectionHeadingProps) {
  const reduce = useReducedMotion();
  const center = align === 'center';

  return (
    <m.div
      initial={reduce ? false : 'hidden'}
      whileInView="show"
      viewport={{ once: true, amount: 0.6 }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}
      className={cn('mb-7 flex gap-4 sm:mb-9', center ? 'flex-col items-center text-center' : 'items-end justify-between')}
    >
      <div className={cn(center && 'max-w-lg')}>
        <m.p variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }} className={cn('eyebrow', light && 'text-[#f6c8d4]')}>
          {eyebrow}
        </m.p>
        <m.h2
          variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE_OUT } } }}
          className={cn('mt-1.5 text-[26px] font-semibold leading-tight tracking-[-0.025em] sm:text-[32px]', light ? 'text-white' : 'text-ink')}
        >
          {title}
        </m.h2>
        <m.span
          variants={{ hidden: { scaleX: 0 }, show: { scaleX: 1, transition: { duration: 0.7, ease: EASE_OUT } } }}
          className={cn('mt-3 block h-0.5 w-12 rounded-full bg-brand', center ? 'mx-auto origin-center' : 'origin-left', light && 'bg-white/70')}
        />
      </div>
      {action && onAction && (
        <m.button
          type="button"
          onClick={onAction}
          variants={{ hidden: { opacity: 0, x: 12 }, show: { opacity: 1, x: 0 } }}
          className="group mb-1 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-brand/20 px-4 py-2 text-xs font-bold text-brand transition-all hover:border-brand hover:bg-brand hover:text-white"
        >
          {action}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </m.button>
      )}
    </m.div>
  );
}
