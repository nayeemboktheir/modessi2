import { Stagger, StaggerItem } from '@/components/motion';
import { cn } from '@/lib/utils';
import { categoryShades, type Category } from './content';

function CategoryVisual({ category, index, rounded = false }: { category: Category; index: number; rounded?: boolean }) {
  if (category.image_url) {
    return (
      <span className={rounded ? 'block h-full w-full overflow-hidden rounded-full bg-white' : 'absolute inset-0 block overflow-hidden'}>
        <img src={category.image_url} alt={rounded ? '' : category.name} className="h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-110" loading="lazy" />
      </span>
    );
  }
  return (
    <span className={cn('bg-gradient-to-br font-semibold text-brand-soft', categoryShades[index % categoryShades.length], rounded ? 'grid h-full w-full place-items-center rounded-full text-xl' : 'absolute inset-0 grid place-items-center text-6xl')}>
      {category.name.slice(0, 1)}
    </span>
  );
}

export function CategoryRail({ categories, loading, onSelect }: { categories: Category[]; loading: boolean; onSelect: (slug: string) => void }) {
  if (loading) {
    return (
      <section className="border-b border-line bg-white">
        <div className="shell flex gap-5 overflow-hidden py-6">
          {Array.from({ length: 7 }).map((_, index) => <div key={index} className="skeleton-shimmer h-[76px] w-[76px] shrink-0 rounded-full sm:h-[88px] sm:w-[88px]" />)}
        </div>
      </section>
    );
  }

  return (
    <section className="border-b border-line bg-white">
      <Stagger immediate stagger={0.06} delay={0.3} className="shell no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto py-6 sm:gap-6 lg:justify-center">
        {categories.map((category, index) => (
          <StaggerItem key={category.id} className="snap-start">
            <button type="button" onClick={() => onSelect(category.slug)} className="group flex w-[80px] flex-col items-center text-center sm:w-[96px]">
              <span className="relative block h-[76px] w-[76px] sm:h-[88px] sm:w-[88px]">
                {/* Rotating gradient ring, revealed on hover */}
                <span className="absolute -inset-[3px] rounded-full bg-[conic-gradient(from_0deg,hsl(var(--brand)),hsl(var(--accent)),hsl(var(--brand-blush)),hsl(var(--brand)))] opacity-0 transition-opacity duration-500 group-hover:animate-spin-slow group-hover:opacity-100" />
                <span className="absolute inset-0 rounded-full border-2 border-[#f5ebe6] bg-white p-0.5 transition-transform duration-500 group-hover:scale-95">
                  <CategoryVisual category={category} index={index} rounded />
                </span>
              </span>
              <span className="mt-2.5 block whitespace-nowrap text-[11px] font-semibold text-ink-soft transition-colors group-hover:text-brand sm:text-xs">{category.name}</span>
            </button>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}
