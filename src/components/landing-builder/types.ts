// ============= ELEMENTOR-LIKE PAGE BUILDER TYPES =============

// Widget types that can be placed inside columns
export type WidgetType = 
  | 'heading'
  | 'text'
  | 'image'
  | 'button'
  | 'spacer'
  | 'divider'
  | 'video'
  | 'icon-box'
  | 'image-box'
  | 'counter'
  | 'countdown'
  | 'form'
  | 'testimonial'
  | 'faq-item'
  | 'price-box'
  | 'gallery'
  | 'html';

// Column layout options for rows
export type ColumnLayout = 
  | '100'           // 1 column full width
  | '50-50'         // 2 equal columns
  | '33-33-33'      // 3 equal columns
  | '25-25-25-25'   // 4 equal columns
  | '66-33'         // 2 columns: 2/3 + 1/3
  | '33-66'         // 2 columns: 1/3 + 2/3
  | '25-50-25'      // 3 columns: 1/4 + 1/2 + 1/4
  | '25-75'         // 2 columns: 1/4 + 3/4
  | '75-25';        // 2 columns: 3/4 + 1/4

// Widget base interface
export interface Widget {
  id: string;
  type: WidgetType;
  settings: Record<string, unknown>;
}

// Column containing widgets
export interface Column {
  id: string;
  widgets: Widget[];
  settings: {
    verticalAlign: 'top' | 'center' | 'bottom';
    padding: string;
    backgroundColor: string;
  };
}

// Row containing columns
export interface Row {
  id: string;
  type: 'row';
  layout: ColumnLayout;
  columns: Column[];
  settings: {
    backgroundColor: string;
    backgroundImage: string;
    backgroundOverlay: string;
    padding: string;
    margin: string;
    minHeight: string;
    maxWidth: 'full' | 'boxed';
    verticalAlign: 'top' | 'center' | 'bottom';
    gap: string;
  };
}

// Legacy section types (for backward compatibility)
export type LegacySectionType = 
  | 'hero-product'
  | 'hero-gradient'
  | 'problem-section'
  | 'benefits-grid'
  | 'trust-badges'
  | 'guarantee-section'
  | 'image-gallery'
  | 'feature-badges'
  | 'text-block'
  | 'product-info'
  | 'checkout-form'
  | 'cta-banner'
  | 'testimonials'
  | 'faq'
  | 'faq-accordion'
  | 'image-text'
  | 'video'
  | 'youtube-video'
  | 'countdown'
  | 'divider'
  | 'spacer'
  | 'final-cta';

// A page element can be either a Row (new) or a legacy Section
export type PageElement = Row | LegacySection;

// Legacy section interface (for backward compatibility)
export interface LegacySection {
  id: string;
  type: LegacySectionType;
  order: number;
  settings: Record<string, unknown>;
}

// Keep old types for backward compatibility
export type SectionType = LegacySectionType;
export type Section = LegacySection;
export interface BaseSection {
  id: string;
  type: SectionType;
  order: number;
  settings: Record<string, unknown>;
}

// Theme settings
export interface ThemeSettings {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  borderRadius: string;
  buttonStyle: 'filled' | 'outline' | 'ghost';
}

export const DEFAULT_THEME: ThemeSettings = {
  primaryColor: '#000000',
  secondaryColor: '#f5f5f5',
  accentColor: '#ef4444',
  backgroundColor: '#ffffff',
  textColor: '#1f2937',
  fontFamily: 'Inter',
  borderRadius: '8px',
  buttonStyle: 'filled',
};

// Column layout configurations
export const COLUMN_LAYOUTS: Record<ColumnLayout, { label: string; widths: string[] }> = {
  '100': { label: '1 Column', widths: ['100%'] },
  '50-50': { label: '2 Columns', widths: ['50%', '50%'] },
  '33-33-33': { label: '3 Columns', widths: ['33.333%', '33.333%', '33.333%'] },
  '25-25-25-25': { label: '4 Columns', widths: ['25%', '25%', '25%', '25%'] },
  '66-33': { label: '2 Columns (2/3 + 1/3)', widths: ['66.666%', '33.333%'] },
  '33-66': { label: '2 Columns (1/3 + 2/3)', widths: ['33.333%', '66.666%'] },
  '25-50-25': { label: '3 Columns (1/4 + 1/2 + 1/4)', widths: ['25%', '50%', '25%'] },
  '25-75': { label: '2 Columns (1/4 + 3/4)', widths: ['25%', '75%'] },
  '75-25': { label: '2 Columns (3/4 + 1/4)', widths: ['75%', '25%'] },
};

