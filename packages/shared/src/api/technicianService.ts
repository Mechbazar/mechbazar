import { apiClient } from './client';

export const technicianService = {
  // Auth — technicians have no password set by admin creation, so login goes
  // through the same phone+OTP path as everyone else (the dev bypass OTP is
  // '123456'), not a dedicated /technicians/login endpoint.
  login: async (credentials: { phone: string; otp: string }) => {
    const response = await apiClient.post('/auth/login', credentials);
    return response.data; // { user, token }
  },

  // Self-registration. Returns a token so the wizard can continue
  // authenticated right after this call.
  register: async (data: { phone: string; otp: string; name: string; email?: string }) => {
    const response = await apiClient.post('/technicians/register', data);
    return response.data; // { user, technicianProfile, token }
  },

  // KYC/registration fields — called once per wizard step or once at the end,
  // reachable at any application status (a rejected technician needs it to
  // fix and resubmit).
  updateRegistration: async (data: Record<string, unknown>) => {
    const response = await apiClient.patch('/technicians/me/registration', data);
    return response.data;
  },

  // KYC document upload (Aadhaar, selfie). Stored privately — never a
  // publicly reachable URL.
  uploadDocument: async (type: string, fileUri: string, fileType: string, fileName: string) => {
    const formData = new FormData();
    formData.append('type', type);
    formData.append('file', { uri: fileUri, type: fileType, name: fileName } as any);
    const response = await apiClient.post('/technicians/me/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // Submits the completed application for admin review. Backend validates
  // completeness and returns { error, missing: string[] } if anything's absent.
  submitForApproval: async () => {
    const response = await apiClient.post('/technicians/me/submit');
    return response.data;
  },

  // Profile
  getProfile: async () => {
    const response = await apiClient.get('/technicians/me');
    return response.data;
  },

  // Availability (Available/Offline toggle — isActive stays admin-only)
  updateAvailability: async (isOnline: boolean) => {
    const response = await apiClient.patch('/technicians/me/availability', { isOnline });
    return response.data;
  },

  // Location ping
  updateLocation: async (lat: number, lng: number) => {
    const response = await apiClient.patch('/technicians/me/location', { lat, lng });
    return response.data;
  },

  // Push token registration
  registerPushToken: async (token: string) => {
    await apiClient.post('/technicians/me/push-token', { token });
  },

  // Bookings — the technician-scoped list omits images/statusHistory/invoice,
  // so booking detail is fetched from the richer shared endpoint instead.
  getMyBookings: async () => {
    const response = await apiClient.get('/technicians/me/bookings');
    return response.data;
  },
  getBookingById: async (id: string) => {
    const response = await apiClient.get(`/services/bookings/${id}`);
    return response.data;
  },
  updateBookingStatus: async (id: string, status: string, extra?: { otp?: string }) => {
    const response = await apiClient.patch(`/technicians/me/bookings/${id}/status`, { status, ...extra });
    return response.data;
  },
  // MECHANIC_ASSIGNED -> MECHANIC_ACCEPTED, or MECHANIC_ASSIGNED -> REJECTED
  // (backend auto-attempts reassignment to another technician on reject).
  acceptBookingJob: async (id: string) => {
    const response = await apiClient.post(`/technicians/me/bookings/${id}/accept`);
    return response.data;
  },
  rejectBookingJob: async (id: string, reason?: string) => {
    const response = await apiClient.post(`/technicians/me/bookings/${id}/reject`, { reason });
    return response.data;
  },
  // Generates a completion OTP and sends it to the customer -- never returned
  // to the technician's own client; they must ask the customer for it.
  generateBookingOtp: async (id: string) => {
    const response = await apiClient.post(`/technicians/me/bookings/${id}/generate-otp`);
    return response.data;
  },
  requestBookingApproval: async (id: string, additionalCost: number, approvalNote: string) => {
    const response = await apiClient.post(`/technicians/me/bookings/${id}/approval-request`, {
      additionalCost,
      approvalNote,
    });
    return response.data;
  },

  // Booking photos (ISSUE/BEFORE/AFTER/ADDITIONAL_WORK) — dedicated private
  // endpoint, unlike rider's generic /upload.
  uploadBookingImage: async (
    bookingId: string,
    fileUri: string,
    fileType: string,
    fileName: string,
    type: 'BEFORE' | 'AFTER' | 'ADDITIONAL_WORK'
  ) => {
    const formData = new FormData();
    formData.append('type', type);
    formData.append('file', { uri: fileUri, type: fileType, name: fileName } as any);
    const response = await apiClient.post(`/services/bookings/${bookingId}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // Chat (polling-based, no realtime infra — matches apps/mobile's 5s poll)
  getBookingMessages: async (bookingId: string) => {
    const response = await apiClient.get(`/services/bookings/${bookingId}/messages`);
    return response.data;
  },
  sendBookingMessage: async (bookingId: string, message: string) => {
    const response = await apiClient.post(`/services/bookings/${bookingId}/messages`, { message });
    return response.data;
  },

  // Invoice (generated lazily on first fetch if COMPLETED and missing)
  getBookingInvoice: async (bookingId: string) => {
    const response = await apiClient.get(`/services/bookings/${bookingId}/invoice`);
    return response.data;
  },

  // Wallet & Earnings
  getMyEarnings: async () => {
    const response = await apiClient.get('/technicians/me/earnings');
    return response.data;
  },
  addBankAccount: async (data: { accountHolderName: string; bankName: string; accountNumber: string; ifscCode: string }) => {
    const response = await apiClient.post('/technicians/me/bank', data);
    return response.data;
  },
  requestPayout: async (amount: number) => {
    const response = await apiClient.post('/technicians/me/wallet/withdraw', { amount });
    return response.data;
  },
};
