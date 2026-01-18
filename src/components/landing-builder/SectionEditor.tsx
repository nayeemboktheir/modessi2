import { useState } from "react";
import { Trash2, GripVertical, ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { SectionType } from "./types";
import { ImageUploader } from "./ImageUploader";
import { MultiImageUploader } from "./MultiImageUploader";

// Use a generic section type for the editor to avoid discriminated union issues
interface EditableSection {
  id: string;
  type: SectionType;
  order: number;
  settings: Record<string, unknown>;
}

interface SectionEditorProps {
  section: EditableSection;
  onUpdate: (section: EditableSection) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
  products?: Array<{ id: string; name: string }>;
}

const sectionLabels: Record<SectionType, string> = {
  'hero-product': 'Hero Product',
  'hero-gradient': 'Hero Gradient',
  'problem-section': 'Problem Section',
  'benefits-grid': 'Benefits Grid',
  'trust-badges': 'Trust Badges',
  'guarantee-section': 'Guarantee Section',
  'image-gallery': 'Image Gallery',
  'feature-badges': 'Feature Badges',
  'text-block': 'Text Block',
  'product-info': 'Product Info',
  'checkout-form': 'Checkout Form',
  'cta-banner': 'CTA Banner',
  'testimonials': 'Testimonials',
  'faq': 'FAQ',
  'faq-accordion': 'FAQ Accordion',
  'image-text': 'Image + Text',
  'video': 'Video',
  'youtube-video': 'YouTube Video',
  'countdown': 'Countdown',
  'divider': 'Divider',
  'spacer': 'Spacer',
  'final-cta': 'Final CTA',
};

export const SectionEditor = ({
  section,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  products = [],
}: SectionEditorProps) => {
  const [isOpen, setIsOpen] = useState(true);

  const updateSettings = (key: string, value: unknown) => {
    onUpdate({
      ...section,
      settings: {
        ...section.settings,
        [key]: value,
      },
    });
  };

  const renderHeroProductEditor = () => {
    const settings = section.settings as {
      images: string[];
      title: string;
      subtitle: string;
      price: string;
      originalPrice: string;
      buttonText: string;
      buttonLink: string;
      badges: Array<{ text: string; subtext: string }>;
      backgroundColor: string;
      textColor: string;
      layout: string;
    };

    return (
      <div className="space-y-4">
        <MultiImageUploader
          value={settings.images || []}
          onChange={(urls) => updateSettings('images', urls)}
          label="Product Images"
          maxImages={6}
        />
        
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={settings.title || ''}
              onChange={(e) => updateSettings('title', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Layout</Label>
            <Select
              value={settings.layout || 'left-image'}
              onValueChange={(v) => updateSettings('layout', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="left-image">Image Left</SelectItem>
                <SelectItem value="right-image">Image Right</SelectItem>
                <SelectItem value="center">Centered</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Subtitle</Label>
          <Textarea
            value={settings.subtitle || ''}
            onChange={(e) => updateSettings('subtitle', e.target.value)}
            rows={2}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Price</Label>
            <Input
              value={settings.price || ''}
              onChange={(e) => updateSettings('price', e.target.value)}
              placeholder="1350"
            />
          </div>
          <div className="space-y-2">
            <Label>Original Price (optional)</Label>
            <Input
              value={settings.originalPrice || ''}
              onChange={(e) => updateSettings('originalPrice', e.target.value)}
              placeholder="1500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Button Text</Label>
            <Input
              value={settings.buttonText || ''}
              onChange={(e) => updateSettings('buttonText', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Button Link</Label>
            <Input
              value={settings.buttonLink || ''}
              onChange={(e) => updateSettings('buttonLink', e.target.value)}
              placeholder="#checkout"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Background Color</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={settings.backgroundColor || '#ffffff'}
                onChange={(e) => updateSettings('backgroundColor', e.target.value)}
                className="w-12 h-9 p-1"
              />
              <Input
                value={settings.backgroundColor || '#ffffff'}
                onChange={(e) => updateSettings('backgroundColor', e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Text Color</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={settings.textColor || '#1f2937'}
                onChange={(e) => updateSettings('textColor', e.target.value)}
                className="w-12 h-9 p-1"
              />
              <Input
                value={settings.textColor || '#1f2937'}
                onChange={(e) => updateSettings('textColor', e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
        </div>

        {/* Badges */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Feature Badges</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const badges = settings.badges || [];
                updateSettings('badges', [...badges, { text: '', subtext: '' }]);
              }}
            >
              <Plus className="h-3 w-3 mr-1" /> Add
            </Button>
          </div>
          {(settings.badges || []).map((badge, idx) => (
            <div key={idx} className="flex gap-2 items-start">
              <Input
                value={badge.text}
                onChange={(e) => {
                  const badges = [...(settings.badges || [])];
                  badges[idx] = { ...badges[idx], text: e.target.value };
                  updateSettings('badges', badges);
                }}
                placeholder="100%"
                className="w-24"
              />
              <Input
                value={badge.subtext}
                onChange={(e) => {
                  const badges = [...(settings.badges || [])];
                  badges[idx] = { ...badges[idx], subtext: e.target.value };
                  updateSettings('badges', badges);
                }}
                placeholder="Quality Guarantee"
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  const badges = (settings.badges || []).filter((_, i) => i !== idx);
                  updateSettings('badges', badges);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderCheckoutFormEditor = () => {
    const settings = section.settings as {
      title: string;
      buttonText: string;
      productId: string;
      backgroundColor: string;
      accentColor: string;
    };

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Form Title</Label>
          <Input
            value={settings.title || ''}
            onChange={(e) => updateSettings('title', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Button Text</Label>
          <Input
            value={settings.buttonText || ''}
            onChange={(e) => updateSettings('buttonText', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Link to Product</Label>
          <Select
            value={settings.productId || ''}
            onValueChange={(v) => updateSettings('productId', v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a product" />
            </SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Background Color</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={settings.backgroundColor || '#f9fafb'}
                onChange={(e) => updateSettings('backgroundColor', e.target.value)}
                className="w-12 h-9 p-1"
              />
              <Input
                value={settings.backgroundColor || '#f9fafb'}
                onChange={(e) => updateSettings('backgroundColor', e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Button Color</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={settings.accentColor || '#ef4444'}
                onChange={(e) => updateSettings('accentColor', e.target.value)}
                className="w-12 h-9 p-1"
              />
              <Input
                value={settings.accentColor || '#ef4444'}
                onChange={(e) => updateSettings('accentColor', e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTextBlockEditor = () => {
    const settings = section.settings as {
      content: string;
      alignment: string;
      fontSize: string;
      backgroundColor: string;
      textColor: string;
      padding: string;
    };

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Content</Label>
          <Textarea
            value={settings.content || ''}
            onChange={(e) => updateSettings('content', e.target.value)}
            rows={4}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Alignment</Label>
            <Select
              value={settings.alignment || 'center'}
              onValueChange={(v) => updateSettings('alignment', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Left</SelectItem>
                <SelectItem value="center">Center</SelectItem>
                <SelectItem value="right">Right</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Font Size</Label>
            <Input
              value={settings.fontSize || '16px'}
              onChange={(e) => updateSettings('fontSize', e.target.value)}
              placeholder="16px"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Background Color</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={settings.backgroundColor || '#ffffff'}
                onChange={(e) => updateSettings('backgroundColor', e.target.value)}
                className="w-12 h-9 p-1"
              />
              <Input
                value={settings.backgroundColor || '#ffffff'}
                onChange={(e) => updateSettings('backgroundColor', e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Text Color</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={settings.textColor || '#1f2937'}
                onChange={(e) => updateSettings('textColor', e.target.value)}
                className="w-12 h-9 p-1"
              />
              <Input
                value={settings.textColor || '#1f2937'}
                onChange={(e) => updateSettings('textColor', e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Padding</Label>
          <Input
            value={settings.padding || '32px'}
            onChange={(e) => updateSettings('padding', e.target.value)}
            placeholder="32px"
          />
        </div>
      </div>
    );
  };

  const renderFeatureBadgesEditor = () => {
    const settings = section.settings as {
      title: string;
      badges: Array<{ icon: string; title: string; description: string }>;
      columns: number;
      backgroundColor: string;
      textColor: string;
    };

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Section Title</Label>
          <Input
            value={settings.title || ''}
            onChange={(e) => updateSettings('title', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Columns</Label>
            <Select
              value={String(settings.columns || 3)}
              onValueChange={(v) => updateSettings('columns', parseInt(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="4">4</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Background</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={settings.backgroundColor || '#1f2937'}
                onChange={(e) => updateSettings('backgroundColor', e.target.value)}
                className="w-12 h-9 p-1"
              />
              <Input
                value={settings.backgroundColor || '#1f2937'}
                onChange={(e) => updateSettings('backgroundColor', e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Badges</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const badges = settings.badges || [];
                updateSettings('badges', [...badges, { icon: 'Star', title: '', description: '' }]);
              }}
            >
              <Plus className="h-3 w-3 mr-1" /> Add
            </Button>
          </div>
          {(settings.badges || []).map((badge, idx) => (
            <div key={idx} className="p-3 border rounded-lg space-y-2">
              <div className="flex gap-2">
                <Input
                  value={badge.title}
                  onChange={(e) => {
                    const badges = [...(settings.badges || [])];
                    badges[idx] = { ...badges[idx], title: e.target.value };
                    updateSettings('badges', badges);
                  }}
                  placeholder="Title"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    const badges = (settings.badges || []).filter((_, i) => i !== idx);
                    updateSettings('badges', badges);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <Input
                value={badge.description}
                onChange={(e) => {
                  const badges = [...(settings.badges || [])];
                  badges[idx] = { ...badges[idx], description: e.target.value };
                  updateSettings('badges', badges);
                }}
                placeholder="Description"
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderCTABannerEditor = () => {
    const settings = section.settings as {
      title: string;
      subtitle: string;
      buttonText: string;
      buttonLink: string;
      backgroundColor: string;
      textColor: string;
    };

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Title</Label>
          <Input
            value={settings.title || ''}
            onChange={(e) => updateSettings('title', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Subtitle</Label>
          <Textarea
            value={settings.subtitle || ''}
            onChange={(e) => updateSettings('subtitle', e.target.value)}
            rows={2}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Button Text</Label>
            <Input
              value={settings.buttonText || ''}
              onChange={(e) => updateSettings('buttonText', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Button Link</Label>
            <Input
              value={settings.buttonLink || ''}
              onChange={(e) => updateSettings('buttonLink', e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Background</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={settings.backgroundColor || '#000000'}
                onChange={(e) => updateSettings('backgroundColor', e.target.value)}
                className="w-12 h-9 p-1"
              />
              <Input
                value={settings.backgroundColor || '#000000'}
                onChange={(e) => updateSettings('backgroundColor', e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Text Color</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={settings.textColor || '#ffffff'}
                onChange={(e) => updateSettings('textColor', e.target.value)}
                className="w-12 h-9 p-1"
              />
              <Input
                value={settings.textColor || '#ffffff'}
                onChange={(e) => updateSettings('textColor', e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSpacerEditor = () => {
    const settings = section.settings as { height: string };

    return (
      <div className="space-y-2">
        <Label>Height</Label>
        <Input
          value={settings.height || '48px'}
          onChange={(e) => updateSettings('height', e.target.value)}
          placeholder="48px"
        />
      </div>
    );
  };

  const renderDividerEditor = () => {
    const settings = section.settings as {
      style: string;
      color: string;
      thickness: string;
      width: string;
    };

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Style</Label>
            <Select
              value={settings.style || 'solid'}
              onValueChange={(v) => updateSettings('style', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="solid">Solid</SelectItem>
                <SelectItem value="dashed">Dashed</SelectItem>
                <SelectItem value="dotted">Dotted</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={settings.color || '#e5e7eb'}
                onChange={(e) => updateSettings('color', e.target.value)}
                className="w-12 h-9 p-1"
              />
              <Input
                value={settings.color || '#e5e7eb'}
                onChange={(e) => updateSettings('color', e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Thickness</Label>
            <Input
              value={settings.thickness || '1px'}
              onChange={(e) => updateSettings('thickness', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Width</Label>
            <Input
              value={settings.width || '100%'}
              onChange={(e) => updateSettings('width', e.target.value)}
            />
          </div>
        </div>
      </div>
    );
  };

  const renderImageGalleryEditor = () => {
    const settings = section.settings as {
      images: string[];
      columns: number;
      gap: string;
      aspectRatio: string;
    };

    return (
      <div className="space-y-4">
        <MultiImageUploader
          value={settings.images || []}
          onChange={(urls) => updateSettings('images', urls)}
          label="Gallery Images"
          maxImages={12}
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Columns</Label>
            <Select
              value={String(settings.columns || 3)}
              onValueChange={(v) => updateSettings('columns', parseInt(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="4">4</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Aspect Ratio</Label>
            <Select
              value={settings.aspectRatio || 'square'}
              onValueChange={(v) => updateSettings('aspectRatio', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="square">Square</SelectItem>
                <SelectItem value="portrait">Portrait</SelectItem>
                <SelectItem value="landscape">Landscape</SelectItem>
                <SelectItem value="auto">Auto</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Gap</Label>
          <Input
            value={settings.gap || '16px'}
            onChange={(e) => updateSettings('gap', e.target.value)}
          />
        </div>
      </div>
    );
  };

  const renderImageTextEditor = () => {
    const settings = section.settings as {
      image: string;
      title: string;
      description: string;
      buttonText: string;
      buttonLink: string;
      imagePosition: string;
      backgroundColor: string;
    };

    return (
      <div className="space-y-4">
        <ImageUploader
          value={settings.image || ''}
          onChange={(url) => updateSettings('image', url)}
          label="Image"
          placeholder="Upload or paste image URL"
        />

        <div className="space-y-2">
          <Label>Image Position</Label>
          <Select
            value={settings.imagePosition || 'left'}
            onValueChange={(v) => updateSettings('imagePosition', v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Left</SelectItem>
              <SelectItem value="right">Right</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Title</Label>
          <Input
            value={settings.title || ''}
            onChange={(e) => updateSettings('title', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea
            value={settings.description || ''}
            onChange={(e) => updateSettings('description', e.target.value)}
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Button Text</Label>
            <Input
              value={settings.buttonText || ''}
              onChange={(e) => updateSettings('buttonText', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Button Link</Label>
            <Input
              value={settings.buttonLink || ''}
              onChange={(e) => updateSettings('buttonLink', e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Background Color</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={settings.backgroundColor || '#ffffff'}
              onChange={(e) => updateSettings('backgroundColor', e.target.value)}
              className="w-12 h-9 p-1"
            />
            <Input
              value={settings.backgroundColor || '#ffffff'}
              onChange={(e) => updateSettings('backgroundColor', e.target.value)}
              className="flex-1"
            />
          </div>
        </div>
      </div>
    );
  };

  const renderTestimonialsEditor = () => {
    const settings = section.settings as {
      title: string;
      items: Array<{ name: string; role: string; content: string; avatar: string }>;
      layout: string;
      columns: number;
    };

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Section Title</Label>
          <Input
            value={settings.title || ''}
            onChange={(e) => updateSettings('title', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Layout</Label>
            <Select
              value={settings.layout || 'grid'}
              onValueChange={(v) => updateSettings('layout', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="grid">Grid</SelectItem>
                <SelectItem value="carousel">Carousel</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Columns</Label>
            <Select
              value={String(settings.columns || 3)}
              onValueChange={(v) => updateSettings('columns', parseInt(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="4">4</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Testimonials</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const items = settings.items || [];
                updateSettings('items', [...items, { name: '', role: '', content: '', avatar: '' }]);
              }}
            >
              <Plus className="h-3 w-3 mr-1" /> Add
            </Button>
          </div>
          {(settings.items || []).map((item, idx) => (
            <div key={idx} className="p-3 border rounded-lg space-y-2">
              <div className="flex gap-2">
                <Input
                  value={item.name}
                  onChange={(e) => {
                    const items = [...(settings.items || [])];
                    items[idx] = { ...items[idx], name: e.target.value };
                    updateSettings('items', items);
                  }}
                  placeholder="Name"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    const items = (settings.items || []).filter((_, i) => i !== idx);
                    updateSettings('items', items);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <Input
                value={item.role}
                onChange={(e) => {
                  const items = [...(settings.items || [])];
                  items[idx] = { ...items[idx], role: e.target.value };
                  updateSettings('items', items);
                }}
                placeholder="Role / Location"
              />
              <Textarea
                value={item.content}
                onChange={(e) => {
                  const items = [...(settings.items || [])];
                  items[idx] = { ...items[idx], content: e.target.value };
                  updateSettings('items', items);
                }}
                placeholder="Review content"
                rows={2}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderFAQEditor = () => {
    const settings = section.settings as {
      title: string;
      items: Array<{ question: string; answer: string }>;
      backgroundColor: string;
    };

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Section Title</Label>
          <Input
            value={settings.title || ''}
            onChange={(e) => updateSettings('title', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Background Color</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={settings.backgroundColor || '#ffffff'}
              onChange={(e) => updateSettings('backgroundColor', e.target.value)}
              className="w-12 h-9 p-1"
            />
            <Input
              value={settings.backgroundColor || '#ffffff'}
              onChange={(e) => updateSettings('backgroundColor', e.target.value)}
              className="flex-1"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>FAQ Items</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const items = settings.items || [];
                updateSettings('items', [...items, { question: '', answer: '' }]);
              }}
            >
              <Plus className="h-3 w-3 mr-1" /> Add
            </Button>
          </div>
          {(settings.items || []).map((item, idx) => (
            <div key={idx} className="p-3 border rounded-lg space-y-2">
              <div className="flex gap-2">
                <Input
                  value={item.question}
                  onChange={(e) => {
                    const items = [...(settings.items || [])];
                    items[idx] = { ...items[idx], question: e.target.value };
                    updateSettings('items', items);
                  }}
                  placeholder="Question"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    const items = (settings.items || []).filter((_, i) => i !== idx);
                    updateSettings('items', items);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <Textarea
                value={item.answer}
                onChange={(e) => {
                  const items = [...(settings.items || [])];
                  items[idx] = { ...items[idx], answer: e.target.value };
                  updateSettings('items', items);
                }}
                placeholder="Answer"
                rows={2}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderVideoEditor = () => {
    const settings = section.settings as {
      videoUrl: string;
      youtubeUrl: string;
      title: string;
      autoplay: boolean;
      controls: boolean;
      loop: boolean;
      backgroundColor: string;
      textColor: string;
    };

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Video Title (optional)</Label>
          <Input
            value={settings.title || ''}
            onChange={(e) => updateSettings('title', e.target.value)}
            placeholder="Video Section Title"
          />
        </div>

        <div className="space-y-2">
          <Label>YouTube/Facebook URL or Embed Code (iframe)</Label>
          <Textarea
            value={settings.videoUrl || settings.youtubeUrl || ''}
            onChange={(e) => updateSettings('videoUrl', e.target.value)}
            placeholder="Paste a video URL OR the full <iframe ...></iframe> embed code"
            rows={4}
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            For Facebook, the most reliable option is pasting the full iframe code from Facebook plugins.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Background Color</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={settings.backgroundColor || '#ffffff'}
                onChange={(e) => updateSettings('backgroundColor', e.target.value)}
                className="w-12 h-9 p-1"
              />
              <Input
                value={settings.backgroundColor || '#ffffff'}
                onChange={(e) => updateSettings('backgroundColor', e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Text Color</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={settings.textColor || '#1f2937'}
                onChange={(e) => updateSettings('textColor', e.target.value)}
                className="w-12 h-9 p-1"
              />
              <Input
                value={settings.textColor || '#1f2937'}
                onChange={(e) => updateSettings('textColor', e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Switch
              checked={settings.autoplay || false}
              onCheckedChange={(v) => updateSettings('autoplay', v)}
            />
            <Label>Autoplay</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={settings.controls !== false}
              onCheckedChange={(v) => updateSettings('controls', v)}
            />
            <Label>Controls</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={settings.loop || false}
              onCheckedChange={(v) => updateSettings('loop', v)}
            />
            <Label>Loop</Label>
          </div>
        </div>
      </div>
    );
  };

  const renderCountdownEditor = () => {
    const settings = section.settings as {
      title: string;
      endDate: string;
      backgroundColor: string;
      textColor: string;
    };

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Title</Label>
          <Input
            value={settings.title || ''}
            onChange={(e) => updateSettings('title', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>End Date</Label>
          <Input
            type="datetime-local"
            value={settings.endDate || ''}
            onChange={(e) => updateSettings('endDate', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Background</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={settings.backgroundColor || '#ef4444'}
                onChange={(e) => updateSettings('backgroundColor', e.target.value)}
                className="w-12 h-9 p-1"
              />
              <Input
                value={settings.backgroundColor || '#ef4444'}
                onChange={(e) => updateSettings('backgroundColor', e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Text Color</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={settings.textColor || '#ffffff'}
                onChange={(e) => updateSettings('textColor', e.target.value)}
                className="w-12 h-9 p-1"
              />
              <Input
                value={settings.textColor || '#ffffff'}
                onChange={(e) => updateSettings('textColor', e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderFinalCTAEditor = () => {
    const settings = section.settings as {
      icon: string;
      title: string;
      subtitle: string;
      bulletPoints: string[];
      buttonText: string;
      footerText: string;
      backgroundColor: string;
      textColor: string;
    };

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Icon</Label>
            <Input
              value={settings.icon || ''}
              onChange={(e) => updateSettings('icon', e.target.value)}
              placeholder="📱"
            />
          </div>
          <div className="space-y-2">
            <Label>Button Text</Label>
            <Input
              value={settings.buttonText || ''}
              onChange={(e) => updateSettings('buttonText', e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Title</Label>
          <Input
            value={settings.title || ''}
            onChange={(e) => updateSettings('title', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Subtitle</Label>
          <Input
            value={settings.subtitle || ''}
            onChange={(e) => updateSettings('subtitle', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Footer Text</Label>
          <Input
            value={settings.footerText || ''}
            onChange={(e) => updateSettings('footerText', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Background</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={settings.backgroundColor || '#ffffff'}
                onChange={(e) => updateSettings('backgroundColor', e.target.value)}
                className="w-12 h-9 p-1"
              />
              <Input
                value={settings.backgroundColor || '#ffffff'}
                onChange={(e) => updateSettings('backgroundColor', e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Text Color</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={settings.textColor || '#1f2937'}
                onChange={(e) => updateSettings('textColor', e.target.value)}
                className="w-12 h-9 p-1"
              />
              <Input
                value={settings.textColor || '#1f2937'}
                onChange={(e) => updateSettings('textColor', e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderHeroGradientEditor = () => {
    const settings = section.settings as {
      badge: string;
      title: string;
      subtitle: string;
      description: string;
      features: Array<{ icon: string; text: string }>;
      buttonText: string;
      buttonLink: string;
      heroImage: string;
      gradientFrom: string;
      gradientTo: string;
      textColor: string;
    };

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Badge Text</Label>
          <Input
            value={settings.badge || ''}
            onChange={(e) => updateSettings('badge', e.target.value)}
            placeholder="🌴 ১০০% অরিজিনাল"
          />
        </div>

        <div className="space-y-2">
          <Label>Title</Label>
          <Input
            value={settings.title || ''}
            onChange={(e) => updateSettings('title', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Subtitle</Label>
          <Input
            value={settings.subtitle || ''}
            onChange={(e) => updateSettings('subtitle', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea
            value={settings.description || ''}
            onChange={(e) => updateSettings('description', e.target.value)}
            rows={2}
          />
        </div>

        <ImageUploader
          value={settings.heroImage || ''}
          onChange={(url) => updateSettings('heroImage', url)}
          label="Hero Image"
          placeholder="Upload or paste image URL"
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Button Text</Label>
            <Input
              value={settings.buttonText || ''}
              onChange={(e) => updateSettings('buttonText', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Button Link</Label>
            <Input
              value={settings.buttonLink || ''}
              onChange={(e) => updateSettings('buttonLink', e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Gradient From</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={settings.gradientFrom || '#b8860b'}
                onChange={(e) => updateSettings('gradientFrom', e.target.value)}
                className="w-12 h-9 p-1"
              />
              <Input
                value={settings.gradientFrom || '#b8860b'}
                onChange={(e) => updateSettings('gradientFrom', e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Gradient To</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={settings.gradientTo || '#d4a520'}
                onChange={(e) => updateSettings('gradientTo', e.target.value)}
                className="w-12 h-9 p-1"
              />
              <Input
                value={settings.gradientTo || '#d4a520'}
                onChange={(e) => updateSettings('gradientTo', e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Feature Pills</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const features = settings.features || [];
                updateSettings('features', [...features, { icon: '⭐', text: '' }]);
              }}
            >
              <Plus className="h-3 w-3 mr-1" /> Add
            </Button>
          </div>
          {(settings.features || []).map((feature, idx) => (
            <div key={idx} className="flex gap-2">
              <Input
                value={feature.icon}
                onChange={(e) => {
                  const features = [...(settings.features || [])];
                  features[idx] = { ...features[idx], icon: e.target.value };
                  updateSettings('features', features);
                }}
                placeholder="⚡"
                className="w-16"
              />
              <Input
                value={feature.text}
                onChange={(e) => {
                  const features = [...(settings.features || [])];
                  features[idx] = { ...features[idx], text: e.target.value };
                  updateSettings('features', features);
                }}
                placeholder="তাৎক্ষণিক শক্তি"
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  const features = (settings.features || []).filter((_, i) => i !== idx);
                  updateSettings('features', features);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderProblemSectionEditor = () => {
    const settings = section.settings as {
      title: string;
      problems: Array<{ icon: string; title: string }>;
      footerText: string;
      backgroundColor: string;
      textColor: string;
    };

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Section Title</Label>
          <Input
            value={settings.title || ''}
            onChange={(e) => updateSettings('title', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Problems</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const problems = settings.problems || [];
                updateSettings('problems', [...problems, { icon: '😟', title: '' }]);
              }}
            >
              <Plus className="h-3 w-3 mr-1" /> Add
            </Button>
          </div>
          {(settings.problems || []).map((problem, idx) => (
            <div key={idx} className="flex gap-2">
              <Input
                value={problem.icon}
                onChange={(e) => {
                  const problems = [...(settings.problems || [])];
                  problems[idx] = { ...problems[idx], icon: e.target.value };
                  updateSettings('problems', problems);
                }}
                placeholder="😫"
                className="w-16"
              />
              <Input
                value={problem.title}
                onChange={(e) => {
                  const problems = [...(settings.problems || [])];
                  problems[idx] = { ...problems[idx], title: e.target.value };
                  updateSettings('problems', problems);
                }}
                placeholder="Problem description"
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  const problems = (settings.problems || []).filter((_, i) => i !== idx);
                  updateSettings('problems', problems);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <Label>Footer Text</Label>
          <Input
            value={settings.footerText || ''}
            onChange={(e) => updateSettings('footerText', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Background</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={settings.backgroundColor || '#ffffff'}
                onChange={(e) => updateSettings('backgroundColor', e.target.value)}
                className="w-12 h-9 p-1"
              />
              <Input
                value={settings.backgroundColor || '#ffffff'}
                onChange={(e) => updateSettings('backgroundColor', e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Text Color</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={settings.textColor || '#1f2937'}
                onChange={(e) => updateSettings('textColor', e.target.value)}
                className="w-12 h-9 p-1"
              />
              <Input
                value={settings.textColor || '#1f2937'}
                onChange={(e) => updateSettings('textColor', e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderBenefitsGridEditor = () => {
    const settings = section.settings as {
      title: string;
      benefits: Array<{ icon: string; title: string; description: string }>;
      columns: number;
      backgroundColor: string;
      iconBackground: string;
      textColor: string;
    };

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Section Title</Label>
          <Input
            value={settings.title || ''}
            onChange={(e) => updateSettings('title', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Columns</Label>
            <Select
              value={String(settings.columns || 3)}
              onValueChange={(v) => updateSettings('columns', parseInt(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="4">4</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Background</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={settings.backgroundColor || '#f9fafb'}
                onChange={(e) => updateSettings('backgroundColor', e.target.value)}
                className="w-12 h-9 p-1"
              />
              <Input
                value={settings.backgroundColor || '#f9fafb'}
                onChange={(e) => updateSettings('backgroundColor', e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Benefits</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const benefits = settings.benefits || [];
                updateSettings('benefits', [...benefits, { icon: '⭐', title: '', description: '' }]);
              }}
            >
              <Plus className="h-3 w-3 mr-1" /> Add
            </Button>
          </div>
          {(settings.benefits || []).map((benefit, idx) => (
            <div key={idx} className="p-3 border rounded-lg space-y-2">
              <div className="flex gap-2">
                <Input
                  value={benefit.icon}
                  onChange={(e) => {
                    const benefits = [...(settings.benefits || [])];
                    benefits[idx] = { ...benefits[idx], icon: e.target.value };
                    updateSettings('benefits', benefits);
                  }}
                  placeholder="⚡"
                  className="w-16"
                />
                <Input
                  value={benefit.title}
                  onChange={(e) => {
                    const benefits = [...(settings.benefits || [])];
                    benefits[idx] = { ...benefits[idx], title: e.target.value };
                    updateSettings('benefits', benefits);
                  }}
                  placeholder="Benefit title"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    const benefits = (settings.benefits || []).filter((_, i) => i !== idx);
                    updateSettings('benefits', benefits);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <Input
                value={benefit.description}
                onChange={(e) => {
                  const benefits = [...(settings.benefits || [])];
                  benefits[idx] = { ...benefits[idx], description: e.target.value };
                  updateSettings('benefits', benefits);
                }}
                placeholder="Benefit description"
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderTrustBadgesEditor = () => {
    const settings = section.settings as {
      title: string;
      badges: Array<{ title: string; description: string }>;
      checkColor: string;
      backgroundColor: string;
      textColor: string;
    };

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Section Title</Label>
          <Input
            value={settings.title || ''}
            onChange={(e) => updateSettings('title', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Check Color</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={settings.checkColor || '#22c55e'}
                onChange={(e) => updateSettings('checkColor', e.target.value)}
                className="w-12 h-9 p-1"
              />
              <Input
                value={settings.checkColor || '#22c55e'}
                onChange={(e) => updateSettings('checkColor', e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Background</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={settings.backgroundColor || '#ffffff'}
                onChange={(e) => updateSettings('backgroundColor', e.target.value)}
                className="w-12 h-9 p-1"
              />
              <Input
                value={settings.backgroundColor || '#ffffff'}
                onChange={(e) => updateSettings('backgroundColor', e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Trust Badges</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const badges = settings.badges || [];
                updateSettings('badges', [...badges, { title: '', description: '' }]);
              }}
            >
              <Plus className="h-3 w-3 mr-1" /> Add
            </Button>
          </div>
          {(settings.badges || []).map((badge, idx) => (
            <div key={idx} className="p-3 border rounded-lg space-y-2">
              <div className="flex gap-2">
                <Input
                  value={badge.title}
                  onChange={(e) => {
                    const badges = [...(settings.badges || [])];
                    badges[idx] = { ...badges[idx], title: e.target.value };
                    updateSettings('badges', badges);
                  }}
                  placeholder="Trust point title"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    const badges = (settings.badges || []).filter((_, i) => i !== idx);
                    updateSettings('badges', badges);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <Input
                value={badge.description}
                onChange={(e) => {
                  const badges = [...(settings.badges || [])];
                  badges[idx] = { ...badges[idx], description: e.target.value };
                  updateSettings('badges', badges);
                }}
                placeholder="Description"
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderGuaranteeSectionEditor = () => {
    const settings = section.settings as {
      title: string;
      guarantees: Array<{ icon: string; title: string; subtitle: string }>;
      buttonText: string;
      buttonLink: string;
      backgroundColor: string;
      textColor: string;
      accentColor: string;
    };

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Section Title</Label>
          <Input
            value={settings.title || ''}
            onChange={(e) => updateSettings('title', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Button Text</Label>
            <Input
              value={settings.buttonText || ''}
              onChange={(e) => updateSettings('buttonText', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Button Link</Label>
            <Input
              value={settings.buttonLink || ''}
              onChange={(e) => updateSettings('buttonLink', e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Background</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={settings.backgroundColor || '#f0fdf4'}
                onChange={(e) => updateSettings('backgroundColor', e.target.value)}
                className="w-12 h-9 p-1"
              />
              <Input
                value={settings.backgroundColor || '#f0fdf4'}
                onChange={(e) => updateSettings('backgroundColor', e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Accent Color</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={settings.accentColor || '#22c55e'}
                onChange={(e) => updateSettings('accentColor', e.target.value)}
                className="w-12 h-9 p-1"
              />
              <Input
                value={settings.accentColor || '#22c55e'}
                onChange={(e) => updateSettings('accentColor', e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Guarantees</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const guarantees = settings.guarantees || [];
                updateSettings('guarantees', [...guarantees, { icon: '✅', title: '', subtitle: '' }]);
              }}
            >
              <Plus className="h-3 w-3 mr-1" /> Add
            </Button>
          </div>
          {(settings.guarantees || []).map((guarantee, idx) => (
            <div key={idx} className="p-3 border rounded-lg space-y-2">
              <div className="flex gap-2">
                <Input
                  value={guarantee.icon}
                  onChange={(e) => {
                    const guarantees = [...(settings.guarantees || [])];
                    guarantees[idx] = { ...guarantees[idx], icon: e.target.value };
                    updateSettings('guarantees', guarantees);
                  }}
                  placeholder="💵"
                  className="w-16"
                />
                <Input
                  value={guarantee.title}
                  onChange={(e) => {
                    const guarantees = [...(settings.guarantees || [])];
                    guarantees[idx] = { ...guarantees[idx], title: e.target.value };
                    updateSettings('guarantees', guarantees);
                  }}
                  placeholder="Title"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    const guarantees = (settings.guarantees || []).filter((_, i) => i !== idx);
                    updateSettings('guarantees', guarantees);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <Input
                value={guarantee.subtitle}
                onChange={(e) => {
                  const guarantees = [...(settings.guarantees || [])];
                  guarantees[idx] = { ...guarantees[idx], subtitle: e.target.value };
                  updateSettings('guarantees', guarantees);
                }}
                placeholder="Subtitle"
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderEditor = () => {
    switch (section.type) {
      case 'hero-product':
        return renderHeroProductEditor();
      case 'hero-gradient':
        return renderHeroGradientEditor();
      case 'problem-section':
        return renderProblemSectionEditor();
      case 'benefits-grid':
        return renderBenefitsGridEditor();
      case 'trust-badges':
        return renderTrustBadgesEditor();
      case 'guarantee-section':
        return renderGuaranteeSectionEditor();
      case 'checkout-form':
        return renderCheckoutFormEditor();
      case 'text-block':
        return renderTextBlockEditor();
      case 'feature-badges':
        return renderFeatureBadgesEditor();
      case 'cta-banner':
        return renderCTABannerEditor();
      case 'spacer':
        return renderSpacerEditor();
      case 'divider':
        return renderDividerEditor();
      case 'image-gallery':
        return renderImageGalleryEditor();
      case 'image-text':
        return renderImageTextEditor();
      case 'testimonials':
        return renderTestimonialsEditor();
      case 'faq':
      case 'faq-accordion':
        return renderFAQEditor();
      case 'video':
      case 'youtube-video':
        return renderVideoEditor();
      case 'countdown':
        return renderCountdownEditor();
      case 'final-cta':
        return renderFinalCTAEditor();
      default:
        return <p className="text-sm text-muted-foreground">No settings available</p>;
    }
  };

  return (
    <Card className="border-l-4 border-l-primary/50">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="p-3">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
            <CollapsibleTrigger className="flex-1 flex items-center justify-between">
              <span className="font-medium text-sm">{sectionLabels[section.type]}</span>
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CollapsibleTrigger>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onMoveUp}
                disabled={isFirst}
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onMoveDown}
                disabled={isLast}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="p-3 pt-0">
            {renderEditor()}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
