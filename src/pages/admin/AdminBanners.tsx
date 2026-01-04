import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Image, ExternalLink } from 'lucide-react';
import { 
  getAllBanners, 
  createBanner, 
  updateBanner, 
  deleteBanner 
} from '@/services/adminService';

interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string;
  link_url: string | null;
  is_active: boolean | null;
  sort_order: number | null;
}

const initialFormState = {
  title: '',
  subtitle: '',
  image_url: '',
  link_url: '',
  is_active: true,
  sort_order: 0,
};

export default function AdminBanners() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [formData, setFormData] = useState(initialFormState);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadBanners();
  }, []);

  const loadBanners = async () => {
    try {
      const data = await getAllBanners();
      setBanners(data || []);
    } catch (error) {
      toast.error('Failed to load banners');
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingBanner(null);
    setFormData(initialFormState);
    setIsDialogOpen(true);
  };

  const openEditDialog = (banner: Banner) => {
    setEditingBanner(banner);
    setFormData({
      title: banner.title,
      subtitle: banner.subtitle || '',
      image_url: banner.image_url,
      link_url: banner.link_url || '',
      is_active: banner.is_active ?? true,
      sort_order: banner.sort_order || 0,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const bannerData = {
        title: formData.title,
        subtitle: formData.subtitle || undefined,
        image_url: formData.image_url,
        link_url: formData.link_url || undefined,
        is_active: formData.is_active,
        sort_order: formData.sort_order,
      };

      if (editingBanner) {
        await updateBanner(editingBanner.id, bannerData);
        toast.success('Banner updated successfully');
      } else {
        await createBanner(bannerData);
        toast.success('Banner created successfully');
      }

      setIsDialogOpen(false);
      loadBanners();
    } catch (error) {
      toast.error('Failed to save banner');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this banner?')) return;

    try {
      await deleteBanner(id);
      toast.success('Banner deleted successfully');
      loadBanners();
    } catch (error) {
      toast.error('Failed to delete banner');
    }
  };

  const handleToggleActive = async (banner: Banner) => {
    try {
      await updateBanner(banner.id, { is_active: !banner.is_active });
      toast.success(`Banner ${!banner.is_active ? 'activated' : 'deactivated'}`);
      loadBanners();
    } catch (error) {
      toast.error('Failed to update banner');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Banners</h1>
          <p className="text-muted-foreground">Manage homepage banners and promotions</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Banner
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingBanner ? 'Edit Banner' : 'Add New Banner'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subtitle">Subtitle</Label>
                <Input
                  id="subtitle"
                  value={formData.subtitle}
                  onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="image_url">Image URL *</Label>
                <Input
                  id="image_url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  placeholder="https://example.com/banner.jpg"
                  required
                />
              </div>

              {formData.image_url && (
                <div className="rounded-lg overflow-hidden border">
                  <img 
                    src={formData.image_url} 
                    alt="Preview" 
                    className="w-full h-32 object-cover"
                    onError={(e) => e.currentTarget.style.display = 'none'}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="link_url">Link URL</Label>
                <Input
                  id="link_url"
                  value={formData.link_url}
                  onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                  placeholder="/products or https://..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sort_order">Sort Order</Label>
                  <Input
                    id="sort_order"
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) })}
                  />
                </div>
                <div className="flex items-center gap-2 pt-8">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label htmlFor="is_active">Active</Label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Saving...' : editingBanner ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {banners.map((banner) => (
          <Card key={banner.id} className="overflow-hidden">
            <div className="relative aspect-[16/9]">
              <img
                src={banner.image_url}
                alt={banner.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 right-2 flex gap-1">
                <Badge variant={banner.is_active ? 'default' : 'secondary'}>
                  {banner.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-1">{banner.title}</h3>
              {banner.subtitle && (
                <p className="text-sm text-muted-foreground mb-3">{banner.subtitle}</p>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={banner.is_active ?? true}
                    onCheckedChange={() => handleToggleActive(banner)}
                  />
                  <span className="text-sm text-muted-foreground">
                    Order: {banner.sort_order}
                  </span>
                </div>
                <div className="flex gap-1">
                  {banner.link_url && (
                    <Button variant="ghost" size="icon" asChild>
                      <a href={banner.link_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(banner)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(banner.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {banners.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center">
              <Image className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No banners yet. Create your first banner!</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
