import { Fragment, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Search, ChevronDown, ChevronRight, Save, Tags } from 'lucide-react';
import { DataPagination } from '@/components/admin/DataPagination';
import { usePagination } from '@/hooks/usePagination';

interface Variation {
  id: string;
  product_id: string;
  name: string;
  price: number;
  stock: number;
  sort_order: number | null;
}

interface ProductRow {
  id: string;
  name: string;
  price: number;
  stock: number;
  images: string[] | null;
  is_active: boolean | null;
  category_id: string | null;
}

interface WholesaleRow {
  id: string;
  product_id: string;
  variation_id: string | null;
  wholesale_price: number;
  min_quantity: number;
  is_active: boolean;
}

const keyFor = (productId: string, variationId: string | null) =>
  `${productId}::${variationId ?? 'base'}`;

export default function AdminWholesalePrices() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string>('all');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, { price: string; minQty: string }>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [bulkPercent, setBulkPercent] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkRunning, setBulkRunning] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-wholesale-prices'],
    queryFn: async () => {
      const [products, variations, wholesale, categories] = await Promise.all([
        supabase.from('products').select('id, name, price, stock, images, is_active, category_id').order('name'),
        supabase.from('product_variations').select('id, product_id, name, price, stock, sort_order').order('sort_order'),
        supabase.from('wholesale_prices').select('id, product_id, variation_id, wholesale_price, min_quantity, is_active'),
        supabase.from('categories').select('id, name').order('name'),
      ]);
      if (products.error) throw products.error;
      if (variations.error) throw variations.error;
      if (wholesale.error) throw wholesale.error;
      if (categories.error) throw categories.error;
      return {
        products: (products.data || []) as ProductRow[],
        variations: (variations.data || []) as Variation[],
        wholesale: (wholesale.data || []) as WholesaleRow[],
        categories: (categories.data || []) as { id: string; name: string }[],
      };
    },
  });

  const wholesaleMap = useMemo(() => {
    const map: Record<string, WholesaleRow> = {};
    (data?.wholesale || []).forEach((w) => {
      map[keyFor(w.product_id, w.variation_id)] = w;
    });
    return map;
  }, [data]);

  const filteredProducts = useMemo(() => {
    const list = data?.products || [];
    return list.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(search.trim().toLowerCase());
      const matchesCategory = categoryId === 'all' || p.category_id === categoryId;
      return matchesSearch && matchesCategory;
    });
  }, [data, search, categoryId]);

  // Only the table is paged — the bulk "% off retail" action still applies to every
  // filtered product, not just the visible page.
  const {
    page,
    pageSize,
    totalPages,
    pageStart,
    pageItems: pagedProducts,
    goToPage,
    setPageSize,
  } = usePagination(filteredProducts, { resetKey: [search, categoryId] });

  const pricedCount = useMemo(
    () => (data?.products || []).filter((p) => wholesaleMap[keyFor(p.id, null)]).length,
    [data, wholesaleMap]
  );

  const getDraft = (productId: string, variationId: string | null) => {
    const k = keyFor(productId, variationId);
    if (drafts[k]) return drafts[k];
    const existing = wholesaleMap[k];
    return {
      price: existing ? String(existing.wholesale_price) : '',
      minQty: existing ? String(existing.min_quantity) : '1',
    };
  };

  const setDraft = (
    productId: string,
    variationId: string | null,
    patch: Partial<{ price: string; minQty: string }>
  ) => {
    const k = keyFor(productId, variationId);
    const current = getDraft(productId, variationId);
    setDrafts((prev) => ({ ...prev, [k]: { ...current, ...patch } }));
    setErrors((prev) => ({ ...prev, [k]: '' }));
  };

  const validate = (price: string, minQty: string): string | null => {
    const trimmed = price.trim();
    if (trimmed !== '') {
      const n = Number(trimmed);
      if (!Number.isFinite(n)) return 'Price must be a number';
      if (n < 0) return 'Price cannot be negative';
    }
    const q = Number(minQty.trim());
    if (!Number.isInteger(q) || q < 1) return 'Min quantity must be a whole number ≥ 1';
    return null;
  };

  const saveRow = async (productId: string, variationId: string | null) => {
    const k = keyFor(productId, variationId);
    const draft = getDraft(productId, variationId);
    const error = validate(draft.price, draft.minQty);
    if (error) {
      setErrors((prev) => ({ ...prev, [k]: error }));
      return;
    }

    setSavingKey(k);
    try {
      const existing = wholesaleMap[k];
      const priceText = draft.price.trim();

      if (priceText === '') {
        if (existing) {
          const { error: delError } = await supabase.from('wholesale_prices').delete().eq('id', existing.id);
          if (delError) throw delError;
          toast.success('Wholesale price removed');
        } else {
          toast.info('Nothing to save');
        }
      } else if (existing) {
        const { error: updError } = await supabase
          .from('wholesale_prices')
          .update({
            wholesale_price: Number(priceText),
            min_quantity: Number(draft.minQty),
          })
          .eq('id', existing.id);
        if (updError) throw updError;
        toast.success('Wholesale price updated');
      } else {
        const { error: insError } = await supabase.from('wholesale_prices').insert({
          product_id: productId,
          variation_id: variationId,
          wholesale_price: Number(priceText),
          min_quantity: Number(draft.minQty),
        });
        if (insError) throw insError;
        toast.success('Wholesale price added');
      }

      setDrafts((prev) => {
        const next = { ...prev };
        delete next[k];
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: ['admin-wholesale-prices'] });
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save wholesale price');
    } finally {
      setSavingKey(null);
    }
  };

  const runBulk = async () => {
    const percent = Number(bulkPercent);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      toast.error('Enter a percentage between 0 and 100');
      return;
    }
    setBulkRunning(true);
    try {
      // Each product is isolated: throwing on the first failure used to abandon the
      // rest, leaving the catalogue partially repriced with nothing on screen saying
      // which products had already changed.
      const failed: string[] = [];

      for (const product of filteredProducts) {
        const price = Math.round(Number(product.price) * (1 - percent / 100) * 100) / 100;
        const existing = wholesaleMap[keyFor(product.id, null)];

        const { error } = existing
          ? await supabase
              .from('wholesale_prices')
              .update({ wholesale_price: price })
              .eq('id', existing.id)
          : await supabase
              .from('wholesale_prices')
              .insert({ product_id: product.id, variation_id: null, wholesale_price: price, min_quantity: 1 });

        if (error) {
          console.error(`Bulk price update failed for ${product.name}:`, error);
          failed.push(product.name);
        }
      }

      setDrafts({});
      setBulkOpen(false);
      setBulkPercent('');

      const updated = filteredProducts.length - failed.length;
      if (failed.length === 0) {
        toast.success(`Updated ${updated} products`);
      } else {
        toast.warning(
          `Updated ${updated} of ${filteredProducts.length}. Failed: ${failed.slice(0, 5).join(', ')}${failed.length > 5 ? ` and ${failed.length - 5} more` : ''}`,
          { duration: 10000 }
        );
      }

      await queryClient.invalidateQueries({ queryKey: ['admin-wholesale-prices'] });
    } catch (e: any) {
      toast.error(e?.message || 'Bulk update failed');
    } finally {
      setBulkRunning(false);
    }
  };

  const margin = (retail: number, wholesale: number | null) => {
    if (wholesale === null || !retail) return '—';
    return `${Math.round(((retail - wholesale) / retail) * 100)}%`;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Tags className="h-6 w-6 text-primary" />
        <div>
          <h1 className="font-display text-2xl font-bold">Wholesale Prices</h1>
          <p className="text-sm text-muted-foreground">
            {pricedCount} of {data?.products.length || 0} products priced
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <CardTitle className="text-base">Catalogue</CardTitle>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="md:w-56">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {(data?.categories || []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="% off retail"
                value={bulkPercent}
                onChange={(e) => setBulkPercent(e.target.value)}
                className="w-32"
              />
              <Button
                variant="outline"
                disabled={!bulkPercent.trim() || filteredProducts.length === 0}
                onClick={() => setBulkOpen(true)}
              >
                Apply to filtered
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Product</TableHead>
                <TableHead>Retail</TableHead>
                <TableHead>Wholesale</TableHead>
                <TableHead>Min Qty</TableHead>
                <TableHead>Margin</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedProducts.map((product) => {
                const variations = (data?.variations || []).filter((v) => v.product_id === product.id);
                const k = keyFor(product.id, null);
                const draft = getDraft(product.id, null);
                const baseWholesale = draft.price.trim() === '' ? null : Number(draft.price);
                const isOpen = !!expanded[product.id];

                return (
                  <Fragment key={product.id}>
                    <TableRow>
                      <TableCell>
                        {variations.length > 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() =>
                              setExpanded((prev) => ({ ...prev, [product.id]: !prev[product.id] }))
                            }
                          >
                            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {product.images?.[0] && (
                            <img
                              src={product.images[0]}
                              alt={product.name}
                              loading="lazy"
                              className="h-10 w-10 rounded object-cover"
                            />
                          )}
                          <div>
                            <div className="font-medium">{product.name}</div>
                            {!product.is_active && (
                              <Badge variant="secondary" className="mt-1 text-xs">
                                inactive
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>৳{Number(product.price).toFixed(2)}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="—"
                          value={draft.price}
                          onChange={(e) => setDraft(product.id, null, { price: e.target.value })}
                          className="w-28"
                        />
                        {errors[k] && <p className="mt-1 text-xs text-destructive">{errors[k]}</p>}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          value={draft.minQty}
                          onChange={(e) => setDraft(product.id, null, { minQty: e.target.value })}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>{margin(Number(product.price), baseWholesale)}</TableCell>
                      <TableCell>{product.stock}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={savingKey === k}
                          onClick={() => saveRow(product.id, null)}
                        >
                          <Save className="mr-1 h-3.5 w-3.5" /> Save
                        </Button>
                      </TableCell>
                    </TableRow>

                    {isOpen &&
                      variations.map((variation) => {
                        const vk = keyFor(product.id, variation.id);
                        const vDraft = getDraft(product.id, variation.id);
                        const inherited = vDraft.price.trim() === '';
                        const effective = inherited ? baseWholesale : Number(vDraft.price);

                        return (
                          <TableRow key={variation.id} className="bg-muted/30">
                            <TableCell />
                            <TableCell className="pl-10 text-sm text-muted-foreground">
                              {variation.name}
                            </TableCell>
                            <TableCell>৳{Number(variation.price).toFixed(2)}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder={
                                  baseWholesale !== null ? `${baseWholesale} (inherited)` : 'inherited'
                                }
                                value={vDraft.price}
                                onChange={(e) => setDraft(product.id, variation.id, { price: e.target.value })}
                                className={`w-28 ${inherited ? 'placeholder:text-muted-foreground/60' : ''}`}
                              />
                              {errors[vk] && <p className="mt-1 text-xs text-destructive">{errors[vk]}</p>}
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="1"
                                step="1"
                                value={vDraft.minQty}
                                onChange={(e) => setDraft(product.id, variation.id, { minQty: e.target.value })}
                                className="w-20"
                              />
                            </TableCell>
                            <TableCell className={inherited ? 'text-muted-foreground/60' : ''}>
                              {margin(Number(variation.price), effective)}
                            </TableCell>
                            <TableCell>{variation.stock}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={savingKey === vk}
                                onClick={() => saveRow(product.id, variation.id)}
                              >
                                <Save className="mr-1 h-3.5 w-3.5" /> Save
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </Fragment>
                );
              })}
              {filteredProducts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    No products found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <DataPagination
        page={page}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={filteredProducts.length}
        pageStart={pageStart}
        onPageChange={goToPage}
        onPageSizeChange={setPageSize}
        itemLabel="products"
      />

      <AlertDialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply {bulkPercent}% off retail?</AlertDialogTitle>
            <AlertDialogDescription>
              This sets the product-level wholesale price for all {filteredProducts.length} filtered
              products. Existing prices will be overwritten. Variation prices are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkRunning}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                runBulk();
              }}
              disabled={bulkRunning}
            >
              {bulkRunning ? 'Applying...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>

      </AlertDialog>
    </div>
  );
}
