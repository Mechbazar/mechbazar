import { API_BASE_URL } from './api';

export const subscribeToNewsletter = async (email: string): Promise<{ ok: boolean; message: string }> => {
  try {
    const res = await fetch(`${API_BASE_URL}/newsletter/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, message: data.error || 'Failed to subscribe. Please try again.' };
    return { ok: true, message: data.message || 'Subscribed successfully.' };
  } catch (err) {
    return { ok: false, message: 'Network error. Please check your connection and try again.' };
  }
};
