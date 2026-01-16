import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Filter, X, ChevronDown, Grid3X3, LayoutGrid, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ProductCard from '@/components/products/ProductCard';
import { fetchProducts, fetchCategories } from '@/services/productService';
import { Product, Category } from '@/types';

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
  };

  const activeFiltersCount = [
    categoryFilter,
    minPrice,
    maxPrice,
    isFeatured,
    isNew,
  ].filter(Boolean).length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pt-40 pb-16 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-40 pb-16">
      <div className="container-custom">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-2">
            {categoryFilter
              ? categories.find((c) => c.slug === categoryFilter)?.name || 'Products'
              : isFeatured
              ? 'Featured Products'
              : isNew
              ? 'New Arrivals'
              : 'All Products'}
          </h1>
          <p className="text-muted-foreground">
            {filteredProducts.length} products found
          </p>
        </div>

        <div className="flex gap-8">
          {/* Sidebar Filters - Desktop */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-44 space-y-6">
              {/* Categories */}
              <div className="bg-card rounded-xl p-5 border border-border">
                <h3 className="font-semibold text-foreground mb-4">Categories</h3>
                <ul className="space-y-2">
                  <li>
                    <button
                      onClick={() => updateFilter('category', null)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                        !categoryFilter
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      All Categories
                    </button>
                  </li>
                  {categories.map((category) => (
                    <li key={category.id}>
                      <button
                        onClick={() => updateFilter('category', category.slug)}
                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                          categoryFilter === category.slug
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        {category.name}
                        <span className="text-xs ml-1">({category.productCount})</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Price Range */}
              <div className="bg-card rounded-xl p-5 border border-border">
                <h3 className="font-semibold text-foreground mb-4">Price Range</h3>
                <div className="flex gap-2 mb-3">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={priceRange.min}
                    onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })}
                    className="h-10"
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={priceRange.max}
                    onChange={(e) => setPriceRange({ ...priceRange, max: e.target.value })}
                    className="h-10"
                  />
                </div>
                <Button variant="outline" size="sm" className="w-full" onClick={applyPriceFilter}>
                  Apply
                </Button>
              </div>

              {/* Clear Filters */}
              {activeFiltersCount > 0 && (
                <Button variant="ghost" className="w-full" onClick={clearAllFilters}>
                  <X className="h-4 w-4 mr-2" />
                  Clear All Filters
                </Button>
              )}
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1">
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-6 gap-4">
              <div className="flex items-center gap-3">
                {/* Mobile Filter Toggle */}
                <Button
                  variant="outline"
                  className="lg:hidden"
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                  {activeFiltersCount > 0 && (
                    <span className="ml-2 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                      {activeFiltersCount}
                    </span>
                  )}
                </Button>

                {/* Grid Toggle */}
                <div className="hidden md:flex items-center border border-border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setGridCols(3)}
                    className={`p-2 ${gridCols === 3 ? 'bg-muted' : 'hover:bg-muted/50'}`}
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setGridCols(4)}
                    className={`p-2 ${gridCols === 4 ? 'bg-muted' : 'hover:bg-muted/50'}`}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Sort */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground hidden sm:inline">Sort by:</span>
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => updateFilter('sort', e.target.value)}
                    className="h-10 pl-3 pr-8 rounded-lg border border-border bg-background text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="newest">Newest</option>
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                    <option value="rating">Highest Rated</option>
                    <option value="popular">Most Popular</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Mobile Filters */}
            {isFilterOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="lg:hidden mb-6 space-y-4"
              >
                {/* Categories */}
                <div className="bg-card rounded-xl p-4 border border-border">
                  <h3 className="font-semibold text-foreground mb-3">Categories</h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => updateFilter('category', null)}
                      className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                        !categoryFilter
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      All
                    </button>
                    {categories.map((category) => (
                      <button
                        key={category.id}
                        onClick={() => updateFilter('category', category.slug)}
                        className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                          categoryFilter === category.slug
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {category.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price Range */}
                <div className="bg-card rounded-xl p-4 border border-border">
                  <h3 className="font-semibold text-foreground mb-3">Price Range</h3>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={priceRange.min}
                      onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })}
                      className="h-9"
                    />
                    <Input
                      type="number"
                      placeholder="Max"
                      value={priceRange.max}
                      onChange={(e) => setPriceRange({ ...priceRange, max: e.target.value })}
                      className="h-9"
                    />
                    <Button variant="outline" size="sm" onClick={applyPriceFilter}>
                      Apply
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Product Grid */}
            {filteredProducts.length > 0 ? (
              <div className={`grid grid-cols-2 ${gridCols === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-4 md:gap-6`}>
                {filteredProducts.map((product, index) => (
                  <ProductCard key={product.id} product={product} index={index} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <p className="text-muted-foreground text-lg mb-4">No products found</p>
                <Button variant="outline" onClick={clearAllFilters}>
                  Clear Filters
                </Button>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default ProductsPage;
