import { useState } from "react";
import { Trash2, ChevronDown, ChevronUp, Copy, GripVertical } from "lucide-react";
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
import { Widget, WidgetType } from "./types";

interface WidgetEditorProps {
  widget: Widget;
  onUpdate: (widget: Widget) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  isFirst: boolean;
  isLast: boolean;
  products?: Array<{ id: string; name: string }>;
}

const widgetLabels: Record<WidgetType, string> = {
  'heading': 'Heading',
  'text': 'Text',
  'image': 'Image',
  'button': 'Button',
  'spacer': 'Spacer',
  'divider': 'Divider',
  'video': 'Video',
  'icon-box': 'Icon Box',
  'image-box': 'Image Box',
  'counter': 'Counter',
  'countdown': 'Countdown',
  'form': 'Order Form',
  'testimonial': 'Testimonial',
  'faq-item': 'FAQ Item',
  'price-box': 'Price Box',
  'gallery': 'Gallery',
  'html': 'Custom HTML',
};

export const WidgetEditor = ({
  widget,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  isFirst,
  isLast,
  products = [],
}: WidgetEditorProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const updateSettings = (key: string, value: unknown) => {
    onUpdate({
      ...widget,
      settings: {
        ...widget.settings,
        [key]: value,
      },
    });
  };

  const renderEditor = () => {
    const settings = widget.settings;

    switch (widget.type) {
      case 'heading':
        return (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Text</Label>
              <Input
                value={settings.text as string || ''}
                onChange={(e) => updateSettings('text', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Tag</Label>
                <Select
                  value={settings.tag as string || 'h2'}
                  onValueChange={(v) => updateSettings('tag', v)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="h1">H1</SelectItem>
                    <SelectItem value="h2">H2</SelectItem>
                    <SelectItem value="h3">H3</SelectItem>
                    <SelectItem value="h4">H4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Alignment</Label>
                <Select
                  value={settings.alignment as string || 'center'}
                  onValueChange={(v) => updateSettings('alignment', v)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Color</Label>
                <div className="flex gap-1">
                  <Input
                    type="color"
                    value={settings.color as string || '#000000'}
                    onChange={(e) => updateSettings('color', e.target.value)}
                    className="w-8 h-8 p-1"
                  />
                  <Input
                    value={settings.color as string || ''}
                    onChange={(e) => updateSettings('color', e.target.value)}
                    placeholder="inherit"
                    className="flex-1 h-8 text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Font Size</Label>
                <Input
                  value={settings.fontSize as string || ''}
                  onChange={(e) => updateSettings('fontSize', e.target.value)}
                  placeholder="auto"
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>
        );

      case 'text':
        return (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Content</Label>
              <Textarea
                value={settings.content as string || ''}
                onChange={(e) => updateSettings('content', e.target.value)}
                rows={4}
                className="text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Alignment</Label>
                <Select
                  value={settings.alignment as string || 'left'}
                  onValueChange={(v) => updateSettings('alignment', v)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Font Size</Label>
                <Input
                  value={settings.fontSize as string || '16px'}
                  onChange={(e) => updateSettings('fontSize', e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>
        );

      case 'image':
        return (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Image URL</Label>
              <Input
                value={settings.src as string || ''}
                onChange={(e) => updateSettings('src', e.target.value)}
                placeholder="https://..."
                className="h-8 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Width</Label>
                <Input
                  value={settings.width as string || '100%'}
                  onChange={(e) => updateSettings('width', e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Alignment</Label>
                <Select
                  value={settings.alignment as string || 'center'}
                  onValueChange={(v) => updateSettings('alignment', v)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Link URL (optional)</Label>
              <Input
                value={settings.link as string || ''}
                onChange={(e) => updateSettings('link', e.target.value)}
                placeholder="https://..."
                className="h-8 text-xs"
              />
            </div>
          </div>
        );

      case 'button':
        return (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Text</Label>
              <Input
                value={settings.text as string || ''}
                onChange={(e) => updateSettings('text', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Link</Label>
              <Input
                value={settings.link as string || '#'}
                onChange={(e) => updateSettings('link', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Style</Label>
                <Select
                  value={settings.style as string || 'filled'}
                  onValueChange={(v) => updateSettings('style', v)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="filled">Filled</SelectItem>
                    <SelectItem value="outline">Outline</SelectItem>
                    <SelectItem value="ghost">Ghost</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Size</Label>
                <Select
                  value={settings.size as string || 'md'}
                  onValueChange={(v) => updateSettings('size', v)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sm">Small</SelectItem>
                    <SelectItem value="md">Medium</SelectItem>
                    <SelectItem value="lg">Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={settings.fullWidth as boolean || false}
                onCheckedChange={(v) => updateSettings('fullWidth', v)}
              />
              <Label className="text-xs">Full Width</Label>
            </div>
          </div>
        );

      case 'spacer':
        return (
          <div className="space-y-1">
            <Label className="text-xs">Height</Label>
            <Input
              value={settings.height as string || '40px'}
              onChange={(e) => updateSettings('height', e.target.value)}
              className="h-8 text-xs"
            />
          </div>
        );

      case 'divider':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Style</Label>
                <Select
                  value={settings.style as string || 'solid'}
                  onValueChange={(v) => updateSettings('style', v)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solid">Solid</SelectItem>
                    <SelectItem value="dashed">Dashed</SelectItem>
                    <SelectItem value="dotted">Dotted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Thickness</Label>
                <Input
                  value={settings.thickness as string || '1px'}
                  onChange={(e) => updateSettings('thickness', e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Color</Label>
              <div className="flex gap-1">
                <Input
                  type="color"
                  value={settings.color as string || '#e5e7eb'}
                  onChange={(e) => updateSettings('color', e.target.value)}
                  className="w-8 h-8 p-1"
                />
                <Input
                  value={settings.color as string || '#e5e7eb'}
                  onChange={(e) => updateSettings('color', e.target.value)}
                  className="flex-1 h-8 text-xs"
                />
              </div>
            </div>
          </div>
        );

      case 'icon-box':
        return (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Icon (emoji or text)</Label>
              <Input
                value={settings.icon as string || '⭐'}
                onChange={(e) => updateSettings('icon', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Title</Label>
              <Input
                value={settings.title as string || ''}
                onChange={(e) => updateSettings('title', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Textarea
                value={settings.description as string || ''}
                onChange={(e) => updateSettings('description', e.target.value)}
                rows={2}
                className="text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Icon Position</Label>
                <Select
                  value={settings.iconPosition as string || 'top'}
                  onValueChange={(v) => updateSettings('iconPosition', v)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top">Top</SelectItem>
                    <SelectItem value="left">Left</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Alignment</Label>
                <Select
                  value={settings.alignment as string || 'center'}
                  onValueChange={(v) => updateSettings('alignment', v)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        );

      case 'form':
        return (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Form Title</Label>
              <Input
                value={settings.title as string || ''}
                onChange={(e) => updateSettings('title', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Button Text</Label>
              <Input
                value={settings.buttonText as string || ''}
                onChange={(e) => updateSettings('buttonText', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Link to Product</Label>
              <Select
                value={settings.productId as string || ''}
                onValueChange={(v) => updateSettings('productId', v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Button Color</Label>
              <div className="flex gap-1">
                <Input
                  type="color"
                  value={settings.accentColor as string || '#ef4444'}
                  onChange={(e) => updateSettings('accentColor', e.target.value)}
                  className="w-8 h-8 p-1"
                />
                <Input
                  value={settings.accentColor as string || '#ef4444'}
                  onChange={(e) => updateSettings('accentColor', e.target.value)}
                  className="flex-1 h-8 text-xs"
                />
              </div>
            </div>
          </div>
        );

      case 'price-box':
        return (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Title</Label>
              <Input
                value={settings.title as string || ''}
                onChange={(e) => updateSettings('title', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Price</Label>
                <Input
                  value={settings.price as string || ''}
                  onChange={(e) => updateSettings('price', e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Original Price</Label>
                <Input
                  value={settings.originalPrice as string || ''}
                  onChange={(e) => updateSettings('originalPrice', e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Button Text</Label>
              <Input
                value={settings.buttonText as string || ''}
                onChange={(e) => updateSettings('buttonText', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Button Link</Label>
              <Input
                value={settings.buttonLink as string || '#'}
                onChange={(e) => updateSettings('buttonLink', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>
        );

      case 'countdown':
        return (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Title</Label>
              <Input
                value={settings.title as string || ''}
                onChange={(e) => updateSettings('title', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">End Date</Label>
              <Input
                type="datetime-local"
                value={settings.endDate as string || ''}
                onChange={(e) => updateSettings('endDate', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Background</Label>
                <div className="flex gap-1">
                  <Input
                    type="color"
                    value={settings.backgroundColor as string || '#ef4444'}
                    onChange={(e) => updateSettings('backgroundColor', e.target.value)}
                    className="w-8 h-8 p-1"
                  />
                  <Input
                    value={settings.backgroundColor as string || '#ef4444'}
                    onChange={(e) => updateSettings('backgroundColor', e.target.value)}
                    className="flex-1 h-8 text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Text Color</Label>
                <div className="flex gap-1">
                  <Input
                    type="color"
                    value={settings.textColor as string || '#ffffff'}
                    onChange={(e) => updateSettings('textColor', e.target.value)}
                    className="w-8 h-8 p-1"
                  />
                  <Input
                    value={settings.textColor as string || '#ffffff'}
                    onChange={(e) => updateSettings('textColor', e.target.value)}
                    className="flex-1 h-8 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 'video':
        return (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Video URL or Embed Code (iframe)</Label>
              <Textarea
                value={(settings.url as string) || ""}
                onChange={(e) => updateSettings("url", e.target.value)}
                placeholder="Paste a YouTube/Facebook/Vimeo URL OR the full <iframe ...></iframe> code"
                rows={4}
                className="text-xs font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Tip: for Facebook reels, paste the full iframe code from your Facebook page (Elementor-style).
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={settings.autoplay as boolean || false}
                  onCheckedChange={(v) => updateSettings('autoplay', v)}
                />
                <Label className="text-xs">Autoplay</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={settings.loop as boolean || false}
                  onCheckedChange={(v) => updateSettings('loop', v)}
                />
                <Label className="text-xs">Loop</Label>
              </div>
            </div>
          </div>
        );

      case 'html':
        return (
          <div className="space-y-1">
            <Label className="text-xs">Custom HTML</Label>
            <Textarea
              value={settings.code as string || ''}
              onChange={(e) => updateSettings('code', e.target.value)}
              rows={6}
              className="font-mono text-xs"
              placeholder="<div>Your HTML here</div>"
            />
          </div>
        );

      case 'testimonial':
        return (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input
                value={settings.name as string || ''}
                onChange={(e) => updateSettings('name', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Role</Label>
              <Input
                value={settings.role as string || ''}
                onChange={(e) => updateSettings('role', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Content</Label>
              <Textarea
                value={settings.content as string || ''}
                onChange={(e) => updateSettings('content', e.target.value)}
                rows={3}
                className="text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Avatar URL</Label>
              <Input
                value={settings.avatar as string || ''}
                onChange={(e) => updateSettings('avatar', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>
        );

      case 'faq-item':
        return (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Question</Label>
              <Input
                value={settings.question as string || ''}
                onChange={(e) => updateSettings('question', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Answer</Label>
              <Textarea
                value={settings.answer as string || ''}
                onChange={(e) => updateSettings('answer', e.target.value)}
                rows={3}
                className="text-xs"
              />
            </div>
          </div>
        );

      case 'gallery':
        return (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Images (one URL per line)</Label>
              <Textarea
                value={(settings.images as string[] || []).join('\n')}
                onChange={(e) => updateSettings('images', e.target.value.split('\n').filter(Boolean))}
                rows={4}
                className="text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Columns</Label>
                <Select
                  value={String(settings.columns || 3)}
                  onValueChange={(v) => updateSettings('columns', parseInt(v))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="4">4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Gap</Label>
                <Input
                  value={settings.gap as string || '8px'}
                  onChange={(e) => updateSettings('gap', e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>
        );

      default:
        return <p className="text-xs text-muted-foreground">No settings available</p>;
    }
  };

  return (
    <Card className="border-l-2 border-l-accent/50">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="p-2">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="flex-1 justify-start gap-2 h-7 px-2">
                <GripVertical className="h-3 w-3 text-muted-foreground" />
                <span className="text-[11px] font-medium">{widgetLabels[widget.type]}</span>
                {isOpen ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
              </Button>
            </CollapsibleTrigger>
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={onMoveUp}
                disabled={isFirst}
              >
                <ChevronUp className="h-2.5 w-2.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={onMoveDown}
                disabled={isLast}
              >
                <ChevronDown className="h-2.5 w-2.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={onDuplicate}
              >
                <Copy className="h-2.5 w-2.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-destructive hover:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-2.5 w-2.5" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="p-2 pt-0">
            {renderEditor()}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
