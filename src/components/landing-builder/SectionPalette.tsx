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
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Section library</p>
        <div className="mt-1 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">Build your page</h3>
            <p className="text-xs leading-5 text-muted-foreground">Choose a block to add it to your canvas.</p>
          </div>
          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            {sectionConfig.length} blocks
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {sectionConfig.map((config) => (
          <button
            key={config.type}
            type="button"
            className="group relative min-h-[104px] rounded-xl border bg-card p-3 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/[0.03] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => handleAddSection(config.type)}
          >
            <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              {config.icon}
            </div>
            <span className="block text-xs font-semibold leading-4 text-foreground">{config.label}</span>
            <span className="mt-1 block text-[11px] leading-4 text-muted-foreground line-clamp-2">{config.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
