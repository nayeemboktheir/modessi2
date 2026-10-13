import { useRef, type CSSProperties, type ReactNode } from 'react';
import { m, useInView, useReducedMotion, type HTMLMotionProps, type Variants } from 'framer-motion';
import { EASE_OUT } from './Reveal';

const container = (stagger: number, delay: number): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren: delay } },
});

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 28, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease: EASE_OUT } },
};

type StaggerProps = Omit<HTMLMotionProps<'div'>, 'variants' | 'initial' | 'whileInView' | 'animate'> & {
  children: ReactNode;
  stagger?: number;
  delay?: number;
  /** Animate on mount rather than on scroll — for content above the fold. */
  immediate?: boolean;
};

/** Parent that reveals each `StaggerItem` child in sequence. */
export function Stagger({ children, stagger = 0.08, delay = 0, immediate = false, ...rest }: StaggerProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.1 });
  if (reduce) return <div className={rest.className} style={rest.style as CSSProperties}>{children}</div>;

  // Driven through `animate` rather than `whileInView`: children that mount after
  // the gesture fired (fallback content swapped for loaded data) only inherit an
  // `animate` state, so with `whileInView` they stayed hidden for good.
  return (
    <m.div
      ref={ref}
      variants={container(stagger, delay)}
      initial="hidden"
      animate={immediate || inView ? 'show' : 'hidden'}
      {...rest}
    >
      {children}
    </m.div>
  );
}

type StaggerItemProps = Omit<HTMLMotionProps<'div'>, 'variants'> & { children: ReactNode };

export function StaggerItem({ children, ...rest }: StaggerItemProps) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={rest.className} style={rest.style as CSSProperties}>{children}</div>;
  return <m.div variants={staggerItem} {...rest}>{children}</m.div>;
}
