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
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Save, Upload, Plus, Trash2, GripVertical, Image as ImageIcon } from 'lucide-react';

interface HomePageContent {
  [key: string]: any;
}

interface HeroSlide {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  link: string;
  badge: string;
}

interface FeatureItem {
  icon: string;
  title: string;
  desc: string;
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

  // Hero Slides Management
  const updateHeroSlide = (index: number, field: string, value: string) => {
    setContent(prev => {
      const slides = [...(prev.hero_slides?.slides || [])];
      slides[index] = { ...slides[index], [field]: value };
      return {
        ...prev,
        hero_slides: {
          ...prev.hero_slides,
          slides
        }
      };
    });
  };

  const addHeroSlide = () => {
    setContent(prev => {
      const slides = [...(prev.hero_slides?.slides || [])];
      slides.push({
        id: Date.now().toString(),
        title: 'নতুন স্লাইড',
        subtitle: 'সাবটাইটেল এখানে',
        image: '',
        link: '/products',
        badge: 'নতুন'
      });
      return {
        ...prev,
        hero_slides: {
          ...prev.hero_slides,
          slides
        }
      };
    });
  };

  const removeHeroSlide = (index: number) => {
    setContent(prev => {
      const slides = [...(prev.hero_slides?.slides || [])];
      slides.splice(index, 1);
      return {
        ...prev,
        hero_slides: {
          ...prev.hero_slides,
          slides
        }
      };
    });
  };

  // Features Bar Management
  const updateFeatureBar = (index: number, field: string, value: string) => {
    setContent(prev => {
      const items = [...(prev.features_bar?.items || [])];
      items[index] = { ...items[index], [field]: value };
      return {
        ...prev,
        features_bar: {
          ...prev.features_bar,
          items
        }
      };
    });
  };

  // Testimonials Management
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
      items.push({ name: '', location: '', text: '', rating: 5 });
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

