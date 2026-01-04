import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Product, FilterState } from '@/types';

interface ProductState {
  products: Product[];
  featuredProducts: Product[];
  selectedProduct: Product | null;
  filters: FilterState;
  isLoading: boolean;
  error: string | null;
}

const initialState: ProductState = {
  products: [],
  featuredProducts: [],
  selectedProduct: null,
  filters: {
    sortBy: 'newest',
  },
  isLoading: false,
  error: null,
};

const productSlice = createSlice({
  name: 'products',
  initialState,
  reducers: {
    setProducts: (state, action: PayloadAction<Product[]>) => {
      state.products = action.payload;
      state.isLoading = false;
    },
    setFeaturedProducts: (state, action: PayloadAction<Product[]>) => {
      state.featuredProducts = action.payload;
    },
    setSelectedProduct: (state, action: PayloadAction<Product | null>) => {
      state.selectedProduct = action.payload;
    },
    setFilters: (state, action: PayloadAction<Partial<FilterState>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    resetFilters: (state) => {
      state.filters = { sortBy: 'newest' };
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoading = false;
    },
  },
});

export const {
  setProducts,
  setFeaturedProducts,
  setSelectedProduct,
  setFilters,
  resetFilters,
  setLoading,
  setError,
} = productSlice.actions;

export const selectProducts = (state: { products: ProductState }) => state.products.products;
export const selectFeaturedProducts = (state: { products: ProductState }) =>
  state.products.featuredProducts;
export const selectSelectedProduct = (state: { products: ProductState }) =>
  state.products.selectedProduct;
export const selectFilters = (state: { products: ProductState }) => state.products.filters;
export const selectProductsLoading = (state: { products: ProductState }) =>
  state.products.isLoading;

export default productSlice.reducer;
