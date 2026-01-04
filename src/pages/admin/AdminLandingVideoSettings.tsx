import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Save, Video, Plus, Trash2, Tag } from 'lucide-react';

const AdminLandingVideoSettings = () => {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [productVideo, setProductVideo] = useState('');
  const [reviewVideos, setReviewVideos] = useState<string[]>(['']);
  const [productName, setProductName] = useState('Tulshi Plus & Lungs Guard Capsole');
  const [productPrice, setProductPrice] = useState('1550');
  const [originalPrice, setOriginalPrice] = useState('2300');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('key, value')
        .in('key', ['landing_product_video', 'landing_review_videos', 'landing_product_name', 'landing_product_price', 'landing_product_original_price']);

      if (error) throw error;

      data?.forEach((item) => {
        if (item.key === 'landing_product_video') setProductVideo(item.value);
        if (item.key === 'landing_product_name') setProductName(item.value);
        if (item.key === 'landing_product_price') setProductPrice(item.value);
        if (item.key === 'landing_product_original_price') setOriginalPrice(item.value);
        if (item.key === 'landing_review_videos') {
          try {
            const videos = JSON.parse(item.value);
            setReviewVideos(videos.length > 0 ? videos : ['']);
          } catch {
            setReviewVideos([item.value || '']);
          }
        }
      });
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('সেটিংস লোড করতে সমস্যা হয়েছে');
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      const filteredVideos = reviewVideos.filter(v => v.trim() !== '');
      
      const updates = [
        { key: 'landing_product_video', value: productVideo },
        { key: 'landing_review_videos', value: JSON.stringify(filteredVideos) },
        { key: 'landing_product_name', value: productName },
        { key: 'landing_product_price', value: productPrice },
        { key: 'landing_product_original_price', value: originalPrice },
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from('admin_settings')
          .upsert({ key: update.key, value: update.value }, { onConflict: 'key' });

        if (error) throw error;
      }

      toast.success('সেটিংস সেভ হয়েছে!');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('সেভ করতে সমস্যা হয়েছে');
    } finally {
      setIsSaving(false);
    }
  };

  const getEmbedPreview = (url: string) => {
    if (!url) return null;
    // Handle YouTube Shorts
    if (url.includes('/shorts/')) {
      const videoId = url.split('/shorts/')[1]?.split('?')[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }
    // Handle regular YouTube links
    if (url.includes('watch?v=')) {
      return url.replace('watch?v=', 'embed/');
    }
    // Handle youtu.be short links
    if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1]?.split('?')[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }
    return url;
  };

  const addReviewVideo = () => {
    setReviewVideos([...reviewVideos, '']);
  };

  const removeReviewVideo = (index: number) => {
    if (reviewVideos.length > 1) {
      setReviewVideos(reviewVideos.filter((_, i) => i !== index));
    }
  };

  const updateReviewVideo = (index: number, value: string) => {
    const updated = [...reviewVideos];
    updated[index] = value;
    setReviewVideos(updated);
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

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">ল্যান্ডিং পেজ ভিডিও সেটিংস</h1>
            <p className="text-muted-foreground">ল্যান্ডিং পেজের ভিডিও লিংক পরিবর্তন করুন</p>
          </div>
          <Button onClick={saveSettings} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            সেভ করুন
          </Button>
        </div>

        {/* Product Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              প্রোডাক্ট সেটিংস
            </CardTitle>
            <CardDescription>প্রোডাক্টের নাম ও দাম পরিবর্তন করুন</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>প্রোডাক্ট নাম</Label>
              <Input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="প্রোডাক্টের নাম"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>বিক্রয় মূল্য (৳)</Label>
                <Input
                  type="number"
                  value={productPrice}
                  onChange={(e) => setProductPrice(e.target.value)}
                  placeholder="1550"
                />
              </div>
              <div className="space-y-2">
                <Label>আসল মূল্য (৳) - কাটা দাম</Label>
                <Input
                  type="number"
                  value={originalPrice}
                  onChange={(e) => setOriginalPrice(e.target.value)}
                  placeholder="2300"
                />
              </div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">প্রিভিউ:</p>
              <p className="text-lg font-bold">
                ৳{productPrice} 
                <span className="text-sm text-muted-foreground line-through ml-2">৳{originalPrice}</span>
                <span className="text-sm text-green-600 ml-2">
                  ({Math.round(((Number(originalPrice) - Number(productPrice)) / Number(originalPrice)) * 100)}% ছাড়)
                </span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Product Video */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              প্রোডাক্ট ভিডিও
            </CardTitle>
            <CardDescription>প্রোডাক্ট পরিচিতি ভিডিওর YouTube লিংক</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>YouTube লিংক</Label>
              <Input
                value={productVideo}
                onChange={(e) => setProductVideo(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </div>
            {productVideo && (
              <div className="aspect-video rounded-lg overflow-hidden bg-muted max-w-xl">
                <iframe
                  src={getEmbedPreview(productVideo) || ''}
                  title="Product Video Preview"
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Review Videos */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Video className="h-5 w-5" />
                  রিভিউ ভিডিও সমূহ
                </CardTitle>
                <CardDescription>কাস্টমার রিভিউ ভিডিওগুলোর YouTube লিংক (একাধিক যোগ করতে পারবেন)</CardDescription>
              </div>
              <Button onClick={addReviewVideo} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                নতুন ভিডিও যোগ করুন
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {reviewVideos.map((video, index) => (
              <div key={index} className="space-y-3 p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <Label className="flex-1">রিভিউ ভিডিও #{index + 1}</Label>
                  {reviewVideos.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeReviewVideo(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <Input
                  value={video}
                  onChange={(e) => updateReviewVideo(index, e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                />
                {video && (
                  <div className="aspect-video rounded-lg overflow-hidden bg-muted max-w-md">
                    <iframe
                      src={getEmbedPreview(video) || ''}
                      title={`Review Video ${index + 1} Preview`}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminLandingVideoSettings;
