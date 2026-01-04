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

const initialState: CartState = {
  items: loadCartFromStorage(),
  isOpen: false,
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addToCart: (state, action: PayloadAction<{ product: Product; quantity?: number; variation?: ProductVariation }>) => {
      const { product, quantity = 1, variation } = action.payload;
      const itemKey = getCartItemKey(product.id, variation?.id);
      
      const existingItem = state.items.find((item) => 
        getCartItemKey(item.product.id, item.variation?.id) === itemKey
      );

      if (existingItem) {
        existingItem.quantity += quantity;
      } else {
        state.items.push({ product, quantity, variation });
      }
      saveCartToStorage(state.items);
    },
    removeFromCart: (state, action: PayloadAction<{ productId: string; variationId?: string }>) => {
      const { productId, variationId } = action.payload;
      const itemKey = getCartItemKey(productId, variationId);
      
      state.items = state.items.filter((item) => 
        getCartItemKey(item.product.id, item.variation?.id) !== itemKey
      );
      saveCartToStorage(state.items);
    },
    updateQuantity: (state, action: PayloadAction<{ productId: string; variationId?: string; quantity: number }>) => {
      const { productId, variationId, quantity } = action.payload;
      const itemKey = getCartItemKey(productId, variationId);
      
      const item = state.items.find((item) => 
        getCartItemKey(item.product.id, item.variation?.id) === itemKey
      );
      if (item) {
        item.quantity = Math.max(1, quantity);
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
