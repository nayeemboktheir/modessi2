import type { ReactNode, PointerEvent } from 'react';
import { m, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import { useCanHover } from './useCanHover';

type TiltCardProps = {
  children: ReactNode;
  className?: string;
  /** Maximum tilt in degrees. */
  max?: number;
};

/** Tilts slightly toward the pointer. Inert on touch and under reduced motion. */
export function TiltCard({ children, className, max = 6 }: TiltCardProps) {
  const reduce = useReducedMotion();
  const canHover = useCanHover();
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const spring = { stiffness: 220, damping: 20 };
  const rotateX = useSpring(useTransform(py, [0, 1], [max, -max]), spring);
  const rotateY = useSpring(useTransform(px, [0, 1], [-max, max]), spring);

  if (reduce || !canHover) return <div className={className}>{children}</div>;

  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    px.set((event.clientX - rect.left) / rect.width);
    py.set((event.clientY - rect.top) / rect.height);
  };
  const onLeave = () => {
    px.set(0.5);
    py.set(0.5);
  };

  return (
    <m.div
      className={className}
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      {children}
    </m.div>
  );
}
