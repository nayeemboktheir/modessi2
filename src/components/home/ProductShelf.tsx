import { ShoppingBag } from 'lucide-react';
import ProductCard, { ProductCardSkeleton } from '@/components/products/ProductCard';
import type { Product } from '@/types';
import { cn } from '@/lib/utils';
import { SectionHeading } from './SectionHeading';

type ProductShelfProps = {
  eyebrow: string;
  title: string;
  action: string;
  onAction: () => void;
  products: Product[];
  loading?: boolean;
  className?: string;
};

/**
 * Product section: a swipeable snap rail on phones (so the next card peeks in
 * and invites a swipe), a five-up grid from `lg`.
 */
export function ProductShelf({ eyebrow, title, action, onAction, products, loading = false, className }: ProductShelfProps) {
  return (
    <section className={cn('py-14 sm:py-20', className)}>
      <div className="shell">
        <SectionHeading eyebrow={eyebrow} title={title} action={action} onAction={onAction} />
        {loading ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-5 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => <ProductCardSkeleton key={index} />)}
          </div>
        ) : products.length ? (
          <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-5 sm:overflow-visible sm:px-0 lg:grid-cols-5">
            {products.map((product, index) => (
              <div key={product.id} className="w-[46%] shrink-0 snap-start sm:w-auto">
                <ProductCard product={product} index={index} />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-line bg-surface-paper px-6 py-12 text-center">
            <ShoppingBag className="mx-auto h-7 w-7 animate-float text-brand-soft" />
            <p className="mt-3 text-sm font-semibold text-ink-soft">নতুন কালেকশন খুব শিগগিরই আসছে</p>
            <p className="mt-1 text-xs text-ink-muted">সব পণ্য দেখতে আমাদের কালেকশন পেজে যান।</p>
          </div>
        )}
      </div>
    </section>
  );
}
