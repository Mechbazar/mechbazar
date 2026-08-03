import { apiClient } from './client';

// Client for the emergency-dispatch API (backend routes/job.routes.ts). One
// module shared by the customer app, the mechanic app and (for the
// admin-only calls) the admin panel, so all three agree on request/response
// shape by construction rather than by convention.

export interface JobVehicle {
  type: 'CAR' | 'BIKE';
  brand: string;
  model: string;
  fuelType?: string | null;
  registrationNumber?: string | null;
}

export interface JobTimelineStep {
  key: string;
  label: string;
  at: string | null;
  done: boolean;
}

export interface JobTechnician {
  id: string;
  name: string | null;
  rating: number;
  totalJobs: number;
  experienceYears?: number | null;
  skills?: string[];
  photoUrl: string;
  currentLat: number | null;
  currentLng: number | null;
  lastLocationAt: string | null;
}

export interface ContactAvailability {
  canCall: boolean;
  canChat: boolean;
  reason: string | null;
}

export interface Job {
  id: string;
  bookingNumber: string;
  isEmergency: boolean;
  status: string;
  statusMessage: string;
  createdAt: string;
  updatedAt: string;
  vehicle: JobVehicle;
  category: { id: string; name: string; icon: string | null };
  package: { id: string; name: string; estimatedMinutes: number };
  issueDescription: string | null;
  customerNotes: string | null;
  landmark: string | null;
  location: { lat: number | null; lng: number | null; addressText: string; city: string; pincode: string };
  pricing: { estimatedCost: number; additionalCost: number; finalAmount: number; approvalStatus: string | null; approvalNote: string | null };
  payment: { method: string; status: string; amount: number } | null;
  dispatch: { wave: number; radiusKm: number | null; startedAt: string | null; endedAt: string | null };
  tracking: {
    etaSeconds: number | null;
    distanceRemainingM: number | null;
    etaUpdatedAt: string | null;
    routePolyline: string | null;
    distanceTravelledKm: number;
    isLive: boolean;
    pingIntervalSeconds: number;
  };
  verification: { verifiedByCustomer: boolean; startOtpVerifiedAt: string | null; completionOtpVerifiedAt: string | null };
  timeline: JobTimelineStep[];
  technician: JobTechnician | null;
  contact: ContactAvailability;
  review: { rating: number; comment: string | null; createdAt: string } | null;
  cancelReason: string | null;
  // Present only on the technician-viewed and admin-viewed projections.
  customer?: { id?: string; name: string | null; phone?: string };
}

export interface CreateEmergencyJobPayload {
  categoryId: string;
  packageId: string;
  addressId: string;
  vehicleType: 'CAR' | 'BIKE';
  vehicleBrand: string;
  vehicleModel: string;
  vehicleFuelType?: string;
  vehicleRegistrationNumber?: string;
  userVehicleId?: string | null;
  issueDescription?: string;
  landmark?: string;
  customerNotes?: string;
  jobLat?: number;
  jobLng?: number;
  jobAddressText?: string;
}

export interface OfferSummary {
  offerId: string;
  bookingId: string;
  bookingNumber: string;
  wave: number;
  distanceKm: number | null;
  etaSeconds: number | null;
  expiresAt: string;
  expiresInSeconds: number;
  category: string;
  packageName: string;
  estimatedCost: number;
  vehicle: JobVehicle;
  issueDescription: string | null;
  area: string;
}

// Errors from this API always carry { error, code } -- surfaced as-is so a
// screen can switch on `err.code` (e.g. 'OFFER_EXPIRED') instead of
// string-matching `err.message`.
export interface ApiErrorShape {
  error: string;
  code?: string;
}

function unwrapError(err: any): ApiErrorShape {
  return err?.response?.data?.error
    ? { error: err.response.data.error, code: err.response.data.code }
    : { error: 'Network error. Please try again.' };
}