  const handleImageUpload = async (file: File, sectionKey: string, imageField: string, index?: number) => {
    const uploadKey = `${sectionKey}-${index ?? ''}-${imageField}`;
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

      if (sectionKey === 'hero_slides' && index !== undefined) {
        updateHeroSlide(index, imageField, publicUrl);
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
        // First try update
        const { error: updateError, count } = await supabase
          .from('home_page_content')
          .update({ content: sectionContent, updated_at: new Date().toISOString() })
          .eq('section_key', sectionKey);

        // If no rows updated, insert
        if (updateError || count === 0) {
          const { error: insertError } = await supabase
            .from('home_page_content')
            .upsert({ 
              section_key: sectionKey, 
              content: sectionContent,
              updated_at: new Date().toISOString()
            });
          if (insertError) throw insertError;
        }
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
    slideIndex 
  }: { 
    label: string; 
    currentImage: string; 
    sectionKey: string; 
    imageField: string; 
    slideIndex?: number;
  }) => {
    const uploadKey = `${sectionKey}-${slideIndex ?? ''}-${imageField}`;
    const isUploading = uploadingImage === uploadKey;
    
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <div className="flex items-start gap-4">
          {currentImage && (
            <img 
              src={currentImage} 
              alt={label} 
              className="h-24 w-40 object-cover rounded-lg border"
            />
          )}
          {!currentImage && (
            <div className="h-24 w-40 bg-muted rounded-lg border flex items-center justify-center">
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 space-y-2">
            <Input
              value={currentImage || ''}
              onChange={(e) => {
                if (sectionKey === 'hero_slides' && slideIndex !== undefined) {
                  updateHeroSlide(slideIndex, imageField, e.target.value);
                } else {
                  updateSection(sectionKey, imageField, e.target.value);
                }
              }}
              placeholder="ছবির URL দিন বা আপলোড করুন"
            />
            <label className="cursor-pointer inline-block">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleImageUpload(file, sectionKey, imageField, slideIndex);
                  }
                }}
              />
              <Button type="button" variant="outline" size="sm" disabled={isUploading} asChild>
                <span>
                  {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                  আপলোড
                </span>
              </Button>
            </label>
          </div>
        </div>
      </div>
    );
  };

  const iconOptions = [
    { value: 'Truck', label: 'ট্রাক (ডেলিভারি)' },
    { value: 'RotateCcw', label: 'রিটার্ন' },
    { value: 'Shield', label: 'শিল্ড (সিকিউরিটি)' },
    { value: 'Headphones', label: 'হেডফোন (সাপোর্ট)' },
    { value: 'CreditCard', label: 'ক্রেডিট কার্ড' },
    { value: 'Clock', label: 'ঘড়ি' },
    { value: 'Gift', label: 'গিফট' },
    { value: 'Heart', label: 'হার্ট' },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">হোম পেজ এডিট</h1>
            <p className="text-muted-foreground">হোম পেজের সব টেক্সট, ছবি ও কন্টেন্ট পরিবর্তন করুন</p>
          </div>
          <Button onClick={saveContent} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Save className="h-4 w-4 ml-2" />}
            সেভ করুন
          </Button>
        </div>

        <Tabs defaultValue="hero_slides" className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="hero_slides">হিরো স্লাইডার</TabsTrigger>
            <TabsTrigger value="header_promo">হেডার প্রমো</TabsTrigger>
            <TabsTrigger value="features_bar">ফিচার বার</TabsTrigger>
            <TabsTrigger value="promo">প্রমো ব্যানার</TabsTrigger>
            <TabsTrigger value="products">প্রোডাক্ট সেকশন</TabsTrigger>
            <TabsTrigger value="why_choose">কেন আমাদের</TabsTrigger>
            <TabsTrigger value="testimonials">গ্রাহক রিভিউ</TabsTrigger>
          </TabsList>

          {/* Hero Slides Section */}
          <TabsContent value="hero_slides">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>হিরো স্লাইডার</CardTitle>
                    <CardDescription>হোম পেজের মূল স্লাইডশো এডিট করুন</CardDescription>
                  </div>
                  <Button onClick={addHeroSlide} variant="outline" size="sm">
                    <Plus className="h-4 w-4 ml-2" />
                    নতুন স্লাইড
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {(content.hero_slides?.slides || []).map((slide: HeroSlide, index: number) => (
                  <div key={slide.id || index} className="p-4 border rounded-lg space-y-4 relative bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-5 w-5 text-muted-foreground" />
                        <span className="font-medium">স্লাইড {index + 1}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => removeHeroSlide(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <ImageUploadField
                      label="স্লাইড ছবি"
                      currentImage={slide.image || ''}
                      sectionKey="hero_slides"
                      imageField="image"
                      slideIndex={index}
                    />
                    
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>শিরোনাম</Label>
                        <Input
                          value={slide.title || ''}
                          onChange={(e) => updateHeroSlide(index, 'title', e.target.value)}
                          placeholder="স্লাইড শিরোনাম"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>ব্যাজ টেক্সট</Label>
                        <Input
                          value={slide.badge || ''}
                          onChange={(e) => updateHeroSlide(index, 'badge', e.target.value)}
                          placeholder="যেমন: ৩০% ছাড়"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>সাবটাইটেল</Label>
                      <Textarea
                        value={slide.subtitle || ''}
                        onChange={(e) => updateHeroSlide(index, 'subtitle', e.target.value)}
                        placeholder="স্লাইড বিবরণ"
                        rows={2}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>লিংক URL</Label>
                      <Input
                        value={slide.link || ''}
                        onChange={(e) => updateHeroSlide(index, 'link', e.target.value)}
                        placeholder="/products বা অন্য কোনো পেজ"
                      />
                    </div>
                  </div>
                ))}

                {(!content.hero_slides?.slides || content.hero_slides.slides.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>কোনো স্লাইড নেই। "নতুন স্লাইড" বাটনে ক্লিক করুন।</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Header Promo Section */}
          <TabsContent value="header_promo">
            <Card>
              <CardHeader>
                <CardTitle>হেডার প্রমো বার</CardTitle>
                <CardDescription>পেজের একদম উপরে প্রমো টেক্সট</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>প্রমো বার দেখান</Label>
                  <Switch
                    checked={content.header_promo?.enabled ?? true}
                    onCheckedChange={(checked) => updateSection('header_promo', 'enabled', checked)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>প্রমো টেক্সট</Label>
                  <Input
                    value={content.header_promo?.text || ''}
                    onChange={(e) => updateSection('header_promo', 'text', e.target.value)}
                    placeholder="যেমন: ৮২০০০+ অর্ডার সারাদেশে ফ্রি ডেলিভারি"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Features Bar Section */}
          <TabsContent value="features_bar">
            <Card>
              <CardHeader>
                <CardTitle>ফিচার বার</CardTitle>
                <CardDescription>হিরো সেকশনের নিচে ফিচার আইকন বার</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(content.features_bar?.items || []).map((item: FeatureItem, index: number) => (
                  <div key={index} className="grid gap-4 md:grid-cols-3 p-4 border rounded-lg">
                    <div className="space-y-2">
                      <Label>আইকন</Label>
                      <select
                        value={item.icon || 'Truck'}
                        onChange={(e) => updateFeatureBar(index, 'icon', e.target.value)}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                      >
                        {iconOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>শিরোনাম</Label>
                      <Input
                        value={item.title || ''}
                        onChange={(e) => updateFeatureBar(index, 'title', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>বিবরণ</Label>
                      <Input
                        value={item.desc || ''}
                        onChange={(e) => updateFeatureBar(index, 'desc', e.target.value)}
                      />
                    </div>
                  </div>
                ))}
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
                  />
                  <div className="space-y-2">
                    <Label>ট্যাগলাইন</Label>
                    <Input
                      value={content.promo_banners?.banner1?.tagline || ''}
                      onChange={(e) => updateNestedSection('promo_banners', 'banner1', 'tagline', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>শিরোনাম</Label>
                    <Input
                      value={content.promo_banners?.banner1?.title || ''}
                      onChange={(e) => updateNestedSection('promo_banners', 'banner1', 'title', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>সাবটাইটেল</Label>
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
                  />
                  <div className="space-y-2">
                    <Label>ট্যাগলাইন</Label>
                    <Input
                      value={content.promo_banners?.banner2?.tagline || ''}
                      onChange={(e) => updateNestedSection('promo_banners', 'banner2', 'tagline', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>শিরোনাম</Label>
                    <Input
                      value={content.promo_banners?.banner2?.title || ''}
                      onChange={(e) => updateNestedSection('promo_banners', 'banner2', 'title', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>সাবটাইটেল</Label>
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
                
                {(content.testimonials?.items || []).map((item: any, index: number) => (
                  <div key={index} className="p-4 border rounded-lg space-y-4 relative">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 left-2 h-8 w-8 text-destructive"
                      onClick={() => removeTestimonial(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <div className="grid gap-4 md:grid-cols-2 pt-6">
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

                {(!content.testimonials?.items || content.testimonials.items.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>কোনো রিভিউ নেই। "নতুন রিভিউ" বাটনে ক্লিক করুন।</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminHomePageEdit;
