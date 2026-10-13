import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type MarqueeProps = {
  children: ReactNode;
  /** Seconds for one full loop. */
  duration?: number;
  reverse?: boolean;
  className?: string;
  trackClassName?: string;
};

/**
 * Infinite horizontal scroll. The content is rendered twice and the track moves
 * by exactly half its width, so the loop is seamless. Pauses on hover and stops
 * entirely under prefers-reduced-motion (see index.css).
 */
export function Marquee({ children, duration = 30, reverse = false, className, trackClassName }: MarqueeProps) {
  return (
    <div className={cn('group relative flex overflow-hidden', className)}>
      <div
        className={cn('flex w-max shrink-0 group-hover:[animation-play-state:paused]', reverse ? 'animate-marquee-reverse' : 'animate-marquee', trackClassName)}
        style={{ '--marquee-duration': duration + 's' } as CSSProperties}
      >
        <div className="flex shrink-0">{children}</div>
        <div className="flex shrink-0" aria-hidden="true">{children}</div>
      </div>
    </div>
  );
}
