import { apiClient } from './client';
import type { NotificationItem, NotificationPage } from './notificationTypes';

export const vendorService = {
  // Auth. `credentials` is one of:
  //  - { idToken } -- Firebase email/password ID token (apps/vendor web)
  //  - { email, password } -- legacy path, kept for already-registered vendors
  //  - { phone, otp } -- Firebase phone-auth ID token (apps/seller-mobile),
  //    same shared phone identity every other role resolves through.
  login: async (credentials: any) => {
    const response = await apiClient.post('/vendors/login', credentials);
    return response.data;
  },

  // Self-registration wizard — mirrors apps/vendor web's 4-step flow
  // (personal -> business -> bank -> documents -> submit). Each step after
  // the first requires the token returned here. `otp` is a Firebase phone ID
  // token (apps/seller-mobile/src/services/phoneAuth.ts) -- required, so a
  // vendor's phone is proven the same way Customer/Rider/Mechanic prove
  // theirs, and resolves to the same shared identity if this phone already
  // has an account under another role.
  register: async (data: { name: string; phone: string; otp: string; email?: string; password: string }) => {
    const response = await apiClient.post('/vendors/register', data);
    return response.data; // { token, user, vendor }
  },
  updateBusiness: async (data: {
    storeName: string; gstNumber?: string; panNumber: string; businessType: string; city: string; state: string;
    addressLine1?: string; addressLine2?: string; pincode?: string; country?: string | null;
    lat?: number | null; lng?: number | null; placeId?: string | null; formattedAddress?: string | null;
  }) => {
    const response = await apiClient.post('/vendors/business', data);
    return response.data;
  },
  addBankAccount: async (data: { accountHolderName: string; bankName: string; accountNumber: string; ifscCode: string }) => {
    const response = await apiClient.post('/vendors/bank', data);
    return response.data;
  },
  // Multipart upload straight to /vendors/documents -- the backend stores
  // the bytes in Postgres (VendorDocument.fileData), never a public URL.
  // Mirrors riderService/technicianService's identical KYC-document upload.
  uploadDocument: async (type: string, fileUri: string, fileType: string, fileName: string) => {
    const formData = new FormData();
    formData.append('type', type);
    formData.append('file', { uri: fileUri, type: fileType, name: fileName } as any);
    const response = await apiClient.post('/vendors/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
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
    return response.data as NotificationItem[];
  },
  // Paginated/search/filter variant -- omitting all params returns the same
  // plain array as getNotifications above (see customer.controller.ts).
  getNotificationsPage: async (params: { cursor?: string; limit?: number; category?: string; q?: string }) => {
    const response = await apiClient.get('/customers/notifications', { params });
    return response.data as NotificationPage;
  },
  markNotificationRead: async (id: string) => {
    const response = await apiClient.patch(`/customers/notifications/${id}/read`);
    return response.data;
  },
  markAllNotificationsRead: async () => {
    const response = await apiClient.patch('/customers/notifications/read-all');
    return response.data as { updated: number };
  },
  markNotificationOpened: async (id: string) => {
    await apiClient.post(`/customers/notifications/${id}/opened`);
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
