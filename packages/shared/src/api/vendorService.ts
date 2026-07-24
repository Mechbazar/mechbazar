import { apiClient } from './client';

export const vendorService = {
  // Auth
  login: async (credentials: any) => {
    const response = await apiClient.post('/vendors/login', credentials);
    return response.data;
  },

  // Self-registration wizard — mirrors apps/vendor web's 4-step flow
  // (personal -> business -> bank -> documents -> submit). Each step after
  // the first requires the token returned here.
  register: async (data: { name: string; phone: string; email?: string; password: string }) => {
    const response = await apiClient.post('/vendors/register', data);
    return response.data; // { token, user, vendor }
  },
  updateBusiness: async (data: { storeName: string; gstNumber?: string; panNumber: string; businessType: string; city: string; state: string }) => {
    const response = await apiClient.post('/vendors/business', data);
    return response.data;
  },
  addBankAccount: async (data: { accountHolderName: string; bankName: string; accountNumber: string; ifscCode: string }) => {
    const response = await apiClient.post('/vendors/bank', data);
    return response.data;
  },
  addDocument: async (type: string, url: string) => {
    const response = await apiClient.post('/vendors/documents', { type, url });
    return response.data;
  },
  // Uploads the file then attaches it as a KYC document in one call, same
  // two-step sequence the web Register page does by hand (POST /upload -> POST /vendors/documents).
  uploadDocument: async (type: string, fileUri: string, fileType: string, fileName: string) => {
    const upload = await vendorService.uploadImage(fileUri, fileType, fileName);
    return vendorService.addDocument(type, upload.url);
  },
  submitForApproval: async () => {
    const response = await apiClient.post('/vendors/submit');
    return response.data;
  },

  // Dashboard
  getDashboardStats: async () => {
    const response = await apiClient.get('/vendors/dashboard');
    return response.data;
  },
  getSalesChart: async (days: number = 30) => {
    const response = await apiClient.get(`/vendors/dashboard/sales-chart?days=${days}`);
    return response.data as { date: string; revenue: number; orders: number }[];
  },

  // Notifications -- reuses the generic /customers/notifications endpoints
  // (scoped by the authenticated user's own id server-side, not by role, so
  // this works for a vendor's own login the same as the customer app).
  getNotifications: async () => {
    const response = await apiClient.get('/customers/notifications');
    return response.data as { id: string; title: string; body: string; isRead: boolean; createdAt: string }[];
  },
  markNotificationRead: async (id: string) => {
    const response = await apiClient.patch(`/customers/notifications/${id}/read`);
    return response.data;
  },
  deleteNotification: async (id: string) => {
    await apiClient.delete(`/customers/notifications/${id}`);
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

  // Inventory
  getInventory: async () => {
    const response = await apiClient.get('/vendors/inventory');
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
