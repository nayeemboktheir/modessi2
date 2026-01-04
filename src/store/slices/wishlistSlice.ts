import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Product } from '@/types';

interface WishlistState {
  items: Product[];
}

const loadWishlistFromStorage = (): Product[] => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('wishlist');
    return saved ? JSON.parse(saved) : [];
  }
  return [];
};

const saveWishlistToStorage = (items: Product[]) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('wishlist', JSON.stringify(items));
  }
};

const initialState: WishlistState = {
  items: loadWishlistFromStorage(),
};

const wishlistSlice = createSlice({
  name: 'wishlist',
  initialState,
  reducers: {
    addToWishlist: (state, action: PayloadAction<Product>) => {
      const exists = state.items.find((item) => item.id === action.payload.id);
      if (!exists) {
        state.items.push(action.payload);
        saveWishlistToStorage(state.items);
      }
    },
    removeFromWishlist: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((item) => item.id !== action.payload);
      saveWishlistToStorage(state.items);
    },
    toggleWishlist: (state, action: PayloadAction<Product>) => {
      const exists = state.items.find((item) => item.id === action.payload.id);
      if (exists) {
        state.items = state.items.filter((item) => item.id !== action.payload.id);
      } else {
        state.items.push(action.payload);
      }
      saveWishlistToStorage(state.items);
    },
    clearWishlist: (state) => {
      state.items = [];
      saveWishlistToStorage(state.items);
    },
  },
});

export const { addToWishlist, removeFromWishlist, toggleWishlist, clearWishlist } =
  wishlistSlice.actions;

export const selectWishlistItems = (state: { wishlist: WishlistState }) => state.wishlist.items;
export const selectIsInWishlist = (state: { wishlist: WishlistState }, productId: string) =>
  state.wishlist.items.some((item) => item.id === productId);

export default wishlistSlice.reducer;
