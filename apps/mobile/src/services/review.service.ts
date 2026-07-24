import { API_BASE_URL } from './api';

export interface ProductReview {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  userName: string | null;
  verifiedPurchase: boolean;
}

export const fetchProductReviews = async (productId: string): Promise<ProductReview[]> => {
  try {
    const res = await fetch(`${API_BASE_URL}/products/${productId}/reviews`);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error(err);
    return [];
  }
};

export const submitProductReview = async (
  token: string,
  productId: string,
  rating: number,
  comment: string,
): Promise<{ ok: boolean; error?: string }> => {
  try {
    const res = await fetch(`${API_BASE_URL}/products/${productId}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ rating, comment: comment.trim() || undefined }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: data.error || 'Failed to submit review.' };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: 'Network error. Please try again.' };
  }
};

export const deleteProductReview = async (token: string, productId: string): Promise<boolean> => {
  try {
    const res = await fetch(`${API_BASE_URL}/products/${productId}/reviews`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch (err) {
    return false;
  }
};
