import { useRef, type ReactNode } from 'react';
import { m, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { useCanHover } from './useCanHover';

type ParallaxProps = {
  children: ReactNode;
  /** Total travel in px across the element's pass through the viewport. */
  distance?: number;
  className?: string;
};

/** Drifts its content vertically as the page scrolls. Desktop only. */
export function Parallax({ children, distance = 80, className }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const canHover = useCanHover();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [-distance / 2, distance / 2]);

  return (
    <div ref={ref} className={className}>
      <m.div className="h-full w-full" style={reduce || !canHover ? undefined : { y }}>
        {children}
      </m.div>
    </div>
  );
}
