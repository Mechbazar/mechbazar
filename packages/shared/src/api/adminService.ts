import { apiClient } from './client';

// Mirrors apps/admin (web) exactly — one method per backend endpoint the
// Admin Panel calls. The web panel hardcodes two different ports across its
// pages (:5000 vs a broken :5005 reference); this service always goes
// through the single configured apiClient base URL (the real backend),
// never the broken port.
export const adminService = {
  // Auth
  login: async (credentials: { email: string; password: string }) => {
    const response = await apiClient.post('/auth/admin/login', credentials);
    return response.data; // { user, token }
  },

  // Dashboard
  getDashboardStats: async () => {
    const response = await apiClient.get('/admin/dashboard');
    return response.data; // { stats, recentOrders, topSellingProducts }
  },

  // Orders
  getAllOrders: async () => {
    const response = await apiClient.get('/orders/all');
    return response.data;
  },
  assignRider: async (orderId: string, riderId: string) => {
    const response = await apiClient.put(`/orders/${orderId}/assign-rider`, { riderId });
    return response.data;
  },
  updateOrderStatus: async (orderId: string, status: string) => {
    const response = await apiClient.put(`/orders/${orderId}/status`, { status });
    return response.data;
  },

  // Products
  getProducts: async () => {
    const response = await apiClient.get('/products');
    return response.data;
  },
  createProduct: async (data: any) => {
    const response = await apiClient.post('/products', data);
    return response.data;
  },
  updateProduct: async (id: string, data: any) => {
    const response = await apiClient.put(`/products/${id}`, data);
    return response.data;
  },
  updateProductStatus: async (id: string, status: string) => {
    const response = await apiClient.patch(`/products/${id}/status`, { status });
    return response.data;
  },
  deleteProduct: async (id: string) => {
    const response = await apiClient.delete(`/products/${id}`);
    return response.data;
  },

  // Categories
  getCategories: async () => {
    const response = await apiClient.get('/categories');
    return response.data;
  },
  createCategory: async (data: any) => {
    const response = await apiClient.post('/categories', data);
    return response.data;
  },
  updateCategory: async (id: string, data: any) => {
    const response = await apiClient.put(`/categories/${id}`, data);
    return response.data;
  },
  deleteCategory: async (id: string) => {
    const response = await apiClient.delete(`/categories/${id}`);
    return response.data;
  },

  // Vendors
  getVendors: async () => {
    const response = await apiClient.get('/vendors');
    return response.data;
  },
  createVendor: async (data: any) => {
    const response = await apiClient.post('/vendors', data);
    return response.data;
  },
  updateVendor: async (id: string, data: any) => {
    const response = await apiClient.put(`/vendors/${id}`, data);
    return response.data;
  },
  updateVendorStatus: async (vendorProfileId: string, status: string) => {
    const response = await apiClient.patch(`/vendors/${vendorProfileId}/status`, { status });
    return response.data;
  },

  // Customers
  getCustomers: async () => {
    const response = await apiClient.get('/customers');
    return response.data;
  },
  updateCustomer: async (id: string, data: any) => {
    const response = await apiClient.patch(`/customers/${id}`, data);
    return response.data;
  },

  // Riders
  getRiders: async () => {
    const response = await apiClient.get('/riders');
    return response.data;
  },
  createRider: async (data: any) => {
    const response = await apiClient.post('/riders', data);
    return response.data;
  },
  updateRider: async (id: string, data: any) => {
    const response = await apiClient.put(`/riders/${id}`, data);
    return response.data;
  },
  getRiderById: async (id: string) => {
    const response = await apiClient.get(`/riders/${id}`);
    return response.data;
  },
  // id is the DeliveryPartner id (rider.deliveryProfile.id), mirroring
  // updateVendorStatus's use of the profile id rather than the user id.
  updateRiderStatus: async (deliveryPartnerId: string, status: string, remarks?: string) => {
    const response = await apiClient.patch(`/riders/${deliveryPartnerId}/status`, { status, remarks });
    return response.data;
  },
  updateRiderDocumentStatus: async (deliveryPartnerId: string, documentId: string, status: string, remarks?: string) => {
    const response = await apiClient.patch(`/riders/${deliveryPartnerId}/documents/${documentId}/status`, { status, remarks });
    return response.data;
  },

  // Service Categories (Doorstep Services)
  getServiceCategories: async () => {
    const response = await apiClient.get('/services/categories');
    return response.data;
  },
  createServiceCategory: async (data: any) => {
    const response = await apiClient.post('/services/categories', data);
    return response.data;
  },
  updateServiceCategory: async (id: string, data: any) => {
    const response = await apiClient.put(`/services/categories/${id}`, data);
    return response.data;
  },
  deleteServiceCategory: async (id: string) => {
    const response = await apiClient.delete(`/services/categories/${id}`);
    return response.data;
  },

  // Service Technicians / Mechanics (Doorstep Services)
  getTechnicians: async () => {
    const response = await apiClient.get('/technicians');
    return response.data;
  },
  createTechnician: async (data: any) => {
    const response = await apiClient.post('/technicians', data);
    return response.data;
  },
  updateTechnician: async (id: string, data: any) => {
    const response = await apiClient.put(`/technicians/${id}`, data);
    return response.data;
  },
  // id is the ServiceTechnician profile id (technician.technicianProfile.id),
  // mirroring updateRiderStatus's use of the profile id rather than the user id.
  updateTechnicianStatus: async (technicianProfileId: string, status: string, remarks?: string) => {
    const response = await apiClient.patch(`/technicians/${technicianProfileId}/status`, { status, remarks });
    return response.data;
  },

  // Service Bookings (Doorstep Services) -- mirrors apps/admin's
  // ServiceBookingsPage.tsx. Called with no params, this returns the plain
  // flat array (same backward-compatible default the web admin's other two
  // callers rely on); pass { page, limit } to opt into the paginated
  // { bookings, total, page, pages } envelope instead.
  getServiceBookings: async (params?: Record<string, string | number>) => {
    const response = await apiClient.get('/services/bookings/all', { params });
    return response.data;
  },
  getServiceBookingById: async (id: string) => {
    const response = await apiClient.get(`/services/bookings/${id}`);
    return response.data;
  },
  getServiceDashboard: async () => {
    const response = await apiClient.get('/services/dashboard');
    return response.data;
  },
  getAssignableTechniciansForBooking: async (bookingId: string) => {
    const response = await apiClient.get(`/services/bookings/${bookingId}/assignable-technicians`);
    return response.data;
  },
  assignTechnicianToBooking: async (bookingId: string, technicianId: string) => {
    const response = await apiClient.post(`/services/bookings/${bookingId}/assign`, { technicianId });
    return response.data;
  },
  updateServiceBookingAdminStatus: async (bookingId: string, status: string) => {
    const response = await apiClient.patch(`/services/bookings/${bookingId}/admin-status`, { status });
    return response.data;
  },

  // Coupons
  getCoupons: async () => {
    const response = await apiClient.get('/coupons');
    return response.data;
  },
  createCoupon: async (data: any) => {
    const response = await apiClient.post('/coupons', data);
    return response.data;
  },
  updateCoupon: async (id: string, data: any) => {
    const response = await apiClient.put(`/coupons/${id}`, data);
    return response.data;
  },
  deleteCoupon: async (id: string) => {
    const response = await apiClient.delete(`/coupons/${id}`);
    return response.data;
  },

  // Banners
  getBanners: async () => {
    const response = await apiClient.get('/banners');
    return response.data;
  },
  createBanner: async (data: any) => {
    const response = await apiClient.post('/banners', data);
    return response.data;
  },
  updateBanner: async (id: string, data: any) => {
    const response = await apiClient.put(`/banners/${id}`, data);
    return response.data;
  },
  deleteBanner: async (id: string) => {
    const response = await apiClient.delete(`/banners/${id}`);
    return response.data;
  },

  // Payouts / Settlements
  getSettlements: async () => {
    const response = await apiClient.get('/vendors/settlements');
    return response.data;
  },
  updateSettlementStatus: async (id: string, data: { status: string; transactionId?: string }) => {
    const response = await apiClient.patch(`/vendors/settlements/${id}/status`, data);
    return response.data;
  },

  // Inventory
  getInventory: async () => {
    const response = await apiClient.get('/inventory');
    return response.data;
  },
  adjustStock: async (data: { inventoryId: string; newQuantity: number; reason: string; actionType: string }) => {
    const response = await apiClient.post('/inventory/adjust', data);
    return response.data;
  },

  // Warehouses
  getWarehouses: async () => {
    const response = await apiClient.get('/warehouses');
    return response.data;
  },
  createWarehouse: async (data: any) => {
    const response = await apiClient.post('/warehouses', data);
    return response.data;
  },
  updateWarehouse: async (id: string, data: any) => {
    const response = await apiClient.put(`/warehouses/${id}`, data);
    return response.data;
  },

  // Suppliers
  getSuppliers: async () => {
    const response = await apiClient.get('/suppliers');
    return response.data;
  },
  createSupplier: async (data: any) => {
    const response = await apiClient.post('/suppliers', data);
    return response.data;
  },
  updateSupplier: async (id: string, data: any) => {
    const response = await apiClient.put(`/suppliers/${id}`, data);
    return response.data;
  },

  // Purchase Orders
  getPurchaseOrders: async () => {
    const response = await apiClient.get('/purchase-orders');
    return response.data;
  },
  createPurchaseOrder: async (data: any) => {
    const response = await apiClient.post('/purchase-orders', data);
    return response.data;
  },

  // Upload (banner/product images)
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
    return response.data; // { url }
  },
};
