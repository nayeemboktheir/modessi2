import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
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
import { Plus, Pencil, Trash2, Image, ExternalLink, Upload, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadBanners();
  }, []);

  const loadBanners = async () => {
    try {
      const data = await getAllBanners();
      setBanners(data || []);
    } catch (error) {
      toast.error('Failed to load sliders');
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `slider-${Date.now()}.${fileExt}`;
      const filePath = `sliders/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('shop-assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('shop-assets')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, image_url: publicUrl }));
      toast.success('Image uploaded successfully');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.image_url) {
      toast.error('Please upload an image or enter an image URL');
      return;
    }

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
        toast.success('Slider updated successfully');
      } else {
        await createBanner(bannerData);
        toast.success('Slider created successfully');
      }

      setIsDialogOpen(false);
      loadBanners();
    } catch (error) {
      toast.error('Failed to save slider');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this slider?')) return;

    try {
      await deleteBanner(id);
      toast.success('Slider deleted successfully');
      loadBanners();
    } catch (error) {
      toast.error('Failed to delete slider');
    }
  };

  const handleToggleActive = async (banner: Banner) => {
    try {
      await updateBanner(banner.id, { is_active: !banner.is_active });
      toast.success(`Slider ${!banner.is_active ? 'activated' : 'deactivated'}`);
      loadBanners();
    } catch (error) {
      toast.error('Failed to update slider');
    }
  };

  const removeImage = () => {
    setFormData(prev => ({ ...prev, image_url: '' }));
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
          <h1 className="text-3xl font-display font-bold">Slider Settings</h1>
          <p className="text-muted-foreground">Manage homepage hero slider images, titles, and links</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Slider
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingBanner ? 'Edit Slider' : 'Add New Slider'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Image Upload Section */}
              <div className="space-y-2">
                <Label>Slider Image *</Label>
                
                {formData.image_url ? (
                  <div className="relative rounded-lg overflow-hidden border">
                    <img 
                      src={formData.image_url} 
                      alt="Preview" 
                      className="w-full h-40 object-cover"
                      onError={(e) => {
                        e.currentTarget.src = 'https://via.placeholder.com/800x400?text=Image+Error';
                      }}
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-8 w-8"
                      onClick={removeImage}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div 
                    className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Uploading...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="h-8 w-8 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Click to upload image</p>
                        <p className="text-xs text-muted-foreground">PNG, JPG up to 5MB</p>
                      </div>
                    )}
                  </div>
                )}
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">or paste URL</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                
                <Input
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  placeholder="https://example.com/slider.jpg"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Summer Collection 2026"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subtitle">Subtitle / Description</Label>
                <Textarea
                  id="subtitle"
                  value={formData.subtitle}
                  onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                  placeholder="e.g., Up to 50% off on selected items"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="link_url">Button Link URL</Label>
                <Input
                  id="link_url"
                  value={formData.link_url}
                  onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                  placeholder="/products or /category/summer"
                />
                <p className="text-xs text-muted-foreground">Where should the slider button link to?</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sort_order">Display Order</Label>
                  <Input
                    id="sort_order"
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                  />
                  <p className="text-xs text-muted-foreground">Lower numbers appear first</p>
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
                <Button type="submit" disabled={submitting || uploading}>
                  {submitting ? 'Saving...' : editingBanner ? 'Update Slider' : 'Create Slider'}
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
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-3 left-3 right-3 text-white">
                <h3 className="font-semibold text-lg">{banner.title}</h3>
                {banner.subtitle && (
                  <p className="text-sm opacity-90 line-clamp-2">{banner.subtitle}</p>
                )}
              </div>
            </div>
            <CardContent className="p-4">
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
              <p className="text-muted-foreground mb-2">No sliders yet.</p>
              <p className="text-sm text-muted-foreground">Create your first slider to display on the homepage hero section!</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
