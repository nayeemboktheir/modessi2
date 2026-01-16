export interface ProductVariation {
  id: string;
  product_id: string;
  name: string;
  price: number;
  original_price?: number;
  stock: number;
  sort_order: number;
  is_active: boolean;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  short_description?: string;
  long_description?: string;
  price: number;
  originalPrice?: number;
  images: string[];
  category: string;
  categorySlug?: string;
  subcategory?: string;
  rating: number;
  reviewCount: number;
  stock: number;
  featured?: boolean;
  isNew?: boolean;
  discount?: number;
  tags?: string[];
  variations?: ProductVariation[];
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  image: string;
  productCount: number;
  subcategories?: Subcategory[];
}

export interface Subcategory {
  id: string;
  name: string;
  slug: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  variation?: ProductVariation;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  role: 'user' | 'admin';
  addresses?: Address[];
}

export interface Address {
  id: string;
  name: string;
  phone: string;
  street: string;
  city: string;
  district: string;
  postalCode: string;
  isDefault?: boolean;
}

export interface Order {
  id: string;
  userId: string;
  items: CartItem[];
  total: number;
  subtotal: number;
  shipping: number;
  discount?: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  paymentMethod: 'cod' | 'stripe';
  paymentStatus: 'pending' | 'paid' | 'failed';
  shippingAddress: Address;
  createdAt: string;
  updatedAt: string;
  trackingNumber?: string;
}

export interface Review {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  productId: string;
  rating: number;
  comment: string;
  images?: string[];
  createdAt: string;
  helpful: number;
}

export interface FilterState {
  category?: string;
  subcategory?: string;
  minPrice?: number;
  maxPrice?: number;
  rating?: number;
  sortBy: 'newest' | 'price-low' | 'price-high' | 'rating' | 'popular';
  search?: string;
}
