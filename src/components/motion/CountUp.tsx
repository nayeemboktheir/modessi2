import { useEffect, useRef, useState } from 'react';
import { animate, useInView, useReducedMotion } from 'framer-motion';

type CountUpProps = {
  value: number;
  format?: (value: number) => string;
  duration?: number;
  className?: string;
};

/** Counts from the previous value (0 on first view) to `value`. */
export function CountUp({ value, format = (v) => Math.round(v).toLocaleString('en-BD'), duration = 0.8, className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? value : 0);
  const from = useRef(0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setDisplay(value);
      return;
    }
    const controls = animate(from.current, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => setDisplay(latest),
    });
    from.current = value;
    return () => controls.stop();
  }, [value, inView, reduce, duration]);

  return <span ref={ref} className={className}>{format(display)}</span>;
}
