import { VehicleType } from '../types/product';
import {
  ServiceCategory, ServicePackage, TimeSlot, ServiceBooking, ServiceInvoice, ServiceChatMessage,
} from '../types/service';
import { API_BASE_URL, SERVER_ORIGIN } from './api';

const authHeaders = (token: string) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
});

const resolveImageUrl = (image?: string | null) => {
  if (!image) return null;
  return image.startsWith('/') ? `${SERVER_ORIGIN}${image}` : image;
};

// The backend never filters by status/isActive server-side (so the admin
// panel can find and re-enable disabled rows) -- mirrors product.service.ts's
// fetchCategories, which filters client-side for the same reason.
//
// Returns null (not []) on a network/API failure, distinct from a genuinely
// empty catalog, so the Services home screen can render a real error+retry
// state instead of silently looking like "zero services". Every other
// function in this file keeps swallowing to []/null on failure -- this is a
// deliberate, scoped exception for the one call whose failure should block
// the whole screen.
export const fetchServiceCategories = async (vehicleType: VehicleType): Promise<ServiceCategory[] | null> => {
  try {
    const res = await fetch(`${API_BASE_URL}/services/categories?vehicleType=${vehicleType}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data
      .filter((c: ServiceCategory) => c.status === 'Active')
      .map((c: ServiceCategory) => ({
        ...c,
        image: resolveImageUrl(c.image),
        packages: (c.packages || [])
          .filter((p) => p.isActive)
          .map((p) => ({ ...p, image: resolveImageUrl(p.image) })),
      }));
  } catch (err) {
    console.error('fetchServiceCategories failed', err);
    return null;
  }
};

export const fetchServiceCategoryById = async (categoryId: string): Promise<ServiceCategory | null> => {
  try {
    const res = await fetch(`${API_BASE_URL}/services/categories/${categoryId}`);
    if (!res.ok) return null;
    const c = await res.json();
    return { ...c, image: resolveImageUrl(c.image) };
  } catch (err) {
    console.error('fetchServiceCategoryById failed', err);
    return null;
  }
};

export const fetchServicePackageById = async (packageId: string): Promise<ServicePackage | null> => {
  try {
    const res = await fetch(`${API_BASE_URL}/services/packages/${packageId}`);
    if (!res.ok) return null;
    const p = await res.json();
    return { ...p, image: resolveImageUrl(p.image) };
  } catch (err) {
    console.error('fetchServicePackageById failed', err);
    return null;
  }
};

export const fetchServicePackages = async (categoryId: string): Promise<ServicePackage[]> => {
  try {
    const res = await fetch(`${API_BASE_URL}/services/packages?categoryId=${categoryId}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data
      .filter((p: ServicePackage) => p.isActive)
      .map((p: ServicePackage) => ({ ...p, image: resolveImageUrl(p.image) }));
  } catch (err) {
    console.error('fetchServicePackages failed', err);
    return [];
  }
};

export const fetchTimeSlots = async (date: string): Promise<TimeSlot[]> => {
  try {
    const res = await fetch(`${API_BASE_URL}/services/time-slots?date=${date}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.filter((s: TimeSlot) => s.isActive);
  } catch (err) {
    console.error('fetchTimeSlots failed', err);
    return [];
  }
};

interface CreateBookingPayload {
  userVehicleId?: string | null;
  vehicleType: VehicleType;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleFuelType?: string | null;
  vehicleRegistrationNumber?: string | null;
  categoryId: string;
  packageId: string;
  addressId: string;
  scheduledDate: string;
  timeSlotId: string;
  issueDescription?: string;
  payment_method: 'COD' | 'online';
}

export const createServiceBooking = async (
  token: string,
  payload: CreateBookingPayload
): Promise<{ booking?: ServiceBooking; error?: string }> => {
  try {
    const res = await fetch(`${API_BASE_URL}/services/bookings`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || 'Failed to create booking' };
    return { booking: data.booking };
  } catch (err) {
    console.error('createServiceBooking failed', err);
    return { error: 'Network error while creating booking' };
  }
};

export const fetchMyBookings = async (token: string): Promise<ServiceBooking[]> => {
  try {
    const res = await fetch(`${API_BASE_URL}/services/bookings/my-bookings`, { headers: authHeaders(token) });
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error('fetchMyBookings failed', err);
    return [];
  }
};

export const fetchBookingById = async (token: string, id: string): Promise<ServiceBooking | null> => {
  try {
    const res = await fetch(`${API_BASE_URL}/services/bookings/${id}`, { headers: authHeaders(token) });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('fetchBookingById failed', err);
    return null;
  }
};

export const cancelServiceBooking = async (
  token: string,
  id: string,
  cancelReason?: string
): Promise<{ ok: boolean; error?: string }> => {
  try {
    const res = await fetch(`${API_BASE_URL}/services/bookings/${id}/cancel`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ cancelReason }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || 'Failed to cancel booking' };
    return { ok: true };
  } catch (err) {
    console.error('cancelServiceBooking failed', err);
    return { ok: false, error: 'Network error while cancelling booking' };
  }
};

export const respondToBookingApproval = async (
  token: string,
  id: string,
  approve: boolean
): Promise<{ ok: boolean; error?: string }> => {
  try {
    const res = await fetch(`${API_BASE_URL}/services/bookings/${id}/approval`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ approve }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || 'Failed to respond to approval' };
    return { ok: true };
  } catch (err) {
    console.error('respondToBookingApproval failed', err);
    return { ok: false, error: 'Network error while responding to approval' };
  }
};

export const uploadBookingImage = async (
  token: string,
  bookingId: string,
  imageUri: string,
  type: 'ISSUE' | 'BEFORE' | 'AFTER' = 'ISSUE'
): Promise<{ ok: boolean; error?: string }> => {
  try {
    const formData = new FormData();
    const filename = imageUri.split('/').pop() || 'photo.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const ext = match ? match[1].toLowerCase() : 'jpg';
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    formData.append('file', { uri: imageUri, name: filename, type: mime } as any);
    formData.append('type', type);

    const res = await fetch(`${API_BASE_URL}/services/bookings/${bookingId}/images`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: data.error || 'Failed to upload image' };
    }
    return { ok: true };
  } catch (err) {
    console.error('uploadBookingImage failed', err);
    return { ok: false, error: 'Network error while uploading image' };
  }
};

// The technician-photo endpoint is auth-gated (owner customer/assigned
// technician/admin), so it can't just be dropped into an <Image source={{uri}}>
// like a public URL. Fetches it with the normal Authorization header (same
// pattern as every other call in this file) and converts the blob to a data
// URI client-side, rather than a query-string token -- a token embedded in a
// URL is far more likely to leak into logs/proxies than a normal auth header.
export const fetchTechnicianPhotoDataUri = async (token: string, bookingId: string): Promise<string | null> => {
  try {
    const res = await fetch(`${API_BASE_URL}/services/bookings/${bookingId}/technician-photo`, { headers: authHeaders(token) });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error('fetchTechnicianPhotoDataUri failed', err);
    return null;
  }
};

// Same auth-header-to-data-URI pattern as fetchTechnicianPhotoDataUri, for
// the before/after service photos attached to a booking.
export const fetchBookingImageDataUri = async (token: string, imageId: string): Promise<string | null> => {
  try {
    const res = await fetch(`${API_BASE_URL}/services/bookings/images/${imageId}/file`, { headers: authHeaders(token) });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error('fetchBookingImageDataUri failed', err);
    return null;
  }
};

export const fetchBookingInvoice = async (token: string, bookingId: string): Promise<ServiceInvoice | null> => {
  try {
    const res = await fetch(`${API_BASE_URL}/services/bookings/${bookingId}/invoice`, { headers: authHeaders(token) });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('fetchBookingInvoice failed', err);
    return null;
  }
};

export const submitBookingReview = async (
  token: string,
  bookingId: string,
  rating: number,
  comment?: string
): Promise<{ ok: boolean; error?: string }> => {
  try {
    const res = await fetch(`${API_BASE_URL}/services/bookings/${bookingId}/review`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ rating, comment }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || 'Failed to submit review' };
    return { ok: true };
  } catch (err) {
    console.error('submitBookingReview failed', err);
    return { ok: false, error: 'Network error while submitting review' };
  }
};

export const fetchBookingMessages = async (token: string, bookingId: string): Promise<ServiceChatMessage[]> => {
  try {
    const res = await fetch(`${API_BASE_URL}/services/bookings/${bookingId}/messages`, { headers: authHeaders(token) });
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error('fetchBookingMessages failed', err);
    return [];
  }
};

export const sendBookingMessage = async (
  token: string,
  bookingId: string,
  message: string
): Promise<{ ok: boolean; error?: string }> => {
  try {
    const res = await fetch(`${API_BASE_URL}/services/bookings/${bookingId}/messages`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || 'Failed to send message' };
    return { ok: true };
  } catch (err) {
    console.error('sendBookingMessage failed', err);
    return { ok: false, error: 'Network error while sending message' };
  }
};
