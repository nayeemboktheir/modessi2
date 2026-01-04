import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Search, AlertTriangle, Package, Check } from 'lucide-react';
import { getAllProducts, updateProductStock } from '@/services/adminService';

interface Product {
  id: string;
  name: string;
  slug: string;
  images: string[] | null;
  stock: number;
  is_active: boolean | null;
  categories?: { id: string; name: string } | null;
}

export default function AdminInventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingStock, setEditingStock] = useState<{ id: string; stock: number } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const data = await getAllProducts();
      setProducts(data || []);
    } catch (error) {
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(search.toLowerCase())
  );

  const lowStockProducts = products.filter(p => p.stock < 10 && p.is_active);
  const outOfStockProducts = products.filter(p => p.stock === 0 && p.is_active);

  const handleStockUpdate = async (id: string, newStock: number) => {
    setSaving(true);
    try {
      await updateProductStock(id, newStock);
      toast.success('Stock updated successfully');
      setEditingStock(null);
      loadProducts();
    } catch (error) {
      toast.error('Failed to update stock');
    } finally {
      setSaving(false);
    }
  };

  const getStockBadge = (stock: number) => {
    if (stock === 0) {
      return <Badge variant="destructive">Out of Stock</Badge>;
    } else if (stock < 10) {
      return <Badge className="bg-accent text-accent-foreground">Low Stock</Badge>;
    } else {
      return <Badge variant="secondary">{stock} in stock</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
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
      <div>
        <h1 className="text-3xl font-display font-bold">Inventory</h1>
        <p className="text-muted-foreground">Monitor and manage product stock levels</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products.length}</div>
          </CardContent>
        </Card>
        <Card className="border-accent/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent">{lowStockProducts.length}</div>
            <p className="text-xs text-muted-foreground">Less than 10 units</p>
          </CardContent>
        </Card>
        <Card className="border-destructive/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{outOfStockProducts.length}</div>
            <p className="text-xs text-muted-foreground">Needs immediate restock</p>
          </CardContent>
        </Card>
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
                <TableHead>Current Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Update Stock</TableHead>
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
                      <span className="font-medium">{product.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {product.categories?.name || '-'}
                  </TableCell>
                  <TableCell>
                    {editingStock?.id === product.id ? (
                      <Input
                        type="number"
                        value={editingStock.stock}
                        onChange={(e) => setEditingStock({ 
                          ...editingStock, 
                          stock: parseInt(e.target.value) || 0 
                        })}
                        className="w-24"
                        autoFocus
                      />
                    ) : (
                      <span className="font-medium">{product.stock}</span>
                    )}
                  </TableCell>
                  <TableCell>{getStockBadge(product.stock)}</TableCell>
                  <TableCell className="text-right">
                    {editingStock?.id === product.id ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleStockUpdate(product.id, editingStock.stock)}
                          disabled={saving}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingStock(null)}
                          disabled={saving}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingStock({ id: product.id, stock: product.stock })}
                      >
                        Edit
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filteredProducts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
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
