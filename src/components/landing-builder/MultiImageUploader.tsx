import { useState, useRef } from "react";
import { Upload, X, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MultiImageUploaderProps {
  value: string[];
  onChange: (urls: string[]) => void;
  label?: string;
  maxImages?: number;
}

export const MultiImageUploader = ({
  value = [],
  onChange,
  label = "Images",
  maxImages = 10,
}: MultiImageUploaderProps) => {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newUrls: string[] = [];

    try {
      for (const file of Array.from(files)) {
        // Validate file type
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} is not an image`);
          continue;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} is too large (max 5MB)`);
          continue;
        }

        // Generate unique filename
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `landing-pages/${fileName}`;

        // Upload to Supabase storage
        const { error: uploadError } = await supabase.storage
          .from("shop-assets")
          .upload(filePath, file);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          continue;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from("shop-assets")
          .getPublicUrl(filePath);

        newUrls.push(publicUrl);
      }

      if (newUrls.length > 0) {
        onChange([...value, ...newUrls].slice(0, maxImages));
        toast.success(`${newUrls.length} image(s) uploaded!`);
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload images");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeImage = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const updateImageUrl = (index: number, url: string) => {
    const newUrls = [...value];
    newUrls[index] = url;
    onChange(newUrls);
  };

  const addEmptyUrl = () => {
    if (value.length < maxImages) {
      onChange([...value, ""]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addEmptyUrl}
            disabled={value.length >= maxImages}
          >
            <Plus className="h-3 w-3 mr-1" /> URL
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleUpload}
            accept="image/*"
            multiple
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || value.length >= maxImages}
          >
            {uploading ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Upload className="h-3 w-3 mr-1" />
            )}
            Upload
          </Button>
        </div>
      </div>

      {/* Image Grid */}
      {value.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {value.map((url, index) => (
            <div key={index} className="relative">
              {url ? (
                <div className="relative h-20 rounded border overflow-hidden bg-muted">
                  <img
                    src={url}
                    alt={`Image ${index + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = "/placeholder.svg";
                    }}
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 h-5 w-5"
                    onClick={() => removeImage(index)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-1">
                  <Input
                    value={url}
                    onChange={(e) => updateImageUrl(index, e.target.value)}
                    placeholder="Paste URL"
                    className="text-xs h-8"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => removeImage(index)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Upload images or add URLs (max {maxImages})
      </p>
    </div>
  );
};