// Default widget templates
export const WIDGET_TEMPLATES: Record<WidgetType, Partial<Widget>> = {
  'heading': {
    type: 'heading',
    settings: {
      text: 'Heading',
      tag: 'h2',
      alignment: 'center',
      color: '',
      fontSize: '',
    },
  },
  'text': {
    type: 'text',
    settings: {
      content: 'Enter your text here...',
      alignment: 'left',
      color: '',
      fontSize: '16px',
    },
  },
  'image': {
    type: 'image',
    settings: {
      src: '',
      alt: '',
      width: '100%',
      alignment: 'center',
      link: '',
      borderRadius: '',
    },
  },
  'button': {
    type: 'button',
    settings: {
      text: 'Click Here',
      link: '#',
      style: 'filled',
      size: 'md',
      alignment: 'center',
      backgroundColor: '',
      textColor: '',
      fullWidth: false,
    },
  },
  'spacer': {
    type: 'spacer',
    settings: {
      height: '40px',
    },
  },
  'divider': {
    type: 'divider',
    settings: {
      style: 'solid',
      color: '#e5e7eb',
      thickness: '1px',
      width: '100%',
    },
  },
  'video': {
    type: 'video',
    settings: {
      url: '',
      autoplay: false,
      loop: false,
      controls: true,
    },
  },
  'icon-box': {
    type: 'icon-box',
    settings: {
      icon: '⭐',
      title: 'Feature Title',
      description: 'Feature description goes here',
      iconPosition: 'top',
      alignment: 'center',
    },
  },
  'image-box': {
    type: 'image-box',
    settings: {
      image: '',
      title: 'Image Box Title',
      description: 'Description text',
      link: '',
    },
  },
  'counter': {
    type: 'counter',
    settings: {
      number: '100',
      suffix: '+',
      title: 'Happy Customers',
      duration: 2000,
    },
  },
  'countdown': {
    type: 'countdown',
    settings: {
      endDate: '',
      title: 'Offer Ends In',
      backgroundColor: '#ef4444',
      textColor: '#ffffff',
    },
  },
  'form': {
    type: 'form',
    settings: {
      title: 'অর্ডার করতে নিচের ফর্মটি পূরণ করুন',
      buttonText: 'অর্ডার কনফার্ম করুন',
      productId: '',
      backgroundColor: '#f9fafb',
      accentColor: '#ef4444',
    },
  },
  'testimonial': {
    type: 'testimonial',
    settings: {
      name: 'Customer Name',
      role: 'Verified Buyer',
      content: 'This is an amazing product!',
      avatar: '',
      rating: 5,
    },
  },
  'faq-item': {
    type: 'faq-item',
    settings: {
      question: 'What is this product?',
      answer: 'This is a great product that solves your problems.',
    },
  },
  'price-box': {
    type: 'price-box',
    settings: {
      title: 'Product Name',
      price: '1350',
      originalPrice: '1500',
      currency: '৳',
      buttonText: 'অর্ডার করুন',
      buttonLink: '#checkout',
      features: [],
    },
  },
  'gallery': {
    type: 'gallery',
    settings: {
      images: [],
      columns: 3,
      gap: '8px',
    },
  },
  'html': {
    type: 'html',
    settings: {
      code: '<div>Custom HTML</div>',
    },
  },
};

// Default row template
export const createDefaultRow = (layout: ColumnLayout = '100'): Row => {
  const columnCount = COLUMN_LAYOUTS[layout].widths.length;
  const columns: Column[] = Array.from({ length: columnCount }, () => ({
    id: crypto.randomUUID(),
    widgets: [],
    settings: {
      verticalAlign: 'top',
      padding: '16px',
      backgroundColor: 'transparent',
    },
  }));

  return {
    id: crypto.randomUUID(),
    type: 'row',
    layout,
    columns,
    settings: {
      backgroundColor: 'transparent',
      backgroundImage: '',
      backgroundOverlay: '',
      padding: '24px 16px',
      margin: '0',
      minHeight: '',
      maxWidth: 'boxed',
      verticalAlign: 'top',
      gap: '16px',
    },
  };
};

// Create a new widget from template
export const createWidget = (type: WidgetType): Widget => {
  const template = WIDGET_TEMPLATES[type];
  return {
    id: crypto.randomUUID(),
    type,
    settings: { ...template.settings },
  };
};

