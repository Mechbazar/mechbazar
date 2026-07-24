import { apiClient } from './client';

export const riderService = {
  // Must be called before login/register can succeed with a real OTP -- it's
  // what actually creates the PhoneOtp row (or sends the real SMS in
  // production). Without this step there is no way to obtain a valid OTP; the
  // dev-bypass '123456' only works for phones explicitly allow-listed via
  // DEV_OTP_BYPASS_PHONES on the backend.
  sendOtp: async (phone: string) => {
    const response = await apiClient.post('/auth/send-otp', { phone });
    return response.data; // { success, message, otp? (dev/test only) }
  },

  // Auth — riders have no password set by admin creation, so login goes
  // through the same phone+OTP path as everyone else, not a dedicated
  // /riders/login endpoint.
  login: async (credentials: { phone: string; otp: string }) => {
    const response = await apiClient.post('/auth/login', credentials);
    return response.data; // { user, token }
  },

  // Self-registration — riders can only be created through the app from here
  // on; admin's quick-create in the admin panel is a separate, still-instant
  // path for admin-vetted riders. Returns a token so the wizard can continue
  // authenticated right after this call.
  register: async (data: { phone: string; otp: string; name: string; email?: string }) => {
    const response = await apiClient.post('/riders/register', data);
    return response.data; // { user, deliveryProfile, token }
  },

  // KYC/registration fields — called once per wizard step or once at the end,
  // reachable at any application status (a rejected rider needs it to fix and
  // resubmit).
  updateRegistration: async (data: Record<string, unknown>) => {
    const response = await apiClient.patch('/riders/me/registration', data);
    return response.data;
  },

  // KYC document upload (Aadhaar, DL front/back, RC, insurance, PUC, selfie).
  // Stored privately -- never a publicly reachable URL, unlike uploadImage below.
  uploadDocument: async (type: string, fileUri: string, fileType: string, fileName: string) => {
    const formData = new FormData();
    formData.append('type', type);
    formData.append('file', { uri: fileUri, type: fileType, name: fileName } as any);
    const response = await apiClient.post('/riders/me/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // Submits the completed application for admin review. Backend validates
  // completeness and returns { error, missing: string[] } if anything's absent.
  submitForApproval: async () => {
    const response = await apiClient.post('/riders/me/submit');
    return response.data;
  },

  // Profile
  getProfile: async () => {
    const response = await apiClient.get('/riders/me');
    return response.data;
  },

  // Availability (Available/Offline toggle — isActive stays admin-only)
  updateAvailability: async (isOnline: boolean) => {
    const response = await apiClient.patch('/riders/me/availability', { isOnline });
    return response.data;
  },

  // Location ping
  updateLocation: async (lat: number, lng: number) => {
    const response = await apiClient.patch('/riders/me/location', { lat, lng });
    return response.data;
  },

  // Push token registration
  registerPushToken: async (token: string) => {
    await apiClient.post('/riders/me/push-token', { token });
  },

  // Called on logout -- an Expo push token identifies the device, not the
  // account, so leaving it registered on a shared/reset device would keep
  // sending this rider's job/earnings notifications to whoever logs in next.
  clearPushToken: async () => {
    await apiClient.delete('/riders/me/push-token');
  },

  // Deliveries
  getMyDeliveries: async () => {
    const response = await apiClient.get('/riders/me/deliveries');
    return response.data;
  },
  updateDeliveryStatus: async (
    orderId: string,
    payload: { status: string; proofImageUrl?: string; codCollected?: boolean; issueReason?: string; otp?: string }
  ) => {
    const response = await apiClient.patch(`/riders/me/deliveries/${orderId}/status`, payload);
    return response.data;
  },
  // Generates a delivery code sent to the customer -- the rider must ask the
  // customer to read it aloud, then pass it back via updateDeliveryStatus's
  // `otp` field to confirm DELIVERED. Deliberately never returned here.
  generateDeliveryOtp: async (orderId: string) => {
    const response = await apiClient.post(`/riders/me/deliveries/${orderId}/generate-otp`);
    return response.data;
  },

  // Wallet & Earnings
  getMyEarnings: async () => {
    const response = await apiClient.get('/riders/me/earnings');
    return response.data;
  },
  addBankAccount: async (data: { accountHolderName: string; bankName: string; accountNumber: string; ifscCode: string }) => {
    const response = await apiClient.post('/riders/me/bank', data);
    return response.data;
  },
  requestPayout: async (amount: number) => {
    const response = await apiClient.post('/riders/me/wallet/withdraw', { amount });
    return response.data;
  },

  // Upload (generic endpoint, reused for delivery-proof photos)
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
