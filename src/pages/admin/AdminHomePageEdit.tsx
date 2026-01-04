import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Save, Image as ImageIcon, Upload, Plus, Trash2 } from 'lucide-react';

interface HomePageContent {
  [key: string]: any;
}

const AdminHomePageEdit = () => {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [content, setContent] = useState<HomePageContent>({});
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    fetchContent();
  }, []);

  const fetchContent = async () => {
    try {
      const { data, error } = await supabase
        .from('home_page_content')
        .select('*');

      if (error) throw error;

      const contentMap: HomePageContent = {};
      data?.forEach((item: any) => {
        contentMap[item.section_key] = item.content;
      });
      setContent(contentMap);
    } catch (error) {
      console.error('Error fetching content:', error);
      toast.error('কন্টেন্ট লোড করতে সমস্যা হয়েছে');
    } finally {
      setIsLoading(false);
    }
  };

  const updateSection = (sectionKey: string, field: string, value: any) => {
    setContent(prev => ({
      ...prev,
      [sectionKey]: {
        ...prev[sectionKey],
        [field]: value
      }
    }));
  };

  const updateNestedSection = (sectionKey: string, nestedKey: string, field: string, value: any) => {
    setContent(prev => ({
      ...prev,
      [sectionKey]: {
        ...prev[sectionKey],
        [nestedKey]: {
          ...prev[sectionKey]?.[nestedKey],
          [field]: value
        }
      }
    }));
  };

  const updateTestimonial = (index: number, field: string, value: string) => {
    setContent(prev => {
      const items = [...(prev.testimonials?.items || [])];
      items[index] = { ...items[index], [field]: value };
      return {
        ...prev,
        testimonials: {
          ...prev.testimonials,
          items
        }
      };
    });
  };

  const addTestimonial = () => {
    setContent(prev => {
      const items = [...(prev.testimonials?.items || [])];
      items.push({ name: '', location: '', text: '' });
      return {
        ...prev,
        testimonials: {
          ...prev.testimonials,
          items
        }
      };
    });
  };

  const removeTestimonial = (index: number) => {
    setContent(prev => {
      const items = [...(prev.testimonials?.items || [])];
      items.splice(index, 1);
      return {
        ...prev,
        testimonials: {
          ...prev.testimonials,
          items
        }
      };
    });
  };

  const updateFeature = (index: number, field: string, value: string) => {
    setContent(prev => {
      const items = [...(prev.features?.items || [])];
      items[index] = { ...items[index], [field]: value };
      return {
        ...prev,
        features: {
          ...prev.features,
          items
        }
      };
    });
  };

  const handleImageUpload = async (file: File, sectionKey: string, imageField: string, nestedKey?: string) => {
    const uploadKey = `${sectionKey}-${nestedKey || ''}-${imageField}`;
    setUploadingImage(uploadKey);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `home-page/${sectionKey}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('shop-assets')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('shop-assets')
        .getPublicUrl(fileName);

      if (nestedKey) {
        updateNestedSection(sectionKey, nestedKey, imageField, publicUrl);
      } else {
        updateSection(sectionKey, imageField, publicUrl);
      }
      
      toast.success('ছবি আপলোড সফল হয়েছে');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('ছবি আপলোড করতে সমস্যা হয়েছে');
    } finally {
      setUploadingImage(null);
    }
  };

  const saveContent = async () => {
    setIsSaving(true);
    try {
      for (const [sectionKey, sectionContent] of Object.entries(content)) {
        const { error } = await supabase
          .from('home_page_content')
          .update({ content: sectionContent })
          .eq('section_key', sectionKey);

        if (error) throw error;
      }
      toast.success('সব পরিবর্তন সেভ হয়েছে!');
    } catch (error) {
      console.error('Error saving content:', error);
      toast.error('সেভ করতে সমস্যা হয়েছে');
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  const ImageUploadField = ({ 
    label, 
    currentImage, 
    sectionKey, 
    imageField, 
    nestedKey 
  }: { 
    label: string; 
    currentImage: string; 
    sectionKey: string; 
    imageField: string; 
    nestedKey?: string;
  }) => {
    const uploadKey = `${sectionKey}-${nestedKey || ''}-${imageField}`;
    const isUploading = uploadingImage === uploadKey;
    
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <div className="flex items-center gap-4">
          {currentImage && (
            <img 
              src={currentImage} 
              alt={label} 
              className="h-20 w-20 object-cover rounded-lg border"
            />
          )}
          <div className="flex-1">
            <Input
              value={currentImage || ''}
              onChange={(e) => {
                if (nestedKey) {
                  updateNestedSection(sectionKey, nestedKey, imageField, e.target.value);
                } else {
                  updateSection(sectionKey, imageField, e.target.value);
                }
              }}
              placeholder="ছবির URL দিন বা আপলোড করুন"
            />
          </div>
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleImageUpload(file, sectionKey, imageField, nestedKey);
                }
              }}
            />
            <Button type="button" variant="outline" size="icon" disabled={isUploading} asChild>
              <span>
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              </span>
            </Button>
          </label>
        </div>
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">হোম পেজ এডিট</h1>
            <p className="text-muted-foreground">হোম পেজের সব টেক্সট ও ছবি পরিবর্তন করুন</p>
          </div>
          <Button onClick={saveContent} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Save className="h-4 w-4 ml-2" />}
            সেভ করুন
          </Button>
        </div>

        <Tabs defaultValue="hero" className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="hero">হিরো সেকশন</TabsTrigger>
            <TabsTrigger value="about">আমাদের সম্পর্কে</TabsTrigger>
            <TabsTrigger value="promo">প্রমো ব্যানার</TabsTrigger>
            <TabsTrigger value="products">প্রোডাক্ট সেকশন</TabsTrigger>
            <TabsTrigger value="features">ফিচার্স</TabsTrigger>
            <TabsTrigger value="why_choose">কেন আমাদের</TabsTrigger>
            <TabsTrigger value="testimonials">গ্রাহক রিভিউ</TabsTrigger>
          </TabsList>

          {/* Hero Section */}
          <TabsContent value="hero">
            <Card>
              <CardHeader>
                <CardTitle>হিরো সেকশন</CardTitle>
                <CardDescription>পেজের প্রথম অংশের টেক্সট পরিবর্তন করুন</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>শিরোনাম (প্রথম লাইন)</Label>
                    <Input
                      value={content.hero?.title || ''}
                      onChange={(e) => updateSection('hero', 'title', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>শিরোনাম (দ্বিতীয় লাইন)</Label>
                    <Input
                      value={content.hero?.subtitle || ''}
                      onChange={(e) => updateSection('hero', 'subtitle', e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>বিবরণ</Label>
                  <Textarea
                    value={content.hero?.description || ''}
                    onChange={(e) => updateSection('hero', 'description', e.target.value)}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>বাটন টেক্সট</Label>
                    <Input
                      value={content.hero?.buttonText || ''}
                      onChange={(e) => updateSection('hero', 'buttonText', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>ব্যাজ শিরোনাম</Label>
                    <Input
                      value={content.hero?.badgeTitle || ''}
                      onChange={(e) => updateSection('hero', 'badgeTitle', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>ব্যাজ সাবটাইটেল</Label>
                    <Input
                      value={content.hero?.badgeSubtitle || ''}
                      onChange={(e) => updateSection('hero', 'badgeSubtitle', e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* About Section */}
          <TabsContent value="about">
            <Card>
              <CardHeader>
                <CardTitle>আমাদের সম্পর্কে</CardTitle>
                <CardDescription>About সেকশনের কন্টেন্ট পরিবর্তন করুন</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>ট্যাগলাইন</Label>
                    <Input
                      value={content.about?.tagline || ''}
                      onChange={(e) => updateSection('about', 'tagline', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>শিরোনাম</Label>
                    <Input
                      value={content.about?.title || ''}
                      onChange={(e) => updateSection('about', 'title', e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>ব্যাজ ১</Label>
                    <Input
                      value={content.about?.badge1 || ''}
                      onChange={(e) => updateSection('about', 'badge1', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>ব্যাজ ২</Label>
                    <Input
                      value={content.about?.badge2 || ''}
                      onChange={(e) => updateSection('about', 'badge2', e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>প্যারাগ্রাফ ১</Label>
                  <Textarea
                    value={content.about?.paragraph1 || ''}
                    onChange={(e) => updateSection('about', 'paragraph1', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>প্যারাগ্রাফ ২</Label>
                  <Textarea
                    value={content.about?.paragraph2 || ''}
                    onChange={(e) => updateSection('about', 'paragraph2', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>উদ্ধৃতি</Label>
                  <Textarea
                    value={content.about?.quote || ''}
                    onChange={(e) => updateSection('about', 'quote', e.target.value)}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>অভিজ্ঞতা বছর</Label>
                    <Input
                      value={content.about?.experienceYears || ''}
                      onChange={(e) => updateSection('about', 'experienceYears', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>অভিজ্ঞতা টেক্সট</Label>
                    <Input
                      value={content.about?.experienceText || ''}
                      onChange={(e) => updateSection('about', 'experienceText', e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Promo Banners */}
          <TabsContent value="promo">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>ব্যানার ১</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ImageUploadField
                    label="ছবি"
                    currentImage={content.promo_banners?.banner1?.image || ''}
                    sectionKey="promo_banners"
                    imageField="image"
                    nestedKey="banner1"
                  />
                  <div className="space-y-2">
                    <Label>ট্যাগলাইন</Label>
                    <Input
                      value={content.promo_banners?.banner1?.tagline || ''}
                      onChange={(e) => updateNestedSection('promo_banners', 'banner1', 'tagline', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>শিরোনাম (প্রথম লাইন)</Label>
                    <Input
                      value={content.promo_banners?.banner1?.title || ''}
                      onChange={(e) => updateNestedSection('promo_banners', 'banner1', 'title', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>শিরোনাম (দ্বিতীয় লাইন)</Label>
                    <Input
                      value={content.promo_banners?.banner1?.subtitle || ''}
                      onChange={(e) => updateNestedSection('promo_banners', 'banner1', 'subtitle', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>বাটন টেক্সট</Label>
                    <Input
                      value={content.promo_banners?.banner1?.buttonText || ''}
                      onChange={(e) => updateNestedSection('promo_banners', 'banner1', 'buttonText', e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>ব্যানার ২</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ImageUploadField
                    label="ছবি"
                    currentImage={content.promo_banners?.banner2?.image || ''}
                    sectionKey="promo_banners"
                    imageField="image"
                    nestedKey="banner2"
                  />
                  <div className="space-y-2">
                    <Label>ট্যাগলাইন</Label>
                    <Input
                      value={content.promo_banners?.banner2?.tagline || ''}
                      onChange={(e) => updateNestedSection('promo_banners', 'banner2', 'tagline', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>শিরোনাম (প্রথম লাইন)</Label>
                    <Input
                      value={content.promo_banners?.banner2?.title || ''}
                      onChange={(e) => updateNestedSection('promo_banners', 'banner2', 'title', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>শিরোনাম (দ্বিতীয় লাইন)</Label>
                    <Input
                      value={content.promo_banners?.banner2?.subtitle || ''}
                      onChange={(e) => updateNestedSection('promo_banners', 'banner2', 'subtitle', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>বাটন টেক্সট</Label>
                    <Input
                      value={content.promo_banners?.banner2?.buttonText || ''}
                      onChange={(e) => updateNestedSection('promo_banners', 'banner2', 'buttonText', e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Featured Products Section */}
          <TabsContent value="products">
            <Card>
              <CardHeader>
                <CardTitle>প্রোডাক্ট সেকশন</CardTitle>
                <CardDescription>Featured products সেকশনের টেক্সট</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>ট্যাগলাইন</Label>
                    <Input
                      value={content.featured_products?.tagline || ''}
                      onChange={(e) => updateSection('featured_products', 'tagline', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>বাটন টেক্সট</Label>
                    <Input
                      value={content.featured_products?.buttonText || ''}
                      onChange={(e) => updateSection('featured_products', 'buttonText', e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>শিরোনাম</Label>
                  <Input
                    value={content.featured_products?.title || ''}
                    onChange={(e) => updateSection('featured_products', 'title', e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Features Section */}
          <TabsContent value="features">
            <Card>
              <CardHeader>
                <CardTitle>ফিচার্স বার</CardTitle>
                <CardDescription>Features bar এর আইটেম সম্পাদনা করুন</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {content.features?.items?.map((item: any, index: number) => (
                  <div key={index} className="grid gap-4 md:grid-cols-2 p-4 border rounded-lg">
                    <div className="space-y-2">
                      <Label>শিরোনাম {index + 1}</Label>
                      <Input
                        value={item.title || ''}
                        onChange={(e) => updateFeature(index, 'title', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>বিবরণ {index + 1}</Label>
                      <Input
                        value={item.description || ''}
                        onChange={(e) => updateFeature(index, 'description', e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Why Choose Us Section */}
          <TabsContent value="why_choose">
            <Card>
              <CardHeader>
                <CardTitle>কেন আমাদের বেছে নেবেন</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>ট্যাগলাইন</Label>
                  <Input
                    value={content.why_choose_us?.tagline || ''}
                    onChange={(e) => updateSection('why_choose_us', 'tagline', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>শিরোনাম</Label>
                  <Textarea
                    value={content.why_choose_us?.title || ''}
                    onChange={(e) => updateSection('why_choose_us', 'title', e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Testimonials Section */}
          <TabsContent value="testimonials">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>গ্রাহক রিভিউ</CardTitle>
                    <CardDescription>টেস্টিমোনিয়াল পরিবর্তন, যোগ বা মুছুন</CardDescription>
                  </div>
                  <Button onClick={addTestimonial} variant="outline" size="sm">
                    <Plus className="h-4 w-4 ml-2" />
                    নতুন রিভিউ
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2 mb-4">
                  <div className="space-y-2">
                    <Label>ট্যাগলাইন</Label>
                    <Input
                      value={content.testimonials?.tagline || ''}
                      onChange={(e) => updateSection('testimonials', 'tagline', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>শিরোনাম</Label>
                    <Input
                      value={content.testimonials?.title || ''}
                      onChange={(e) => updateSection('testimonials', 'title', e.target.value)}
                    />
                  </div>
                </div>
                
                {content.testimonials?.items?.map((item: any, index: number) => (
                  <div key={index} className="p-4 border rounded-lg space-y-4 relative">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 left-2 h-8 w-8 text-destructive"
                      onClick={() => removeTestimonial(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>নাম</Label>
                        <Input
                          value={item.name || ''}
                          onChange={(e) => updateTestimonial(index, 'name', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>লোকেশন</Label>
                        <Input
                          value={item.location || ''}
                          onChange={(e) => updateTestimonial(index, 'location', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>রিভিউ টেক্সট</Label>
                      <Textarea
                        value={item.text || ''}
                        onChange={(e) => updateTestimonial(index, 'text', e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminHomePageEdit;
