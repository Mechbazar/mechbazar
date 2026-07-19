import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface AuthState {
  token: string | null;
  user: any | null;
  vendorProfile: any | null;
  isAuthenticated: boolean;
}

const initialState: AuthState = {
  token: localStorage.getItem('vendorToken'),
  user: JSON.parse(localStorage.getItem('vendorUser') || 'null'),
  vendorProfile: JSON.parse(localStorage.getItem('vendorProfile') || 'null'),
  isAuthenticated: !!localStorage.getItem('vendorToken'),
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginSuccess: (state, action: PayloadAction<{ token: string; user: any; vendor: any }>) => {
      state.token = action.payload.token;
      state.user = action.payload.user;
      state.vendorProfile = action.payload.vendor;
      state.isAuthenticated = true;
      localStorage.setItem('vendorToken', action.payload.token);
      localStorage.setItem('vendorUser', JSON.stringify(action.payload.user));
      localStorage.setItem('vendorProfile', JSON.stringify(action.payload.vendor));
    },
    logout: (state) => {
      state.token = null;
      state.user = null;
      state.vendorProfile = null;
      state.isAuthenticated = false;
      localStorage.removeItem('vendorToken');
      localStorage.removeItem('vendorUser');
      localStorage.removeItem('vendorProfile');
    },
    updateVendorProfile: (state, action: PayloadAction<any>) => {
      state.vendorProfile = action.payload;
      localStorage.setItem('vendorProfile', JSON.stringify(action.payload));
    }
  },
});

export const { loginSuccess, logout, updateVendorProfile } = authSlice.actions;
export default authSlice.reducer;
