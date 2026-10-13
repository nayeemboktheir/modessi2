import type { ReactNode, PointerEvent } from 'react';
import { m, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';
import { useCanHover } from './useCanHover';

type MagneticProps = {
  children: ReactNode;
  className?: string;
  strength?: number;
};

/** Pulls its content a few pixels toward the pointer — for primary CTAs. */
export function Magnetic({ children, className, strength = 0.25 }: MagneticProps) {
  const reduce = useReducedMotion();
  const canHover = useCanHover();
  const x = useSpring(useMotionValue(0), { stiffness: 250, damping: 18 });
  const y = useSpring(useMotionValue(0), { stiffness: 250, damping: 18 });

  if (reduce || !canHover) return <div className={className}>{children}</div>;

  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    x.set((event.clientX - rect.left - rect.width / 2) * strength);
    y.set((event.clientY - rect.top - rect.height / 2) * strength);
  };

  return (
    <m.div className={className} style={{ x, y }} onPointerMove={onMove} onPointerLeave={() => { x.set(0); y.set(0); }}>
      {children}
    </m.div>
  );
}
