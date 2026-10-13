import { useEffect, useState } from 'react';
import { m, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Reveal } from '@/components/motion';
import { cn } from '@/lib/utils';
import { SectionHeading } from './SectionHeading';
import { categoryShades, type Category } from './content';

// Timing of the lift cycle: each tile rises, holds, settles, then the next one goes.
const UP_MS = 1200;
const SETTLE_MS = 1700;
const LIFTED = 'translateY(-6px) rotateX(10.71deg) translateZ(24px)';
const LINE = 'M 1 0 v 5 q 0 5 5 5 h 39 q 5 0 5 5 v 71 q 0 5 5 5 h 39 q 5 0 5 5 v 5';

/**
 * Dark showcase card: category tiles lift one after another in 3D while a glow
 * travels along a connector line behind them; the caption follows the lifted tile.
 */
export function CategoryShowcase({ categories, onSelect, onAll }: { categories: Category[]; onSelect: (slug: string) => void; onAll: () => void }) {
  const reduce = useReducedMotion();
  const tiles = categories.slice(0, 5);
  const [active, setActive] = useState(0);
  const [lifted, setLifted] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    if (reduce || tiles.length === 0) return;
    let index = 0;
    let timer: number;
    const cycle = () => {
      setActive(index);
      setLifted(true);
      timer = window.setTimeout(() => {
        setLifted(false);
        timer = window.setTimeout(() => {
          index = (index + 1) % tiles.length;
          cycle();
        }, SETTLE_MS);
      }, UP_MS);
    };
    cycle();
    return () => window.clearTimeout(timer);
  }, [reduce, tiles.length]);

  const shown = hovered ?? active;
  const current = tiles[shown] || tiles[0];

  return (
    <section className="bg-surface-warm py-14 sm:py-20">
      <div className="shell">
        <SectionHeading eyebrow="আপনার পছন্দ অনুযায়ী" title="ক্যাটাগরি অনুযায়ী দেখুন" action="সব ক্যাটাগরি" onAction={onAll} />

        <Reveal scale>
          <div className="relative flex flex-col justify-between overflow-hidden rounded-[2rem] border border-line bg-surface-warm">
            {/* Stage */}
            <div className="relative flex h-[17rem] w-full flex-col items-center justify-center sm:h-[22rem] lg:h-[26rem]">
              {/* Connector line with a travelling glow */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-full w-[18rem] sm:w-[26rem]">
                  <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none">
                    <path d={LINE} stroke="rgba(148,30,61,0.25)" strokeWidth="0.15" vectorEffect="non-scaling-stroke" />
                    <g mask="url(#category-line-mask)">
                      <circle r="12" fill="url(#category-line-glow)">
                        {!reduce && <animateMotion dur="4s" repeatCount="indefinite" path={LINE} />}
                      </circle>
                    </g>
                    <defs>
                      <mask id="category-line-mask">
                        <path d={LINE} strokeWidth="0.6" stroke="white" vectorEffect="non-scaling-stroke" />
                      </mask>
                      <radialGradient id="category-line-glow" fx="1">
                        <stop offset="0%" stopColor="#e8a33c" />
                        <stop offset="100%" stopColor="transparent" />
                      </radialGradient>
                    </defs>
                  </svg>
                </div>
              </div>

              {/* Tiles */}
              <div className="no-scrollbar relative flex max-w-full items-center justify-center gap-3 overflow-x-auto px-4 py-8 [perspective:1000px] [transform-style:preserve-3d] sm:gap-5">
                {tiles.map((category, index) => {
                  const up = (lifted && index === active) || hovered === index;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => onSelect(category.slug)}
                      onMouseEnter={() => setHovered(index)}
                      onMouseLeave={() => setHovered(null)}
                      aria-label={category.name}
                      style={{ transform: up ? LIFTED : 'none' }}
                      className={cn(
                        'group relative aspect-square h-20 shrink-0 overflow-hidden rounded-2xl border bg-white p-1 will-change-transform sm:h-36 lg:h-44',
                        'transition-[transform,border-color,box-shadow] duration-1000 ease-out',
                        up ? 'border-brand/40 shadow-[0_24px_40px_-12px_rgba(148,30,61,0.35)]' : 'border-line',
                      )}
                    >
                      {category.image_url ? (
                        <img src={category.image_url} alt="" loading="lazy" className="h-full w-full rounded-xl object-cover" />
                      ) : (
                        <span className={cn('grid h-full w-full place-items-center rounded-xl bg-gradient-to-br text-3xl font-semibold text-brand-soft', categoryShades[index % categoryShades.length])}>
                          {category.name.slice(0, 1)}
                        </span>
                      )}
                      <span className="absolute inset-x-1 bottom-1 rounded-b-xl bg-gradient-to-t from-black/75 to-transparent px-2 pb-1.5 pt-6 text-center text-[10px] font-semibold text-white sm:text-xs">
                        {category.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="pointer-events-none absolute bottom-0 left-0 h-6 w-full bg-gradient-to-t from-surface-warm to-transparent" />
            </div>

            {/* Caption follows the lifted tile */}
            <div className="flex items-end justify-between gap-4 border-t border-line px-6 pb-6 pt-5 sm:px-8">
                {current && (
                  <m.div
                    key={current.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="min-w-0"
                  >
                    <div className="text-base font-semibold text-ink sm:text-lg">{current.name}</div>
                    <div className="mt-1 line-clamp-2 text-xs text-ink-muted sm:text-sm">{current.description || 'শপ করুন'}</div>
                  </m.div>
                )}
              {current && (
                <button
                  type="button"
                  onClick={() => onSelect(current.slug)}
                  className="group inline-flex shrink-0 items-center gap-1.5 rounded-full border border-brand/20 px-4 py-2 text-xs font-bold text-brand transition-colors hover:bg-brand hover:text-white"
                >
                  শপ করুন <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </button>
              )}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
