import type { CSSProperties, ReactNode } from 'react';
import { m, useReducedMotion, type HTMLMotionProps } from 'framer-motion';

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

type Direction = 'up' | 'down' | 'left' | 'right' | 'none';

const offset: Record<Direction, { x?: number; y?: number }> = {
  up: { y: 32 },
  down: { y: -32 },
  left: { x: 40 },
  right: { x: -40 },
  none: {},
};

type RevealProps = Omit<HTMLMotionProps<'div'>, 'initial' | 'whileInView'> & {
  children: ReactNode;
  direction?: Direction;
  delay?: number;
  duration?: number;
  scale?: boolean;
  amount?: number;
};

/** Fades and slides its content in the first time it scrolls into view. */
export function Reveal({ children, direction = 'up', delay = 0, duration = 0.7, scale = false, amount = 0.2, ...rest }: RevealProps) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={rest.className} style={rest.style as CSSProperties}>{children}</div>;

  return (
    <m.div
      initial={{ opacity: 0, ...offset[direction], ...(scale ? { scale: 0.94 } : {}) }}
      whileInView={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      viewport={{ once: true, amount }}
      transition={{ duration, delay, ease: EASE_OUT }}
      {...rest}
    >
      {children}
    </m.div>
  );
}
