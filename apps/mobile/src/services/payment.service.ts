import { API_BASE_URL } from './api';

export interface PaymentConfig {
  razorpayEnabled: boolean;
  razorpayKeyId?: string;
}

// No auth required -- this just tells the checkout screen whether to show
// "Pay Online" at all. Returns disabled on any failure so the UI degrades to
// the always-available Cash on Delivery option rather than erroring.
export const getPaymentConfig = async (): Promise<PaymentConfig> => {
  try {
    const res = await fetch(`${API_BASE_URL}/payments/config`);
    if (!res.ok) return { razorpayEnabled: false };
    return await res.json();
  } catch (err) {
    console.error('getPaymentConfig failed', err);
    return { razorpayEnabled: false };
  }
};

export interface RazorpayCheckoutParams {
  razorpayOrderId: string;
  keyId: string;
  amount: number;
  orderId: string;
  name?: string;
  description?: string;
  prefillEmail?: string;
  prefillPhone?: string;
}

export interface RazorpayCheckoutResult {
  success: boolean;
  cancelled?: boolean;
  error?: string;
  razorpay_payment_id?: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
}

/**
 * Opens the native Razorpay checkout sheet. Only ever called when the backend
 * has already reported `razorpayEnabled: true` and handed back a gateway
 * order id, so this module has no behavior at all in the current COD-only
 * deployment beyond this thin wrapper.
 */
export const openRazorpayCheckout = async (params: RazorpayCheckoutParams): Promise<RazorpayCheckoutResult> => {
  // Required at call time, not at module load, so importing this file never
  // throws in an environment where the native module hasn't been rebuilt in yet.
  const RazorpayCheckout = require('react-native-razorpay').default;

  const options = {
    key: params.keyId,
    amount: Math.round(params.amount * 100),
    currency: 'INR',
    name: params.name || 'MechBazar',
    description: params.description || `Order ${params.orderId.slice(0, 8)}`,
    order_id: params.razorpayOrderId,
    prefill: {
      email: params.prefillEmail,
      contact: params.prefillPhone,
    },
    theme: { color: '#DA3830' },
  };

  try {
    const data = await RazorpayCheckout.open(options);
    return {
      success: true,
      razorpay_payment_id: data.razorpay_payment_id,
      razorpay_order_id: data.razorpay_order_id,
      razorpay_signature: data.razorpay_signature,
    };
  } catch (error: any) {
    // react-native-razorpay rejects with { code, description } on both user
    // cancellation and a hard failure; code 0/2 is Razorpay's own "payment
    // cancelled by user" convention.
    const cancelled = error?.code === 0 || error?.code === 2;
    return { success: false, cancelled, error: error?.description || 'Payment failed.' };
  }
};

export interface VerifyPaymentPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export const verifyRazorpayPayment = async (
  token: string,
  payload: VerifyPaymentPayload
): Promise<{ ok: boolean; error?: string }> => {
  try {
    const res = await fetch(`${API_BASE_URL}/payments/razorpay/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || 'Payment verification failed' };
    return { ok: true };
  } catch (err) {
    console.error('verifyRazorpayPayment failed', err);
    return { ok: false, error: 'Network error verifying payment' };
  }
};
