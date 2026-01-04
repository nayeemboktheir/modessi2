import { 
  Image, 
  Type, 
  ShoppingCart, 
  MessageSquare, 
  HelpCircle,
  Layout,
  Play,
  Clock,
  Minus,
  ArrowUpDown,
  Award,
  ImageIcon,
  Megaphone,
  Sparkles,
  AlertCircle,
  Grid3X3,
  BadgeCheck,
  Shield
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SectionType, SECTION_TEMPLATES, Section } from "./types";

interface SectionPaletteProps {
  onAddSection: (section: Section) => void;
}

const sectionConfig: Array<{
  type: SectionType;
  label: string;
  icon: React.ReactNode;
  description: string;
}> = [
  {
    type: 'hero-gradient',
    label: 'Hero Gradient',
    icon: <Sparkles className="h-5 w-5" />,
    description: 'Beautiful gradient hero section',
  },
  {
    type: 'hero-product',
    label: 'Hero Product',
    icon: <Layout className="h-5 w-5" />,
    description: 'Image carousel with product info',
  },
  {
    type: 'problem-section',
    label: 'Problem Section',
    icon: <AlertCircle className="h-5 w-5" />,
    description: 'Show pain points with emojis',
  },
  {
    type: 'benefits-grid',
    label: 'Benefits Grid',
    icon: <Grid3X3 className="h-5 w-5" />,
    description: 'Display benefits in grid',
  },
  {
    type: 'trust-badges',
    label: 'Trust Badges',
    icon: <BadgeCheck className="h-5 w-5" />,
    description: 'Why buy from us section',
  },
  {
    type: 'guarantee-section',
    label: 'Guarantee',
    icon: <Shield className="h-5 w-5" />,
    description: 'No-risk ordering features',
  },
  {
    type: 'image-gallery',
    label: 'Image Gallery',
    icon: <ImageIcon className="h-5 w-5" />,
    description: 'Grid of images',
  },
  {
    type: 'feature-badges',
    label: 'Feature Badges',
    icon: <Award className="h-5 w-5" />,
    description: 'Highlight key features',
  },
  {
    type: 'text-block',
    label: 'Text Block',
    icon: <Type className="h-5 w-5" />,
    description: 'Rich text content',
  },
  {
    type: 'checkout-form',
    label: 'Checkout Form',
    icon: <ShoppingCart className="h-5 w-5" />,
    description: 'Order form with fields',
  },
  {
    type: 'cta-banner',
    label: 'CTA Banner',
    icon: <Megaphone className="h-5 w-5" />,
    description: 'Call to action section',
  },
  {
    type: 'image-text',
    label: 'Image + Text',
    icon: <Image className="h-5 w-5" />,
    description: 'Side by side layout',
  },
  {
    type: 'testimonials',
    label: 'Testimonials',
    icon: <MessageSquare className="h-5 w-5" />,
    description: 'Customer reviews',
  },
  {
    type: 'faq',
    label: 'FAQ',
    icon: <HelpCircle className="h-5 w-5" />,
    description: 'Questions & answers',
  },
  {
    type: 'video',
    label: 'Video',
    icon: <Play className="h-5 w-5" />,
    description: 'Embed video content',
  },
  {
    type: 'countdown',
    label: 'Countdown',
    icon: <Clock className="h-5 w-5" />,
    description: 'Timer for offers',
  },
  {
    type: 'divider',
    label: 'Divider',
    icon: <Minus className="h-5 w-5" />,
    description: 'Horizontal line',
  },
  {
    type: 'spacer',
    label: 'Spacer',
    icon: <ArrowUpDown className="h-5 w-5" />,
    description: 'Add vertical space',
  },
];

export const SectionPalette = ({ onAddSection }: SectionPaletteProps) => {
  const handleAddSection = (type: SectionType) => {
    const template = SECTION_TEMPLATES[type];
    const newSection = {
      id: crypto.randomUUID(),
      type,
      order: Date.now(),
      settings: { ...template.settings },
    } as Section;
    onAddSection(newSection);
  };

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
        Add Sections
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {sectionConfig.map((config) => (
          <Card
            key={config.type}
            className="cursor-pointer hover:border-primary hover:bg-accent/50 transition-all"
            onClick={() => handleAddSection(config.type)}
          >
            <CardContent className="p-3 flex flex-col items-center text-center gap-1">
              <div className="text-muted-foreground">{config.icon}</div>
              <span className="text-xs font-medium">{config.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
