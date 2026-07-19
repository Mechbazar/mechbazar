import { apiClient } from './client';

export const vendorService = {
  // Auth
  login: async (credentials: any) => {
    const response = await apiClient.post('/vendors/login', credentials);
    return response.data;
  },
  
  // Dashboard
  getDashboardStats: async () => {
    const response = await apiClient.get('/vendors/dashboard');
    return response.data;
  },

  // Products
  getProducts: async () => {
    const response = await apiClient.get('/vendors/products');
    return response.data;
  },
  getCategories: async () => {
    const response = await apiClient.get('/categories');
    return response.data;
  },
  getBrands: async () => {
    const response = await apiClient.get('/products/brands');
    return response.data;
  },
  addProduct: async (productData: any) => {
    const response = await apiClient.post('/vendors/products', productData);
    return response.data;
  },
  updateProduct: async (id: string, productData: any) => {
    const response = await apiClient.put(`/vendors/products/${id}`, productData);
    return response.data;
  },
  deleteProduct: async (id: string) => {
    const response = await apiClient.delete(`/vendors/products/${id}`);
    return response.data;
  },

  // Orders
  getOrders: async () => {
    const response = await apiClient.get('/vendors/orders');
    return response.data;
  },
  updateOrderStatus: async (id: string, status: string) => {
    const response = await apiClient.patch(`/vendors/orders/${id}/status`, { status });
    return response.data;
  },

  // Wallet
  getWalletDetails: async () => {
    const response = await apiClient.get('/vendors/wallet');
    return response.data;
  },
  requestPayout: async (amount: number) => {
    const response = await apiClient.post('/vendors/wallet/withdraw', { amount });
    return response.data;
  },

  // Profile
  getProfile: async () => {
    const response = await apiClient.get('/vendors/profile');
    return response.data;
  },
  updateProfile: async (profileData: any) => {
    const response = await apiClient.put('/vendors/profile', profileData);
    return response.data;
  },

  // Upload
  uploadImage: async (fileUri: string, fileType: string, fileName: string) => {
    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      type: fileType,
      name: fileName,
    } as any);

    const response = await apiClient.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data; // Expected to return { url: '...' }
  }
};
