import { supabase } from '@/integrations/supabase/client';
import { Product, Category, ProductVariation } from '@/types';

// Fetch product variations for a product
export const fetchProductVariations = async (productId: string): Promise<ProductVariation[]> => {
  const { data, error } = await supabase
    .from('product_variations')
    .select('*')
    .eq('product_id', productId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) throw error;

  return (data || []).map((v) => ({
    id: v.id,
    product_id: v.product_id,
    name: v.name,
    price: Number(v.price),
    original_price: v.original_price ? Number(v.original_price) : undefined,
    stock: v.stock,
    sort_order: v.sort_order || 0,
    is_active: v.is_active ?? true,
  }));
};

// Fetch all active products with variations
export const fetchProducts = async (): Promise<Product[]> => {
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      categories:category_id (name, slug),
      product_variations!product_variations_product_id_fkey (*)
    `)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map(mapProductFromDB);
};

// Fetch featured products
export const fetchFeaturedProducts = async (): Promise<Product[]> => {
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      categories:category_id (name, slug),
      product_variations!product_variations_product_id_fkey (*)
    `)
    .eq('is_active', true)
    .eq('is_featured', true)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map(mapProductFromDB);
};

// Fetch new products
export const fetchNewProducts = async (): Promise<Product[]> => {
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      categories:category_id (name, slug),
      product_variations!product_variations_product_id_fkey (*)
    `)
    .eq('is_active', true)
    .eq('is_new', true)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map(mapProductFromDB);
};

// Fetch recent products (most recently added)
export const fetchRecentProducts = async (limit: number = 8): Promise<Product[]> => {
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      categories:category_id (name, slug),
      product_variations!product_variations_product_id_fkey (*)
    `)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data || []).map(mapProductFromDB);
};

// Fetch single product by slug
export const fetchProductBySlug = async (slug: string): Promise<Product | null> => {
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      categories:category_id (name, slug),
      product_variations!product_variations_product_id_fkey (*)
    `)
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return mapProductFromDB(data);
};

// Fetch all categories
export const fetchCategories = async (): Promise<Category[]> => {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) throw error;

  return (data || []).map((cat) => ({
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    image: cat.image_url || '',
    productCount: 0, // Will be updated with actual count
  }));
};

// Helper function to map database product to frontend Product type
const mapProductFromDB = (data: any): Product => {
  const originalPrice = data.original_price ? Number(data.original_price) : undefined;
  const price = Number(data.price);
  const discount = originalPrice ? Math.round(((originalPrice - price) / originalPrice) * 100) : undefined;

  // Map variations (dedupe by normalized name)
  const variations: ProductVariation[] = Array.from(
    new Map(
      (data.product_variations || [])
        .filter((v: any) => v.is_active)
        .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
        .map((v: any) => [String(v.name).trim().toLowerCase(), v])
    ).values()
  ).map((v: any) => ({
    id: v.id,
    product_id: v.product_id,
    name: v.name,
    price: Number(v.price),
    original_price: v.original_price ? Number(v.original_price) : undefined,
    stock: v.stock,
    sort_order: v.sort_order || 0,
    is_active: v.is_active ?? true,
  }));

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    description: data.description || '',
    short_description: data.short_description || undefined,
    long_description: data.long_description || undefined,
    price: price,
    originalPrice: originalPrice,
    images: data.images || [],
    category: data.categories?.name || 'Uncategorized',
    categorySlug: data.categories?.slug || undefined,
    subcategory: undefined,
    rating: Number(data.rating) || 0,
    reviewCount: data.review_count || 0,
    stock: data.stock || 0,
    featured: data.is_featured || false,
    isNew: data.is_new || false,
    discount: discount,
    tags: data.tags || [],
    variations: variations.length > 0 ? variations : undefined,
  };
};
