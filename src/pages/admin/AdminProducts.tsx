import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Search, Package, Upload, X, Image as ImageIcon, Loader2, Play } from 'lucide-react';
import { 
  getAllProducts, 
  createProduct, 
  updateProduct, 
  deleteProduct,
  getAllCategories 
} from '@/services/adminService';
import { supabase } from '@/integrations/supabase/client';

interface ProductVariation {
  id?: string;
  clientId: string; // local-only stable key for React lists
  name: string;
  price: number;
  original_price?: number;
  stock: number;
  sort_order: number;
  is_active: boolean;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  long_description: string | null;
  price: number;
  original_price: number | null;
  category_id: string | null;
  stock: number;
  images: string[] | null;
  video_url: string | null;
  tags: string[] | null;
  is_featured: boolean | null;
  is_new: boolean | null;
  is_active: boolean | null;
  categories?: { id: string; name: string } | null;
}

interface Category {
  id: string;
  name: string;
}

const initialFormState = {
  name: '',
  slug: '',
  description: '',
  short_description: '',
  long_description: '',
  price: 0,
  original_price: 0,
  category_id: '',
  stock: 0,
  images: '',
  video_url: '',
  tags: '',
  is_featured: false,
  is_new: false,
  is_active: true,
};

const defaultVariations: ProductVariation[] = [
  { clientId: crypto.randomUUID(), name: '1 KG', price: 0, stock: 100, sort_order: 1, is_active: true },
  { clientId: crypto.randomUUID(), name: '3 KG', price: 0, stock: 100, sort_order: 2, is_active: true },
  { clientId: crypto.randomUUID(), name: '5 KG', price: 0, stock: 100, sort_order: 3, is_active: true },
];

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState(initialFormState);
  const [submitting, setSubmitting] = useState(false);
  
  // Variations state
  const [variations, setVariations] = useState<ProductVariation[]>([]);
  const [hasVariations, setHasVariations] = useState(false);

  // Image upload state
  const [productImages, setProductImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [productsData, categoriesData] = await Promise.all([
        getAllProducts(),
        getAllCategories(),
      ]);
      setProducts(productsData || []);
      setCategories(categoriesData || []);
    } catch (error) {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const loadProductVariations = async (productId: string) => {
    const { data, error } = await supabase
      .from('product_variations')
      .select('*')
      .eq('product_id', productId)
      .order('sort_order');

    if (error) {
      console.error('Failed to load variations:', error);
      setVariations([]);
      setHasVariations(false);
      return;
    }

    if (data && data.length > 0) {
      setVariations(
        data.map((v) => ({
          id: v.id,
          clientId: v.id ?? crypto.randomUUID(),
          name: v.name,
          price: v.price,
          original_price: v.original_price || undefined,
          stock: v.stock,
          sort_order: v.sort_order || 0,
          is_active: v.is_active ?? true,
        }))
      );
      setHasVariations(true);
    } else {
      setVariations([]);
      setHasVariations(false);
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(search.toLowerCase())
  );

  const openCreateDialog = () => {
    setEditingProduct(null);
    setFormData(initialFormState);
    setVariations([]);
    setHasVariations(false);
    setProductImages([]);
    setIsDialogOpen(true);
  };

  const openEditDialog = async (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      slug: product.slug,
      description: product.description || '',
      short_description: product.short_description || '',
      long_description: product.long_description || '',
      price: product.price,
      original_price: product.original_price || 0,
      category_id: product.category_id || '',
      stock: product.stock,
      images: '',
      video_url: product.video_url || '',
      tags: product.tags?.join(', ') || '',
      is_featured: product.is_featured || false,
      is_new: product.is_new || false,
      is_active: product.is_active ?? true,
    });
    setProductImages(product.images || []);
    await loadProductVariations(product.id);
    setIsDialogOpen(true);
  };

  // Image upload handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingImage(true);
    
    try {
      for (const file of Array.from(files)) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          toast.error(`${file.name} is not an image`);
          continue;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} is too large (max 5MB)`);
          continue;
        }

        // Generate unique filename
        const fileExt = file.name.split('.').pop();
        const fileName = `products/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
          .from('shop-assets')
          .upload(fileName, file);

        if (error) {
          console.error('Upload error:', error);
          toast.error(`Failed to upload ${file.name}`);
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('shop-assets')
          .getPublicUrl(fileName);

        setProductImages(prev => [...prev, urlData.publicUrl]);
        toast.success(`${file.name} uploaded successfully`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload images');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = (index: number) => {
    setProductImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddImageUrl = () => {
    const url = formData.images.trim();
    if (url && url.startsWith('http')) {
      setProductImages(prev => [...prev, url]);
      setFormData({ ...formData, images: '' });
    }
  };

  const handleAddVariation = () => {
    setVariations([
      ...variations,
      {
        clientId: crypto.randomUUID(),
        name: '',
        price: 0,
        stock: 100,
        sort_order: variations.length + 1,
        is_active: true,
      },
    ]);
  };

  const handleAddDefaultVariations = () => {
    setVariations(defaultVariations.map((v) => ({ ...v, clientId: crypto.randomUUID() })));
    setHasVariations(true);
  };

  const handleRemoveVariation = (clientId: string) => {
    setVariations((prev) => prev.filter((v) => v.clientId !== clientId));
  };

  const handleVariationChange = (
    clientId: string,
    field: keyof ProductVariation,
    value: any
  ) => {
    setVariations((prev) =>
      prev.map((v) => (v.clientId === clientId ? { ...v, [field]: value } : v))
    );
  };

  const saveVariations = async (productId: string) => {
    // Delete existing variations
    await supabase
      .from('product_variations')
      .delete()
      .eq('product_id', productId);
    
    // Insert new variations
    if (hasVariations && variations.length > 0) {
      const validVariations = variations.filter((v) => v.name && v.price > 0);
      if (validVariations.length > 0) {
        const { error } = await supabase
          .from('product_variations')
          .insert(
            validVariations.map((v, idx) => ({
              product_id: productId,
              name: v.name,
              price: v.price,
              original_price: v.original_price || null,
              stock: v.stock,
              sort_order: idx + 1,
              is_active: v.is_active,
            }))
          );
        
        if (error) {
          console.error('Failed to save variations:', error);
          toast.error('Failed to save variations');
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const productData = {
        name: formData.name,
        slug: formData.slug || formData.name.toLowerCase().replace(/\s+/g, '-'),
        description: formData.description || undefined,
        short_description: formData.short_description || undefined,
        long_description: formData.long_description || undefined,
        price: formData.price,
        original_price: formData.original_price || undefined,
        category_id: formData.category_id || undefined,
        stock: formData.stock,
        images: productImages.length > 0 ? productImages : [],
        video_url: formData.video_url || undefined,
        tags: formData.tags ? formData.tags.split(',').map(s => s.trim()) : [],
        is_featured: formData.is_featured,
        is_new: formData.is_new,
        is_active: formData.is_active,
      };

      let productId: string;

      if (editingProduct) {
        await updateProduct(editingProduct.id, productData);
        productId = editingProduct.id;
        toast.success('Product updated successfully');
      } else {
        const newProduct = await createProduct(productData);
        productId = newProduct.id;
        toast.success('Product created successfully');
      }

      // Save variations
      await saveVariations(productId);

      setIsDialogOpen(false);
      loadData();
    } catch (error) {
      toast.error('Failed to save product');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      // Delete variations first
      await supabase.from('product_variations').delete().eq('product_id', id);
      await deleteProduct(id);
      toast.success('Product deleted successfully');
      loadData();
    } catch (error) {
      toast.error('Failed to delete product');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <CardContent className="p-0">
            <div className="space-y-4 p-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Products</h1>
          <p className="text-muted-foreground">Manage your product catalog</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="auto-generated if empty"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="short_description">Short Description (প্রোডাক্টের পাশে দেখাবে)</Label>
                <Textarea
                  id="short_description"
                  value={formData.short_description}
                  onChange={(e) => setFormData({ ...formData, short_description: e.target.value })}
                  rows={3}
                  placeholder="প্রোডাক্ট ইমেজের পাশে সংক্ষিপ্ত বিবরণ"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="long_description">Long Description (প্রোডাক্ট পেজের নিচে দেখাবে)</Label>
                <Textarea
                  id="long_description"
                  value={formData.long_description}
                  onChange={(e) => setFormData({ ...formData, long_description: e.target.value })}
                  rows={6}
                  placeholder="বিস্তারিত বিবরণ - ফিচার, উপকরণ, ব্যবহার ইত্যাদি"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Base Price *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="original_price">Original Price</Label>
                  <Input
                    id="original_price"
                    type="number"
                    step="0.01"
                    value={formData.original_price}
                    onChange={(e) => setFormData({ ...formData, original_price: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stock">Stock *</Label>
                  <Input
                    id="stock"
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Product Images Section */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  প্রোডাক্ট ছবি (Product Images)
                </Label>
                
                {/* Image Preview Grid */}
                {productImages.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {productImages.map((img, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={img}
                          alt={`Product ${index + 1}`}
                          className="w-20 h-20 object-cover rounded-lg border border-border"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(index)}
                          className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload Button */}
                <div className="flex gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    multiple
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="gap-2"
                  >
                    {uploadingImage ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        আপলোড হচ্ছে...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        ছবি আপলোড করুন
                      </>
                    )}
                  </Button>
                </div>

                {/* URL Input */}
                <div className="flex gap-2">
                  <Input
                    id="images"
                    value={formData.images}
                    onChange={(e) => setFormData({ ...formData, images: e.target.value })}
                    placeholder="Or paste image URL here..."
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleAddImageUrl}
                    disabled={!formData.images.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Product Video Section */}
              <div className="space-y-2">
                <Label htmlFor="video_url" className="flex items-center gap-2">
                  <Play className="h-4 w-4" />
                  প্রোডাক্ট ভিডিও (Product Video)
                </Label>
                <Textarea
                  id="video_url"
                  value={formData.video_url}
                  onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
                  placeholder="YouTube/Facebook লিংক অথবা Facebook Embed কোড (<iframe...>) পেস্ট করুন"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  সাপোর্টেড: YouTube, YouTube Shorts, Facebook Video, Facebook Reel, সরাসরি ভিডিও URL (.mp4), অথবা Facebook Embed Code
                </p>
                <p className="text-xs text-muted-foreground">
                  উদাহরণ: https://www.facebook.com/reel/123456789 অথবা সম্পূর্ণ &lt;iframe...&gt; কোড
                </p>
                {formData.video_url && (
                  <div className="mt-2 p-2 bg-muted rounded-lg flex items-center gap-2">
                    <span className="text-green-600">✓</span>
                    <p className="text-sm text-muted-foreground">ভিডিও যুক্ত হয়েছে - ল্যান্ডিং পেজে স্বয়ংক্রিয়ভাবে সঠিক সাইজে দেখা যাবে</p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input
                  id="tags"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="electronics, gadgets, new"
                />
              </div>

              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label htmlFor="is_active">Active</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="is_featured"
                    checked={formData.is_featured}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_featured: checked })}
                  />
                  <Label htmlFor="is_featured">Featured</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="is_new"
                    checked={formData.is_new}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_new: checked })}
                  />
                  <Label htmlFor="is_new">New</Label>
                </div>
              </div>

              {/* Weight Variations Section */}
              <div className="border-t pt-4 mt-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    <Label className="text-base font-semibold">ওজন ভ্যারিয়েশন (Weight Variations)</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="hasVariations"
                      checked={hasVariations}
                      onCheckedChange={(checked) => {
                        setHasVariations(checked);
                        if (checked && variations.length === 0) {
                          handleAddDefaultVariations();
                        }
                      }}
                    />
                    <Label htmlFor="hasVariations" className="text-sm">Enable</Label>
                  </div>
                </div>

                {hasVariations && (
                  <div className="space-y-3 bg-muted/50 rounded-lg p-4">
                    <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground mb-2">
                      <div className="col-span-3">ওজন (Weight)</div>
                      <div className="col-span-3">দাম (Price) ৳</div>
                      <div className="col-span-3">আগের দাম</div>
                      <div className="col-span-2">স্টক</div>
                      <div className="col-span-1"></div>
                    </div>
                    
                    {variations.map((variation) => (
                      <div key={variation.clientId} className="grid grid-cols-12 gap-2 items-center">
                        <Input
                          className="col-span-3"
                          placeholder="1 KG"
                          value={variation.name}
                          onChange={(e) => handleVariationChange(variation.clientId, 'name', e.target.value)}
                        />
                        <Input
                          className="col-span-3"
                          type="number"
                          placeholder="950"
                          value={variation.price || ''}
                          onChange={(e) =>
                            handleVariationChange(
                              variation.clientId,
                              'price',
                              parseFloat(e.target.value) || 0
                            )
                          }
                        />
                        <Input
                          className="col-span-3"
                          type="number"
                          placeholder="Optional"
                          value={variation.original_price || ''}
                          onChange={(e) =>
                            handleVariationChange(
                              variation.clientId,
                              'original_price',
                              parseFloat(e.target.value) || undefined
                            )
                          }
                        />
                        <Input
                          className="col-span-2"
                          type="number"
                          value={variation.stock}
                          onChange={(e) =>
                            handleVariationChange(
                              variation.clientId,
                              'stock',
                              parseInt(e.target.value) || 0
                            )
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="col-span-1"
                          onClick={() => handleRemoveVariation(variation.clientId)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddVariation}
                      className="mt-2"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      আরো যোগ করুন
                    </Button>

                    <p className="text-xs text-muted-foreground mt-2">
                      💡 ৫ কেজি ভ্যারিয়েশনে ফ্রি ডেলিভারি দেখানো হবে
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Saving...' : editingProduct ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {product.images?.[0] && (
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="h-10 w-10 rounded object-cover"
                        />
                      )}
                      <div>
                        <div className="font-medium">{product.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {product.slug}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{product.categories?.name || '-'}</TableCell>
                  <TableCell>৳{product.price.toFixed(0)}</TableCell>
                  <TableCell>
                    <Badge variant={product.stock < 10 ? 'destructive' : 'secondary'}>
                      {product.stock}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={product.is_active ? 'default' : 'outline'}>
                      {product.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(product)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(product.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredProducts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No products found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