// Legacy section templates (for backward compatibility)
export const SECTION_TEMPLATES: Record<SectionType, Partial<Section>> = {
  'hero-product': {
    type: 'hero-product',
    settings: {
      images: [],
      title: 'Product Title',
      subtitle: 'Product description goes here',
      price: '1350',
      originalPrice: '',
      buttonText: 'এখনই কিনুন',
      buttonLink: '#checkout',
      badges: [
        { text: '100%', subtext: 'Quality Guarantee' },
        { text: 'Size 36-46', subtext: 'Size Options' },
        { text: 'All Bangladesh', subtext: 'Delivery Service' },
      ],
      backgroundColor: '#ffffff',
      textColor: '#1f2937',
      layout: 'left-image',
    },
  },
  'hero-gradient': {
    type: 'hero-gradient',
    settings: {
      badge: '🌴 ১০০% অরিজিনাল',
      title: 'খাঁটি সৌদি মাবরুম মরিয়ম খেজুর',
      subtitle: 'এক কামড়েই শক্তি • সুস্থতা • বরকত',
      description: 'প্রতিদিনের ক্লান্তি দূর করতে, পরিবারের সুস্থতার জন্য',
      features: [
        { icon: '⚡', text: 'তাৎক্ষণিক শক্তি' },
        { icon: '💪', text: 'হজম শক্তি' },
        { icon: '🛡️', text: 'রোগ প্রতিরোধ' },
      ],
      buttonText: '🔘 এখনই অর্ডার করুন',
      buttonLink: '#checkout',
      image: '',
      gradientFrom: '#b8860b',
      gradientTo: '#d4a520',
      textColor: '#ffffff',
    },
  },
  'problem-section': {
    type: 'problem-section',
    settings: {
      title: '😔 আপনার কি এসব সমস্যা হচ্ছে?',
      problems: [
        { icon: '😫', title: 'সারাদিন কাজ করে শরীর ক্লান্ত লাগে' },
        { icon: '🤢', title: 'হজমে সমস্যা, কোষ্ঠকাঠিন্য' },
        { icon: '😟', title: 'বাজারের খেজুরে ভরসা পাচ্ছেন না' },
        { icon: '🐛', title: 'পোকা / কেমিক্যালের ভয়' },
      ],
      footerText: '👉 এই কারণেই আমরা নিয়ে এসেছি খাঁটি সমাধান',
      backgroundColor: '#ffffff',
      textColor: '#1f2937',
    },
  },
  'benefits-grid': {
    type: 'benefits-grid',
    settings: {
      title: '🌴 মাবরুম মরিয়ম খেজুর কেন আলাদা?',
      benefits: [
        { icon: '⚡', title: 'তাৎক্ষণিক শক্তি দেয়', description: 'প্রাকৃতিক শর্করা শরীরকে দ্রুত চাঙ্গা করে' },
        { icon: '💪', title: 'হজম শক্তি বাড়ায়', description: 'উচ্চ আঁশ কোষ্ঠকাঠিন্য দূর করে' },
        { icon: '🛡️', title: 'রোগ প্রতিরোধ ক্ষমতা বাড়ায়', description: 'অ্যান্টিঅক্সিডেন্ট শরীরকে রক্ষা করে' },
        { icon: '❤️', title: 'হৃদযন্ত্র সুস্থ রাখে', description: 'পটাশিয়াম রক্তচাপ নিয়ন্ত্রণে সহায়তা করে' },
        { icon: '🦴', title: 'হাড় মজবুত করে', description: 'ক্যালসিয়াম ও ফসফরাস হাড়কে করে শক্তিশালী' },
      ],
      columns: 3,
      backgroundColor: '#f9fafb',
      iconBackground: '#fff7ed',
      textColor: '#1f2937',
    },
  },
  'trust-badges': {
    type: 'trust-badges',
    settings: {
      title: '💎 কেন আমাদের কাছ থেকেই কিনবেন?',
      badges: [
        { title: 'সরাসরি আড়ৎদার থেকে সংগ্রহ', description: 'কোনো মিডলম্যান নেই — কোয়ালিটি নিশ্চিত' },
        { title: 'খাঁটি সৌদি আরবের খেজুর', description: 'সরাসরি সৌদি আরব থেকে আমদানিকৃত, ১০০% অরিজিনাল' },
        { title: 'কোনো কেমিক্যাল নয়', description: 'সংরক্ষণে কোনো ক্ষতিকর রাসায়নিক ব্যবহার করা হয় না' },
        { title: 'ইনশাআল্লাহ পোকামুক্ত', description: 'সঠিক সংরক্ষণ ও হাইজেনিক প্যাকেজিং' },
        { title: 'ন্যায্য দাম + দ্রুত ডেলিভারি', description: 'কোয়ালিটির সাথে আপস নয়' },
      ],
      checkColor: '#22c55e',
      backgroundColor: '#ffffff',
      textColor: '#1f2937',
    },
  },
  'guarantee-section': {
    type: 'guarantee-section',
    settings: {
      title: '🚚 অর্ডার করতে কোনো ঝুঁকি নেই',
      guarantees: [
        { icon: '💵', title: 'অগ্রিম টাকা লাগবে না', subtitle: 'ক্যাশ অন ডেলিভারি' },
        { icon: '🚚', title: 'ফ্রি হোম ডেলিভারি', subtitle: 'সারা বাংলাদেশে' },
        { icon: '📦', title: 'পণ্য দেখে নিন', subtitle: 'হাতে পেয়ে যাচাই করুন' },
        { icon: '🔄', title: 'সহজ রিটার্ন', subtitle: 'পছন্দ না হলে ফেরত' },
        { icon: '🛡️', title: '১০০% গ্যারান্টি', subtitle: 'মান নিশ্চিত' },
      ],
      buttonText: 'বিশ্বাস করি — আগে সন্তুষ্টি, তারপর পেমেন্ট',
      buttonLink: '#checkout',
      backgroundColor: '#f0fdf4',
      textColor: '#1f2937',
      accentColor: '#22c55e',
    },
  },
  'image-gallery': {
    type: 'image-gallery',
    settings: {
      images: [],
      columns: 3,
      gap: '16px',
      aspectRatio: 'square',
    },
  },
  'feature-badges': {
    type: 'feature-badges',
    settings: {
      title: 'Features',
      badges: [],
      columns: 3,
      backgroundColor: '#1f2937',
      textColor: '#ffffff',
    },
  },
  'text-block': {
    type: 'text-block',
    settings: {
      content: 'Enter your text here...',
      alignment: 'center',
      fontSize: '16px',
      backgroundColor: 'transparent',
      textColor: '#1f2937',
      padding: '32px',
    },
  },
  'product-info': {
    type: 'product-info',
    settings: {
      productId: '',
      showPrice: true,
      showDescription: true,
      showImages: true,
      layout: 'horizontal',
    },
  },
  'checkout-form': {
    type: 'checkout-form',
    settings: {
      title: 'অর্ডার করতে নিচের ফর্মটি পূরণ করুন',
      buttonText: 'অর্ডার কনফার্ম করুন',
      productId: '',
      fields: [
        { name: 'name', label: 'আপনার নাম', required: true, type: 'text' },
        { name: 'phone', label: 'মোবাইল নম্বর', required: true, type: 'tel' },
        { name: 'address', label: 'সম্পূর্ণ ঠিকানা', required: true, type: 'textarea' },
      ],
      backgroundColor: '#f9fafb',
      accentColor: '#ef4444',
    },
  },
  'cta-banner': {
    type: 'cta-banner',
    settings: {
      title: 'Ready to Order?',
      subtitle: 'Get yours today!',
      buttonText: 'Order Now',
      buttonLink: '#checkout',
      backgroundColor: '#000000',
      textColor: '#ffffff',
    },
  },
  'testimonials': {
    type: 'testimonials',
    settings: {
      title: 'Customer Reviews',
      items: [],
      layout: 'grid',
      columns: 3,
    },
  },
  'faq': {
    type: 'faq',
    settings: {
      title: 'Frequently Asked Questions',
      items: [],
      backgroundColor: '#ffffff',
    },
  },
  'image-text': {
    type: 'image-text',
    settings: {
      image: '',
      title: 'Title',
      description: 'Description',
      buttonText: 'Learn More',
      buttonLink: '#',
      imagePosition: 'left',
      backgroundColor: '#ffffff',
    },
  },
  'video': {
    type: 'video',
    settings: {
      videoUrl: '',
      autoplay: false,
      controls: true,
      loop: false,
    },
  },
  'countdown': {
    type: 'countdown',
    settings: {
      title: 'Offer Ends In',
      endDate: '',
      backgroundColor: '#ef4444',
      textColor: '#ffffff',
    },
  },
  'divider': {
    type: 'divider',
    settings: {
      style: 'solid',
      color: '#e5e7eb',
      thickness: '1px',
      width: '100%',
    },
  },
  'spacer': {
    type: 'spacer',
    settings: {
      height: '48px',
    },
  },
  'faq-accordion': {
    type: 'faq-accordion',
    settings: {
      title: 'সাধারণ জিজ্ঞাসা',
      items: [],
      backgroundColor: '#ffffff',
      textColor: '#1f2937',
    },
  },
  'youtube-video': {
    type: 'youtube-video',
    settings: {
      title: 'প্রোডাক্ট ভিডিও',
      videoUrl: '',
      backgroundColor: '#f5f5f5',
      textColor: '#1f2937',
    },
  },
  'final-cta': {
    type: 'final-cta',
    settings: {
      icon: '📱',
      title: 'এখনই অর্ডার করুন',
      subtitle: 'সীমিত সময়ের অফার',
      bulletPoints: [],
      buttonText: 'অর্ডার করুন',
      footerText: '',
      backgroundColor: '#ffffff',
      textColor: '#1f2937',
    },
  },
};
