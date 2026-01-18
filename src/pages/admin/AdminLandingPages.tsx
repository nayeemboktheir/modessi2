import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus, Edit, Trash2, Eye, EyeOff, ExternalLink, Copy, Package, TrendingUp, ShoppingCart, Pencil, Search, CalendarIcon, X, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { format, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

interface LandingPage {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  images: string[] | null;
  is_active: boolean;
}

interface Order {
  id: string;
  notes: string | null;
  total: number;
  order_source: string;
  created_at: string;
}

const AdminLandingPages = () => {
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editSlugPage, setEditSlugPage] = useState<LandingPage | null>(null);
  const [newSlug, setNewSlug] = useState("");
  const [editProductSlug, setEditProductSlug] = useState<Product | null>(null);
  const [newProductSlug, setNewProductSlug] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const { data: landingPages, isLoading } = useQuery({
    queryKey: ["admin-landing-pages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landing_pages")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as LandingPage[];
    },
  });

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["admin-products-for-landing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, slug, images, is_active")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data as Product[];
    },
  });

  // Fetch orders from landing pages (we identify landing orders by notes prefix "LP:")
  const { data: landingOrders } = useQuery({
    queryKey: ["landing-page-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, notes, total, order_source, created_at")
        .like("notes", "LP:%")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Order[];
    },
  });

  // Calculate sales stats per slug with optional date filtering
  const salesBySlug = useMemo(() => {
    const stats: Record<string, { orders: number; revenue: number }> = {};
    
    landingOrders?.forEach((order) => {
      // Date filtering
      if (dateRange?.from) {
        const orderDate = new Date(order.created_at);
        const start = startOfDay(dateRange.from);
        const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
        
        if (!isWithinInterval(orderDate, { start, end })) {
          return;
        }
      }
      
      // Extract slug from notes like "LP:product-slug"
      const match = order.notes?.match(/LP:([^\s]+)/);
      if (match) {
        const slug = match[1];
        if (!stats[slug]) {
          stats[slug] = { orders: 0, revenue: 0 };
        }
        stats[slug].orders += 1;
        stats[slug].revenue += Number(order.total) || 0;
      }
    });
    
    return stats;
  }, [landingOrders, dateRange]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("landing_pages")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-landing-pages"] });
      toast.success("Landing page deleted");
      setDeleteId(null);
    },
    onError: (error) => {
      toast.error("Failed to delete landing page");
      console.error(error);
    },
  });

  const togglePublishMutation = useMutation({
    mutationFn: async ({ id, is_published }: { id: string; is_published: boolean }) => {
      const { error } = await supabase
        .from("landing_pages")
        .update({ is_published, is_active: is_published })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-landing-pages"] });
      toast.success("Landing page updated");
    },
    onError: (error) => {
      toast.error("Failed to update landing page");
      console.error(error);
    },
  });

  const updateSlugMutation = useMutation({
    mutationFn: async ({ id, slug }: { id: string; slug: string }) => {
      const { error } = await supabase
        .from("landing_pages")
        .update({ slug })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-landing-pages"] });
      toast.success("Slug updated successfully");
      setEditSlugPage(null);
      setNewSlug("");
    },
    onError: (error) => {
      toast.error("Failed to update slug");
      console.error(error);
    },
  });

  const copyMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: original, error: fetchError } = await supabase
        .from("landing_pages")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      const copiedSlug = `${original.slug}-copy-${Date.now()}`;
      const { id: _id, created_at: _created, updated_at: _updated, ...rest } = original;
      
      const { error: insertError } = await supabase
        .from("landing_pages")
        .insert({
          ...rest,
          title: `${original.title} (Copy)`,
          slug: copiedSlug,
          is_published: false,
          is_active: false,
        });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-landing-pages"] });
      toast.success("Landing page copied successfully");
    },
    onError: (error) => {
      toast.error("Failed to copy landing page");
      console.error(error);
    },
  });

  const updateProductSlugMutation = useMutation({
    mutationFn: async ({ id, slug }: { id: string; slug: string }) => {
      const { error } = await supabase
        .from("products")
        .update({ slug })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products-for-landing"] });
      toast.success("Product slug updated successfully");
      setEditProductSlug(null);
      setNewProductSlug("");
    },
    onError: (error: any) => {
      if (error?.message?.includes("duplicate") || error?.code === "23505") {
        toast.error("This slug is already in use by another product");
      } else {
        toast.error("Failed to update product slug");
      }
      console.error(error);
    },
  });

  // Calculate total stats
  const totalOrders = landingOrders?.length || 0;
  const totalRevenue = landingOrders?.reduce((sum, o) => sum + (Number(o.total) || 0), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Landing Pages</h1>
          <p className="text-muted-foreground">
            Create and manage product landing pages
          </p>
        </div>
        <Button asChild>
          <Link to="/admin/landing-pages/new">
            <Plus className="mr-2 h-4 w-4" />
            Add New
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <ShoppingCart className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Orders</p>
                <p className="text-2xl font-bold">{totalOrders}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <TrendingUp className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">৳{totalRevenue.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <Package className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Pages</p>
                <p className="text-2xl font-bold">
                  {(landingPages?.filter(p => p.is_published).length || 0) + (products?.length || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Custom Landing Pages */}
      <Card>
        <CardHeader>
          <CardTitle>Custom Landing Pages</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading...
            </div>
          ) : !landingPages?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              No landing pages yet. Create your first one!
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sales</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {landingPages.map((page) => {
                  const stats = salesBySlug[page.slug] || { orders: 0, revenue: 0 };
                  return (
                    <TableRow key={page.id}>
                      <TableCell className="font-medium">{page.title}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="text-sm bg-muted px-2 py-1 rounded">
                            /lp/{page.slug}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => {
                              setEditSlugPage(page);
                              setNewSlug(page.slug);
                            }}
                            title="Edit slug"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={page.is_published ? "default" : "secondary"}
                        >
                          {page.is_published ? "Published" : "Draft"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {stats.orders} orders
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-green-600">
                          ৳{stats.revenue.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell>
                        {format(new Date(page.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              togglePublishMutation.mutate({
                                id: page.id,
                                is_published: !page.is_published,
                              })
                            }
                            title={page.is_published ? "Unpublish" : "Publish"}
                          >
                            {page.is_published ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            asChild
                            title="View page"
                          >
                            <a
                              href={`/lp/${page.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copyMutation.mutate(page.id)}
                            title="Copy landing page"
                            disabled={copyMutation.isPending}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" asChild title="Edit">
                            <Link to={`/admin/landing-pages/${page.id}`}>
                              <Edit className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(page.id)}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Special Collection Landing Pages */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-rose-500" />
            Special Collection Pages
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Custom landing pages for product collections
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Collection Name</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Products</TableHead>
                <TableHead>Sales</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Cotton Tarsel Collection */}
              {(() => {
                const collectionSlug = 'cotton-tarsel-collection';
                const stats = salesBySlug[collectionSlug] || { orders: 0, revenue: 0 };
                return (
                  <TableRow>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-rose-100 to-pink-100 flex items-center justify-center">
                          <Sparkles className="h-5 w-5 text-rose-500" />
                        </div>
                        <div>
                          <p className="font-medium">Cotton Tarsel Collection</p>
                          <p className="text-xs text-muted-foreground">Light Pink & Blue variants</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-sm bg-muted px-2 py-1 rounded">/cotton-tarsel</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">2 products</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {stats.orders} orders
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-green-600">
                        ৳{stats.revenue.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                        >
                          <a
                            href="/cotton-tarsel"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            View
                          </a>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/cotton-tarsel`);
                            toast.success("URL copied to clipboard!");
                          }}
                        >
                          <Copy className="h-4 w-4 mr-1" />
                          Copy URL
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })()}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Product Landing Pages Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Product Landing Pages
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Auto-generated landing pages for each product at /step/[slug]
          </p>
        </CardHeader>
        <CardContent>
          {/* Search Bar and Date Filter */}
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Date Range Filter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal min-w-[240px]",
                    !dateRange && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "dd/MM/yyyy")} - {format(dateRange.to, "dd/MM/yyyy")}
                      </>
                    ) : (
                      format(dateRange.from, "dd/MM/yyyy")
                    )
                  ) : (
                    <span>তারিখ অনুসারে ফিল্টার</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            
            {dateRange && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDateRange(undefined)}
                className="text-destructive"
              >
                <X className="h-4 w-4 mr-1" />
                ক্লিয়ার
              </Button>
            )}
          </div>
          
          {productsLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading products...
            </div>
          ) : !products?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              No active products found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Landing URL</TableHead>
                  <TableHead>Sales</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products
                  .filter((product) => 
                    product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                    product.slug.toLowerCase().includes(productSearch.toLowerCase())
                  )
                  .map((product) => {
                  const stats = salesBySlug[product.slug] || { orders: 0, revenue: 0 };
                  return (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          {product.images?.[0] && (
                            <img
                              src={product.images[0]}
                              alt={product.name}
                              className="w-10 h-10 object-cover rounded"
                            />
                          )}
                          {product.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="text-sm bg-muted px-2 py-1 rounded">
                            /step/{product.slug}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => {
                              setEditProductSlug(product);
                              setNewProductSlug(product.slug);
                            }}
                            title="Edit slug"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {stats.orders} orders
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-green-600">
                          ৳{stats.revenue.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                          >
                            <a
                              href={`/step/${product.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4 mr-1" />
                              View
                            </a>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/step/${product.slug}`);
                              toast.success("URL copied to clipboard");
                            }}
                          >
                            <Copy className="h-4 w-4 mr-1" />
                            Copy URL
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Landing Page?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The landing page will be permanently
              deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Slug Dialog for Custom Landing Pages */}
      <Dialog open={!!editSlugPage} onOpenChange={() => setEditSlugPage(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Landing Page URL</DialogTitle>
            <DialogDescription>
              Change the slug for "{editSlugPage?.title}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="slug">URL Slug</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{window.location.origin}/lp/</span>
                <Input
                  id="slug"
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  placeholder="your-page-slug"
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Only lowercase letters, numbers, and hyphens are allowed.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSlugPage(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editSlugPage && newSlug) {
                  updateSlugMutation.mutate({ id: editSlugPage.id, slug: newSlug });
                }
              }}
              disabled={!newSlug || updateSlugMutation.isPending}
            >
              {updateSlugMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Slug Dialog for Product Landing Pages */}
      <Dialog open={!!editProductSlug} onOpenChange={() => setEditProductSlug(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Product Landing Page URL</DialogTitle>
            <DialogDescription>
              Change the slug for "{editProductSlug?.name}". This will also update the product's URL.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <Label htmlFor="product-slug">URL Slug</Label>
              <div className="text-sm text-muted-foreground break-all">
                {window.location.origin}/step/
              </div>
              <Input
                id="product-slug"
                value={newProductSlug}
                onChange={(e) => setNewProductSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                placeholder="product-slug"
              />
              <p className="text-xs text-muted-foreground">
                Only lowercase letters, numbers, and hyphens are allowed.
              </p>
              <p className="text-xs text-amber-600 font-medium">
                ⚠️ This will change the product's URL everywhere (including /products/{editProductSlug?.slug})
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProductSlug(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editProductSlug && newProductSlug) {
                  updateProductSlugMutation.mutate({ id: editProductSlug.id, slug: newProductSlug });
                }
              }}
              disabled={!newProductSlug || updateProductSlugMutation.isPending}
            >
              {updateProductSlugMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminLandingPages;
