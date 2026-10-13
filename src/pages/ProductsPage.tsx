import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, m } from 'framer-motion';
import { SlidersHorizontal, X, ChevronDown, Grid3X3, LayoutGrid, Search, PackageSearch } from 'lucide-react';
import ProductCard, { ProductCardSkeleton } from '@/components/products/ProductCard';
import { fetchProducts, fetchCategories } from '@/services/productService';
import { Product, Category } from '@/types';
import { CountUp, Reveal } from '@/components/motion';
import { cn } from '@/lib/utils';

const inputClass = 'h-10 w-full min-w-0 rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none transition-all placeholder:text-ink-muted focus:border-brand focus:ring-4 focus:ring-brand/10';

const ProductsPage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [prods, cats] = await Promise.all([fetchProducts(), fetchCategories()]);
        setProducts(prods);
        setCategories(cats);
      } catch (error) {
        console.error('Failed to load products:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);
  const [searchParams, setSearchParams] = useSearchParams();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [gridCols, setGridCols] = useState<3 | 4>(4);

  const categoryFilter = searchParams.get('category');
  const searchQuery = searchParams.get('search') || '';
  const sortBy = searchParams.get('sort') || 'newest';
  const minPrice = searchParams.get('minPrice');
  const maxPrice = searchParams.get('maxPrice');
  const isFeatured = searchParams.get('featured') === 'true';
  const isNew = searchParams.get('new') === 'true';

  const [priceRange, setPriceRange] = useState({
    min: minPrice || '',
    max: maxPrice || '',
  });

  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Category filter - match by categorySlug or by category name converted to slug
    if (categoryFilter) {
      result = result.filter(
        (p) => p.categorySlug === categoryFilter ||
               p.category.toLowerCase().replace(/[^a-z0-9]/g, '-') === categoryFilter
      );
    }

    // Featured filter
    if (isFeatured) {
      result = result.filter((p) => p.featured);
    }

    // New filter
    if (isNew) {
      result = result.filter((p) => p.isNew);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query) ||
          p.category.toLowerCase().includes(query)
      );
    }

    // Price filter
    if (minPrice) {
      result = result.filter((p) => p.price >= Number(minPrice));
    }
    if (maxPrice) {
      result = result.filter((p) => p.price <= Number(maxPrice));
    }

    // Sorting
    switch (sortBy) {
      case 'price-low':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        result.sort((a, b) => b.rating - a.rating);
        break;
      case 'popular':
        result.sort((a, b) => b.reviewCount - a.reviewCount);
        break;
      default:
        // newest - keep original order
        break;
    }

    return result;
  }, [products, categoryFilter, searchQuery, sortBy, minPrice, maxPrice, isFeatured, isNew]);

  const updateFilter = (key: string, value: string | null) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams);
  };

  const clearAllFilters = () => {
    setSearchParams(new URLSearchParams());
    setPriceRange({ min: '', max: '' });
  };

  const applyPriceFilter = () => {
    const newParams = new URLSearchParams(searchParams);
    if (priceRange.min) {
      newParams.set('minPrice', priceRange.min);
    } else {
      newParams.delete('minPrice');
    }
    if (priceRange.max) {
      newParams.set('maxPrice', priceRange.max);
    } else {
      newParams.delete('maxPrice');
    }
    setSearchParams(newParams);
    setIsFilterOpen(false);
  };

  const activeFiltersCount = [
    categoryFilter,
    minPrice,
    maxPrice,
    isFeatured,
    isNew,
  ].filter(Boolean).length;

  const title = categoryFilter
    ? categories.find((c) => c.slug === categoryFilter)?.name || 'Products'
    : isFeatured
    ? 'Featured Products'
    : isNew
    ? 'New Arrivals'
    : 'All Products';

  const priceInputs = (
    <div className="flex gap-2">
      <input type="number" placeholder="Min" value={priceRange.min} onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })} className={inputClass} />
      <input type="number" placeholder="Max" value={priceRange.max} onChange={(e) => setPriceRange({ ...priceRange, max: e.target.value })} className={inputClass} />
    </div>
  );

  return (
    <div className="min-h-screen bg-surface pb-20">
      {/* Page header */}
      <section className="relative overflow-hidden border-b border-line bg-gradient-to-br from-brand-blush via-surface-warm to-surface">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 animate-spin-slow rounded-full border-[30px] border-dashed border-brand/5" />
        <div className="shell relative py-10 sm:py-14">
          <p className="eyebrow">MODESSI COLLECTION</p>
          <AnimatePresence mode="wait">
            <m.h1
              key={title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4 }}
              className="mt-2 text-3xl font-semibold tracking-[-0.025em] text-ink md:text-[42px]"
            >
              {title}
            </m.h1>
          </AnimatePresence>
          <p className="mt-2 text-sm text-ink-muted">
            {isLoading ? '…' : <CountUp value={filteredProducts.length} />} products found
          </p>
        </div>
      </section>

      {/* Category chips */}
      <div className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur-lg lg:hidden">
        <div className="shell no-scrollbar flex gap-2 overflow-x-auto py-3">
          {[{ id: 'all', slug: null as string | null, name: 'All' }, ...categories].map((category) => {
            const active = category.slug ? categoryFilter === category.slug : !categoryFilter;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => updateFilter('category', category.slug)}
                className={cn('relative shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors', active ? 'text-white' : 'bg-white text-ink-soft ring-1 ring-line')}
              >
                {active && <m.span layoutId="chip-active" className="absolute inset-0 rounded-full bg-brand" transition={{ type: 'spring', stiffness: 420, damping: 32 }} />}
                <span className="relative">{category.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="shell mt-8 flex gap-8">
        {/* Sidebar Filters - Desktop */}
        <aside className="hidden w-64 flex-shrink-0 lg:block">
          <Reveal direction="right" className="sticky top-28 space-y-5">
            <div className="rounded-3xl border border-line bg-white p-5 shadow-sm">
              <h3 className="mb-3 font-semibold text-ink">Categories</h3>
              <ul className="space-y-1">
                {[{ id: 'all', slug: null as string | null, name: 'All Categories', productCount: undefined as number | undefined }, ...categories].map((category) => {
                  const active = category.slug ? categoryFilter === category.slug : !categoryFilter;
                  return (
                    <li key={category.id}>
                      <button
                        type="button"
                        onClick={() => updateFilter('category', category.slug)}
                        className={cn('relative flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors', active ? 'font-semibold text-brand' : 'text-ink-muted hover:bg-surface-warm hover:text-ink')}
                      >
                        {active && <m.span layoutId="sidebar-active" className="absolute inset-0 rounded-xl bg-brand-blush" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                        <span className="relative">{category.name}</span>
                        {category.productCount !== undefined && <span className="relative text-xs opacity-70">({category.productCount})</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="rounded-3xl border border-line bg-white p-5 shadow-sm">
              <h3 className="mb-3 font-semibold text-ink">Price Range</h3>
              {priceInputs}
              <button type="button" onClick={applyPriceFilter} className="mt-3 h-10 w-full rounded-xl border border-brand/30 text-sm font-semibold text-brand transition-all hover:bg-brand hover:text-white">
                Apply
              </button>
            </div>

            <AnimatePresence>
              {activeFiltersCount > 0 && (
                <m.button
                  type="button"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  onClick={clearAllFilters}
                  className="flex w-full items-center justify-center gap-2 rounded-xl py-2 text-sm font-medium text-ink-muted transition-colors hover:text-brand"
                >
                  <X className="h-4 w-4" />
                  Clear All Filters
                </m.button>
              )}
            </AnimatePresence>
          </Reveal>
        </aside>

        {/* Main Content */}
        <div className="min-w-0 flex-1">
          {/* Toolbar */}
          <div className="mb-6 flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
            <div className="relative max-w-md flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <input
                type="text"
                placeholder="প্রোডাক্ট খুঁজুন..."
                value={searchQuery}
                onChange={(e) => updateFilter('search', e.target.value || null)}
                className={cn(inputClass, 'h-11 rounded-full pl-10')}
              />
            </div>

            <div className="flex items-center justify-between gap-2 sm:justify-end">
              {/* Mobile Filter Toggle */}
              <button
                type="button"
                className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-medium text-ink-soft lg:hidden"
                onClick={() => setIsFilterOpen(true)}
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
                {activeFiltersCount > 0 && (
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-brand text-xs text-white">{activeFiltersCount}</span>
                )}
              </button>

              {/* Grid Toggle */}
              <div className="hidden items-center rounded-full border border-line bg-white p-1 md:flex">
                {([3, 4] as const).map((cols) => (
                  <button key={cols} type="button" onClick={() => setGridCols(cols)} className={cn('relative rounded-full p-2 transition-colors', gridCols === cols ? 'text-white' : 'text-ink-muted hover:text-ink')}>
                    {gridCols === cols && <m.span layoutId="grid-toggle" className="absolute inset-0 rounded-full bg-brand" transition={{ type: 'spring', stiffness: 420, damping: 32 }} />}
                    {cols === 3 ? <Grid3X3 className="relative h-4 w-4" /> : <LayoutGrid className="relative h-4 w-4" />}
                  </button>
                ))}
              </div>

              {/* Sort */}
              <div className="flex items-center gap-2">
                <span className="hidden text-sm text-ink-muted sm:inline">Sort by:</span>
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => updateFilter('sort', e.target.value)}
                    className="h-10 cursor-pointer appearance-none rounded-full border border-line bg-white pl-4 pr-9 text-sm text-ink focus:outline-none focus:ring-4 focus:ring-brand/10"
                  >
                    <option value="newest">Newest</option>
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                    <option value="rating">Highest Rated</option>
                    <option value="popular">Most Popular</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                </div>
              </div>
            </div>
          </div>

          {/* Product Grid */}
          {isLoading ? (
            <div className={cn('grid grid-cols-2 gap-x-3 gap-y-8 md:gap-6', gridCols === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4')}>
              {Array.from({ length: 8 }).map((_, index) => <ProductCardSkeleton key={index} />)}
            </div>
          ) : filteredProducts.length > 0 ? (
            <m.div layout className={cn('grid grid-cols-2 gap-x-3 gap-y-8 md:gap-6', gridCols === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4')}>
              <AnimatePresence mode="popLayout">
                {filteredProducts.map((product, index) => (
                  <m.div
                    key={product.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.35 }}
                  >
                    <ProductCard product={product} index={index} />
                  </m.div>
                ))}
              </AnimatePresence>
            </m.div>
          ) : (
            <m.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-dashed border-line bg-white py-16 text-center">
              <PackageSearch className="mx-auto h-12 w-12 animate-float text-brand-soft" />
              <p className="mb-5 mt-4 text-lg text-ink-muted">No products found</p>
              <button type="button" onClick={clearAllFilters} className="rounded-full border border-brand/30 px-6 py-2.5 text-sm font-semibold text-brand transition-all hover:bg-brand hover:text-white">
                Clear Filters
              </button>
            </m.div>
          )}
        </div>
      </div>

      {/* Mobile filter sheet */}
      <AnimatePresence>
        {isFilterOpen && (
          <m.div className="fixed inset-0 z-[60] lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button type="button" aria-label="Close" className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={() => setIsFilterOpen(false)} />
            <m.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => { if (info.offset.y > 100) setIsFilterOpen(false); }}
              className="pb-safe absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-[2rem] bg-surface-paper p-5 shadow-2xl"
            >
              <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-line" />
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-ink">Filters</h3>
                <button type="button" onClick={() => setIsFilterOpen(false)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface-warm"><X className="h-5 w-5" /></button>
              </div>

              <h4 className="mb-3 font-semibold text-ink">Categories</h4>
              <div className="flex flex-wrap gap-2">
                {[{ id: 'all', slug: null as string | null, name: 'All' }, ...categories].map((category) => {
                  const active = category.slug ? categoryFilter === category.slug : !categoryFilter;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => updateFilter('category', category.slug)}
                      className={cn('rounded-full px-3.5 py-1.5 text-sm transition-colors', active ? 'bg-brand text-white' : 'bg-white text-ink-soft ring-1 ring-line')}
                    >
                      {category.name}
                    </button>
                  );
                })}
              </div>

              <h4 className="mb-3 mt-6 font-semibold text-ink">Price Range</h4>
              {priceInputs}

              <div className="mt-6 flex gap-3">
                {activeFiltersCount > 0 && (
                  <button type="button" onClick={() => { clearAllFilters(); setIsFilterOpen(false); }} className="h-12 flex-1 rounded-full border border-line text-sm font-semibold text-ink-soft">
                    Clear All Filters
                  </button>
                )}
                <button type="button" onClick={applyPriceFilter} className="h-12 flex-1 rounded-full bg-brand text-sm font-semibold text-white shadow-cta">
                  Apply
                </button>
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProductsPage;
