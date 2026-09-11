import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CartItem, Product, ProductVariation } from '@/types';

interface CartState {
  items: CartItem[];
  isOpen: boolean;
}

const loadCartFromStorage = (): CartItem[] => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('cart');
    return saved ? JSON.parse(saved) : [];
  }
  return [];
};

const saveCartToStorage = (items: CartItem[]) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('cart', JSON.stringify(items));
  }
};

// Generate a unique key for cart items based on product id and variation id
const getCartItemKey = (productId: string, variationId?: string): string => {
  return variationId ? `${productId}-${variationId}` : productId;
};

// Stock available for a cart line: the chosen variation's, else the product's.
// A missing/unknown value means "unconstrained" so legacy carts keep working.
const availableStock = (item: CartItem): number | null => {
  const stock = item.variation?.stock ?? item.product?.stock;
  return typeof stock === 'number' ? stock : null;
};

const clampToStock = (item: CartItem, quantity: number): number => {
  const stock = availableStock(item);
  const capped = stock === null ? quantity : Math.min(quantity, Math.max(stock, 1));
  return Math.max(1, capped);
};

const initialState: CartState = {
  items: loadCartFromStorage(),
  isOpen: false,
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addToCart: (
      state,
      action: PayloadAction<{ product: Product; quantity?: number; variation?: ProductVariation }>
    ) => {
      const { product, quantity = 1, variation } = action.payload;
      const itemKey = getCartItemKey(product.id, variation?.id);

      const existingItem = state.items.find(
        (item) => getCartItemKey(item.product.id, item.variation?.id) === itemKey
      );

      if (existingItem) {
        existingItem.quantity = clampToStock(existingItem, existingItem.quantity + quantity);
      } else {
        const newItem = { product, quantity, variation };
        state.items.push({ ...newItem, quantity: clampToStock(newItem, quantity) });
      }
      saveCartToStorage(state.items);
    },
    removeFromCart: (state, action: PayloadAction<{ productId: string; variationId?: string }>) => {
      const { productId, variationId } = action.payload;
      const itemKey = getCartItemKey(productId, variationId);

      state.items = state.items.filter(
        (item) => getCartItemKey(item.product.id, item.variation?.id) !== itemKey
      );
      saveCartToStorage(state.items);
    },
    updateQuantity: (
      state,
      action: PayloadAction<{ productId: string; variationId?: string; quantity: number }>
    ) => {
      const { productId, variationId, quantity } = action.payload;
      const itemKey = getCartItemKey(productId, variationId);

      const item = state.items.find(
        (item) => getCartItemKey(item.product.id, item.variation?.id) === itemKey
      );
      if (item) {
        // Previously clamped only the lower bound, so "+" could run to any number
        // regardless of what was actually in stock.
        item.quantity = clampToStock(item, quantity);
      }
      saveCartToStorage(state.items);
    },
    setCartItemVariation: (
      state,
      action: PayloadAction<{ productId: string; fromVariationId?: string; variation?: ProductVariation }>
    ) => {
      const { productId, fromVariationId, variation } = action.payload;

      const fromKey = getCartItemKey(productId, fromVariationId);
      const existing = state.items.find(
        (item) => getCartItemKey(item.product.id, item.variation?.id) === fromKey
      );
      if (!existing) return;

      // Remove the old item
      state.items = state.items.filter(
        (item) => getCartItemKey(item.product.id, item.variation?.id) !== fromKey
      );

      // Add/merge into the target item key
      const toKey = getCartItemKey(productId, variation?.id);
      const target = state.items.find(
        (item) => getCartItemKey(item.product.id, item.variation?.id) === toKey
      );

      if (target) {
        target.quantity += existing.quantity;
      } else {
        state.items.push({ ...existing, variation });
      }

      saveCartToStorage(state.items);
    },
    clearCart: (state) => {
      state.items = [];
      saveCartToStorage(state.items);
    },
    toggleCart: (state) => {
      state.isOpen = !state.isOpen;
    },
    openCart: (state) => {
      state.isOpen = true;
    },
    closeCart: (state) => {
      state.isOpen = false;
    },
  },
});

export const {
  addToCart,
  removeFromCart,
  updateQuantity,
  setCartItemVariation,
  clearCart,
  toggleCart,
  openCart,
  closeCart,
} = cartSlice.actions;

export const selectCartItems = (state: { cart: CartState }) => state.cart.items;
export const selectCartTotal = (state: { cart: CartState }) =>
  state.cart.items.reduce((total, item) => {
    const price = item.variation?.price ?? item.product.price;
    return total + price * item.quantity;
  }, 0);
export const selectCartCount = (state: { cart: CartState }) =>
  state.cart.items.reduce((count, item) => count + item.quantity, 0);
export const selectIsCartOpen = (state: { cart: CartState }) => state.cart.isOpen;

export default cartSlice.reducer;
