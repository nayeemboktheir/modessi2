import { 
  Type, 
  Image, 
  Square, 
  Minus, 
  ArrowUpDown,
  Play,
  Clock,
  Star,
  HelpCircle,
  DollarSign,
  Images,
  Code,
  MessageSquare,
  PenTool,
  ShoppingCart
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { WidgetType, createWidget, Widget } from "./types";
import { ScrollArea } from "@/components/ui/scroll-area";

interface WidgetPaletteProps {
  onAddWidget: (widget: Widget, columnId: string) => void;
  targetColumnId: string | null;
}

const widgetConfig: Array<{
  type: WidgetType;
  label: string;
  icon: React.ReactNode;
}> = [
  { type: 'heading', label: 'Heading', icon: <Type className="h-4 w-4" /> },
  { type: 'text', label: 'Text', icon: <PenTool className="h-4 w-4" /> },
  { type: 'image', label: 'Image', icon: <Image className="h-4 w-4" /> },
  { type: 'button', label: 'Button', icon: <Square className="h-4 w-4" /> },
  { type: 'spacer', label: 'Spacer', icon: <ArrowUpDown className="h-4 w-4" /> },
  { type: 'divider', label: 'Divider', icon: <Minus className="h-4 w-4" /> },
  { type: 'video', label: 'Video', icon: <Play className="h-4 w-4" /> },
  { type: 'icon-box', label: 'Icon Box', icon: <Star className="h-4 w-4" /> },
  { type: 'image-box', label: 'Image Box', icon: <Images className="h-4 w-4" /> },
  { type: 'counter', label: 'Counter', icon: <DollarSign className="h-4 w-4" /> },
  { type: 'countdown', label: 'Countdown', icon: <Clock className="h-4 w-4" /> },
  { type: 'form', label: 'Order Form', icon: <ShoppingCart className="h-4 w-4" /> },
  { type: 'testimonial', label: 'Testimonial', icon: <MessageSquare className="h-4 w-4" /> },
  { type: 'faq-item', label: 'FAQ Item', icon: <HelpCircle className="h-4 w-4" /> },
  { type: 'price-box', label: 'Price Box', icon: <DollarSign className="h-4 w-4" /> },
  { type: 'gallery', label: 'Gallery', icon: <Images className="h-4 w-4" /> },
  { type: 'html', label: 'Custom HTML', icon: <Code className="h-4 w-4" /> },
];

export const WidgetPalette = ({ onAddWidget, targetColumnId }: WidgetPaletteProps) => {
  const handleAddWidget = (type: WidgetType) => {
    if (!targetColumnId) return;
    const newWidget = createWidget(type);
    onAddWidget(newWidget, targetColumnId);
  };

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
        Widgets
      </h3>
      {!targetColumnId ? (
        <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md">
          Click on a column in the preview to add widgets
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {widgetConfig.map((config) => (
            <Card
              key={config.type}
              className="cursor-pointer hover:border-primary hover:bg-accent/50 transition-all"
              onClick={() => handleAddWidget(config.type)}
            >
              <CardContent className="p-2 flex flex-col items-center text-center gap-0.5">
                <div className="text-muted-foreground">{config.icon}</div>
                <span className="text-[10px] font-medium leading-tight">{config.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
