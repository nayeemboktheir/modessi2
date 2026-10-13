import { useRef } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

type QuantityStepperProps = {
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
  size?: 'sm' | 'md';
};

/** − n + control whose number ticks up or down in the direction of the change. */
export function QuantityStepper({ value, onDecrease, onIncrease, size = 'md' }: QuantityStepperProps) {
  const previous = useRef(value);
  const direction = value >= previous.current ? 1 : -1;
  previous.current = value;
  const box = size === 'sm' ? 'h-8 w-8' : 'h-9 w-9';

  return (
    <div className="inline-flex items-center rounded-full border border-line bg-white p-0.5">
      <m.button type="button" whileTap={{ scale: 0.85 }} onClick={onDecrease} disabled={value <= 1} aria-label="Decrease" className={cn('grid place-items-center rounded-full text-ink-soft transition-colors hover:bg-brand-blush hover:text-brand disabled:opacity-40 disabled:hover:bg-transparent', box)}>
        <Minus className="h-3.5 w-3.5" />
      </m.button>
      <span className="relative w-8 overflow-hidden text-center text-sm font-semibold text-ink">
        <AnimatePresence mode="popLayout" initial={false}>
          <m.span
            key={value}
            className="inline-block"
            initial={{ y: direction * 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: direction * -14, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {value}
          </m.span>
        </AnimatePresence>
      </span>
      <m.button type="button" whileTap={{ scale: 0.85 }} onClick={onIncrease} aria-label="Increase" className={cn('grid place-items-center rounded-full text-ink-soft transition-colors hover:bg-brand-blush hover:text-brand', box)}>
        <Plus className="h-3.5 w-3.5" />
      </m.button>
    </div>
  );
}
