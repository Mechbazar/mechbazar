import { API_BASE_URL } from './api';

const authHeaders = (token: string) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
});

export interface CreateOrderPayload {
  items: { id: string; qty: number }[];
  addressId: string;
  couponCode?: string;
  isB2B?: boolean;
  phone?: string;
  payment_method: 'COD' | 'RAZORPAY';
}

export interface CreateOrderResult {
  ok: boolean;
  error?: string;
  order?: any;
  razorpayOrderId?: string;
  razorpayKeyId?: string;
}

export const createOrder = async (token: string, payload: CreateOrderPayload): Promise<CreateOrderResult> => {
  try {
    const res = await fetch(`${API_BASE_URL}/orders`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || 'Failed to place order' };
    return { ok: true, order: data.order, razorpayOrderId: data.razorpayOrderId, razorpayKeyId: data.razorpayKeyId };
  } catch (err) {
    console.error('createOrder failed', err);
    return { ok: false, error: 'Network error. Could not place order.' };
  }
};

export interface ValidateCouponResult {
  ok: boolean;
  error?: string;
  message?: string;
  discountType?: 'percentage' | 'flat';
  discountValue?: number;
}

export const validateCoupon = async (token: string, code: string, cartTotal: number): Promise<ValidateCouponResult> => {
  try {
    const res = await fetch(`${API_BASE_URL}/coupons/validate`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ code, cartTotal }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || 'Invalid coupon' };
    return { ok: true, message: data.message, discountType: data.discountType, discountValue: data.discountValue };
  } catch (err) {
    console.error('validateCoupon failed', err);
    return { ok: false, error: 'Network error validating coupon' };
  }
};

export const getOrderById = async (token: string, orderId: string): Promise<{ ok: boolean; order?: any; error?: string }> => {
  try {
    const res = await fetch(`${API_BASE_URL}/orders/${orderId}`, { headers: authHeaders(token) });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || 'Failed to fetch order' };
    return { ok: true, order: data };
  } catch (err) {
    console.error('getOrderById failed', err);
    return { ok: false, error: 'Network error fetching order' };
  }
};
