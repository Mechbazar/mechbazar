import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  originalPrice: number;
  qty: number;
  image: string;
  isB2B: boolean;
  moq?: number;
  vehicleType?: string; // e.g., 'CAR' | 'BIKE'
}

interface CartState {
  items: CartItem[];
  deliveryFee: number;
}

const initialState: CartState = {
  items: [],
  deliveryFee: 50,
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addToCart: (state, action: PayloadAction<Omit<CartItem, 'qty'>>) => {
      const existingItem = state.items.find(item => item.id === action.payload.id);
      const minQty = action.payload.moq || 1;
      if (existingItem) {
        existingItem.qty += 1;
      } else {
        state.items.push({ ...action.payload, qty: minQty });
      }
    },
    removeFromCart: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter(item => item.id !== action.payload);
    },
    updateQuantity: (state, action: PayloadAction<{ id: string; qty: number }>) => {
      const item = state.items.find(item => item.id === action.payload.id);
      if (item) {
        const minQty = item.moq || 1;
        if (action.payload.qty <= 0) {
          state.items = state.items.filter(i => i.id !== action.payload.id);
        } else if (action.payload.qty < minQty) {
          item.qty = minQty; // Enforce MOQ
        } else {
          item.qty = action.payload.qty;
        }
      }
    },
    clearCart: (state) => {
      state.items = [];
    },
    hydrateCart: (state, action: PayloadAction<CartItem[]>) => {
      state.items = action.payload;
    }
  }
});

export const { addToCart, removeFromCart, updateQuantity, clearCart, hydrateCart } = cartSlice.actions;
export default cartSlice.reducer;
