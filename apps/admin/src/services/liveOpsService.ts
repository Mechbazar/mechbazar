import axios from 'axios';
import { API_URL } from '../config/api';

// Admin client for the emergency-dispatch live-ops API
// (backend routes/job.routes.ts, /admin/* group). Plain axios rather than
// packages/shared's apiClient -- that client is wired to expo-secure-store
// for the RN apps and has no place on the web bundle; every other admin page
// in this codebase (ServicesDashboard.tsx et al.) calls axios directly with
// the Bearer token from Redux/localStorage the same way this does.

const authHeaders = (token: string) => ({ Authorization: `Bearer ${token}` });

export interface LiveOpsJobRow {
  id: string;
  bookingNumber: string;
  status: string;
  isEmergency: boolean;
  createdAt: string;
  ageSeconds: number;
  alert: { level: 'ok' | 'warn' | 'critical'; reason: string | null };
  customer: { id: string; name: string | null; phone: string };
  customerLocation: { lat: number | null; lng: number | null; city: string; pincode: string };
  category: string;
  package: string;
  vehicle: string;
  issueDescription: string | null;
  amount: number;
  paymentStatus: string;
  dispatch: { wave: number; radiusKm: number | null; offersMade: number; startedAt: string | null };
  verification: { startOtpVerifiedAt: string | null; completionOtpVerifiedAt: string | null; verifiedByCustomer: boolean };
  tracking: { etaSeconds: number | null; distanceRemainingM: number | null; distanceTravelledKm: number; isLive: boolean };
  photoCount: number;
  technician: {
    id: string; name: string | null; phone: string | null; rating: number;
    lat: number | null; lng: number | null; lastLocationAt: string | null; locationStale: boolean;
  } | null;
}

export interface LiveOpsMechanicRow {
  id: string;
  name: string | null;
  lat: number | null;
  lng: number | null;
  headingDeg: number | null;
  rating: number;
  lastLocationAt: string | null;
  busy: boolean;
}

export interface LiveOpsResponse {
  jobs: LiveOpsJobRow[];
  mechanics: LiveOpsMechanicRow[];
  stats: { pendingAssignment: number; enRoute: number; working: number; needsReassignmentToday: number; mechanicsOnline: number };
  serverTime: string;
}

export interface DispatchMetrics {
  windowHours: number;
  jobs: { created: number; filled: number; unfilled: number; cancelled: number; fillRate: number | null };
  offers: Record<string, number>;
  timeToAcceptSeconds: { p50: number | null; p90: number | null; p99: number | null };
  travelSeconds: { p50: number | null; p90: number | null };
  workSeconds: { p50: number | null; p90: number | null };
  waveDistribution: Record<number, number>;
}

export const liveOpsService = {
  getLiveOps: async (token: string): Promise<LiveOpsResponse> => {
    const res = await axios.get(`${API_URL}/jobs/admin/live`, { headers: authHeaders(token) });
    return res.data;
  },

  getJobDetail: async (token: string, id: string) => {
    const res = await axios.get(`${API_URL}/jobs/admin/${id}`, { headers: authHeaders(token) });
    return res.data;
  },

  getMetrics: async (token: string, hours = 24): Promise<DispatchMetrics> => {
    const res = await axios.get(`${API_URL}/jobs/admin/metrics`, { headers: authHeaders(token), params: { hours } });
    return res.data;
  },

  assign: async (token: string, id: string, technicianId: string) => {
    const res = await axios.post(`${API_URL}/jobs/admin/${id}/assign`, { technicianId }, { headers: authHeaders(token) });
    return res.data;
  },

  redispatch: async (token: string, id: string) => {
    const res = await axios.post(`${API_URL}/jobs/admin/${id}/redispatch`, {}, { headers: authHeaders(token) });
    return res.data;
  },

  forceStatus: async (token: string, id: string, status: string, reason: string) => {
    const res = await axios.post(`${API_URL}/jobs/admin/${id}/force-status`, { status, reason }, { headers: authHeaders(token) });
    return res.data;
  },

  // Assignable technicians reuses the existing scheduled-booking endpoint --
  // "approved, right vehicle type, ranked by distance" is the same query
  // regardless of which flow the booking came from.
  getAssignableTechnicians: async (token: string, id: string) => {
    const res = await axios.get(`${API_URL}/services/bookings/${id}/assignable-technicians`, { headers: authHeaders(token) });
    return res.data as { id: string; name: string | null; rating: number; distanceKm: number | null; isOnline: boolean; isBusy: boolean }[];
  },
};