export const jobService = {
  // ---- Customer ----

  createEmergencyJob: async (payload: CreateEmergencyJobPayload): Promise<{ job?: Job } & Partial<ApiErrorShape>> => {
    try {
      const res = await apiClient.post('/jobs', payload);
      return res.data;
    } catch (err) {
      return unwrapError(err);
    }
  },

  getMyActiveJob: async (): Promise<Job | null> => {
    try {
      const res = await apiClient.get('/jobs/active');
      return res.data.job;
    } catch {
      return null;
    }
  },

  getJob: async (id: string): Promise<Job | null> => {
    try {
      const res = await apiClient.get(`/jobs/${id}`);
      return res.data.job;
    } catch {
      return null;
    }
  },

  getOtp: async (id: string, purpose: 'START' | 'COMPLETION'): Promise<{ code: string; expiresAt: string } | ApiErrorShape> => {
    try {
      const res = await apiClient.get(`/jobs/${id}/otp`, { params: { purpose } });
      return res.data;
    } catch (err) {
      return unwrapError(err);
    }
  },

  cancelJob: async (id: string, reason?: string): Promise<{ ok: boolean } & Partial<ApiErrorShape>> => {
    try {
      const res = await apiClient.post(`/jobs/${id}/cancel`, { reason });
      return { ok: true, job: res.data.job } as any;
    } catch (err) {
      return { ok: false, ...unwrapError(err) };
    }
  },

  getTrail: async (id: string): Promise<{ lat: number; lng: number; recordedAt: string }[]> => {
    try {
      const res = await apiClient.get(`/jobs/${id}/trail`);
      return res.data.trail;
    } catch {
      return [];
    }
  },

  rateJob: async (id: string, rating: number, comment?: string, imageUri?: string): Promise<{ ok: boolean } & Partial<ApiErrorShape>> => {
    try {
      if (imageUri) {
        const formData = new FormData();
        formData.append('rating', String(rating));
        if (comment) formData.append('comment', comment);
        const filename = imageUri.split('/').pop() || 'feedback.jpg';
        formData.append('file', { uri: imageUri, name: filename, type: 'image/jpeg' } as any);
        await apiClient.post(`/jobs/${id}/rating`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await apiClient.post(`/jobs/${id}/rating`, { rating, comment });
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, ...unwrapError(err) };
    }
  },

  callCounterparty: async (id: string): Promise<{ message: string; virtualNumber: string } | ApiErrorShape> => {
    try {
      const res = await apiClient.post(`/jobs/${id}/call`);
      return res.data;
    } catch (err) {
      return unwrapError(err);
    }
  },

  listPhotos: async (id: string) => {
    try {
      const res = await apiClient.get(`/jobs/${id}/photos`);
      return res.data.images as { id: string; type: string; uploadedByRole: string; capturedAt: string | null; createdAt: string }[];
    } catch {
      return [];
    }
  },

  uploadPhoto: async (
    id: string,
    fileUri: string,
    type: 'ISSUE' | 'BEFORE' | 'DURING' | 'AFTER' | 'ADDITIONAL_WORK' | 'FEEDBACK',
    coords?: { lat: number; lng: number }
  ): Promise<{ ok: boolean } & Partial<ApiErrorShape>> => {
    try {
      const formData = new FormData();
      const filename = fileUri.split('/').pop() || 'photo.jpg';
      formData.append('file', { uri: fileUri, name: filename, type: 'image/jpeg' } as any);
      formData.append('type', type);
      formData.append('capturedAt', new Date().toISOString());
      if (coords) {
        formData.append('lat', String(coords.lat));
        formData.append('lng', String(coords.lng));
      }
      await apiClient.post(`/jobs/${id}/photos`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      return { ok: true };
    } catch (err) {
      return { ok: false, ...unwrapError(err) };
    }
  },

  photoFileUrl: (imageId: string) => `/services/bookings/images/${imageId}/file`,
  technicianPhotoUrl: (jobId: string) => `/services/bookings/${jobId}/technician-photo`,

  // ---- Mechanic ----

  getMyOffers: async (): Promise<OfferSummary[]> => {
    try {
      const res = await apiClient.get('/jobs/offers');
      return res.data.offers;
    } catch {
      return [];
    }
  },

  acceptJob: async (id: string): Promise<{ job?: Job } & Partial<ApiErrorShape>> => {
    try {
      const res = await apiClient.post(`/jobs/${id}/accept`);
      return res.data;
    } catch (err) {
      return unwrapError(err);
    }
  },

  declineJob: async (id: string, reason?: string): Promise<{ ok: boolean }> => {
    try {
      await apiClient.post(`/jobs/${id}/decline`, { reason });
      return { ok: true };
    } catch {
      return { ok: false };
    }
  },

  markEnRoute: async (id: string): Promise<{ job?: Job } & Partial<ApiErrorShape>> => {
    try {
      const res = await apiClient.post(`/jobs/${id}/en-route`);
      return res.data;
    } catch (err) {
      return unwrapError(err);
    }
  },

  markArrived: async (id: string): Promise<{ job?: Job } & Partial<ApiErrorShape>> => {
    try {
      const res = await apiClient.post(`/jobs/${id}/arrived`);
      return res.data;
    } catch (err) {
      return unwrapError(err);
    }
  },

  startWork: async (id: string, otp: string): Promise<{ job?: Job } & Partial<ApiErrorShape>> => {
    try {
      const res = await apiClient.post(`/jobs/${id}/start`, { otp });
      return res.data;
    } catch (err) {
      return unwrapError(err);
    }
  },

  requestCompletion: async (id: string): Promise<{ message?: string } & Partial<ApiErrorShape>> => {
    try {
      const res = await apiClient.post(`/jobs/${id}/request-completion`);
      return res.data;
    } catch (err) {
      return unwrapError(err);
    }
  },

  completeJob: async (id: string, otp: string): Promise<{ job?: Job } & Partial<ApiErrorShape>> => {
    try {
      const res = await apiClient.post(`/jobs/${id}/complete`, { otp });
      return res.data;
    } catch (err) {
      return unwrapError(err);
    }
  },

  postLocationBatch: async (id: string, pings: Record<string, unknown>[]) => {
    try {
      await apiClient.post(`/jobs/${id}/location`, { pings });
      return true;
    } catch {
      return false;
    }
  },

  // ---- Admin ----

  getLiveOps: async (includeScheduled = false) => {
    const res = await apiClient.get('/jobs/admin/live', { params: { includeScheduled } });
    return res.data;
  },

  getAdminJobDetail: async (id: string) => {
    const res = await apiClient.get(`/jobs/admin/${id}`);
    return res.data;
  },

  getDispatchMetrics: async (hours = 24) => {
    const res = await apiClient.get('/jobs/admin/metrics', { params: { hours } });
    return res.data;
  },

  adminAssign: async (id: string, technicianId: string) => {
    const res = await apiClient.post(`/jobs/admin/${id}/assign`, { technicianId });
    return res.data;
  },

  adminRedispatch: async (id: string) => {
    const res = await apiClient.post(`/jobs/admin/${id}/redispatch`);
    return res.data;
  },

  adminForceStatus: async (id: string, status: string, reason: string) => {
    const res = await apiClient.post(`/jobs/admin/${id}/force-status`, { status, reason });
    return res.data;
  },
};
