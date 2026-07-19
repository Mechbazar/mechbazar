import { VehicleType } from './product';

export type BookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'MECHANIC_ASSIGNED'
  | 'MECHANIC_ACCEPTED'
  | 'MECHANIC_ON_THE_WAY'
  | 'ARRIVED'
  | 'WORK_STARTED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REJECTED';

export interface ServiceCategory {
  id: string;
  name: string;
  icon?: string | null;
  image?: string | null;
  description?: string | null;
  vehicleType: VehicleType;
  isEmergency: boolean;
  status: string;
  sortOrder: number;
  packages?: ServicePackage[];
  _count?: { packages: number };
}

export interface ServicePackage {
  id: string;
  categoryId: string;
  category?: ServiceCategory;
  name: string;
  description?: string | null;
  image?: string | null;
  price: number;
  discountPrice?: number | null;
  estimatedMinutes: number;
  includedServices: string[];
  isActive: boolean;
  isPopular: boolean;
  isRecommended: boolean;
  isEmergency: boolean;
  rating: number;
  reviewCount: number;
}

export interface TimeSlot {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  maxBookingsPerSlot: number;
  isActive: boolean;
  sortOrder: number;
  bookedCount?: number;
  available?: boolean;
}

export interface ServiceAddress {
  id: string;
  title: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  pincode: string;
  lat?: number | null;
  lng?: number | null;
  isDefault: boolean;
}

export interface ServiceTechnicianSummary {
  id: string;
  userId: string;
  rating: number;
  totalJobs: number;
  currentLat?: number | null;
  currentLng?: number | null;
  skills: string[];
  user?: { name?: string | null; phone: string; avatar?: string | null };
}

export interface ServiceBookingPayment {
  id: string;
  method: string;
  status: string;
  amount: number;
}

export interface ServiceBookingStatusHistoryEntry {
  id: string;
  status: BookingStatus;
  note?: string | null;
  createdAt: string;
}

// Metadata only -- the actual bytes live behind the authenticated
// /bookings/images/:imageId/file endpoint (see fetchBookingImageDataUri),
// never read from the fileData the API happens to embed in the booking JSON.
export interface ServiceImageMeta {
  id: string;
  bookingId: string;
  type: 'ISSUE' | 'BEFORE' | 'AFTER' | 'ADDITIONAL_WORK' | string;
  uploadedByRole: 'CUSTOMER' | 'TECHNICIAN' | string;
  createdAt: string;
}

export interface ServiceBooking {
  id: string;
  bookingNumber: string;
  userId: string;
  vehicleType: VehicleType;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleFuelType?: string | null;
  vehicleRegistrationNumber?: string | null;
  categoryId: string;
  category?: ServiceCategory;
  packageId: string;
  package?: ServicePackage;
  technicianId?: string | null;
  technician?: ServiceTechnicianSummary | null;
  addressId: string;
  address?: ServiceAddress;
  scheduledDate: string;
  timeSlotId: string;
  timeSlot?: TimeSlot;
  issueDescription?: string | null;
  status: BookingStatus;
  estimatedCost: number;
  additionalCost: number;
  finalAmount: number;
  approvalStatus?: string | null;
  approvalNote?: string | null;
  cancelReason?: string | null;
  completedAt?: string | null;
  // Only ever present in the customer's own view of the booking -- the
  // backend strips these from a technician's response, since the whole point
  // is the customer reads the code aloud rather than the technician seeing it.
  completionOtp?: string | null;
  completionOtpGeneratedAt?: string | null;
  createdAt: string;
  payment?: ServiceBookingPayment | null;
  statusHistory?: ServiceBookingStatusHistoryEntry[];
  // Only included on the single-booking endpoint, not my-bookings.
  images?: ServiceImageMeta[];
  review?: { id: string; rating: number; comment?: string | null } | null;
  invoice?: ServiceInvoice | null;
}

export interface ServiceInvoice {
  id: string;
  bookingId: string;
  invoiceNumber: string;
  subtotal: number;
  additionalCost: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  pdfUrl?: string | null;
  createdAt: string;
}

export interface ServiceChatMessage {
  id: string;
  bookingId: string;
  senderUserId: string;
  senderRole: 'CUSTOMER' | 'TECHNICIAN';
  message: string;
  createdAt: string;
}
