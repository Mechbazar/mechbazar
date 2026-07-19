import { Product } from '../types/product';
import { API_BASE_URL } from './api';
import { mapBackendProduct } from './product.service';

const authHeaders = (token: string) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
});

export const fetchMyWishlist = async (token: string): Promise<Product[]> => {
  try {
    const res = await fetch(`${API_BASE_URL}/customers/me/wishlist`, { headers: authHeaders(token) });
    if (!res.ok) return [];
    const items = await res.json();
    return items.map((item: any) => mapBackendProduct(item.product));
  } catch (err) {
    console.error('fetchMyWishlist failed', err);
    return [];
  }
};

export const addToWishlist = async (token: string, productId: string): Promise<{ ok: boolean; error?: string }> => {
  try {
    const res = await fetch(`${API_BASE_URL}/customers/me/wishlist`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ productId }),
    });
    if (!res.ok) {
      const data = await res.json();
      return { ok: false, error: data.error || 'Failed to add to wishlist' };
    }
    return { ok: true };
  } catch (err) {
    console.error('addToWishlist failed', err);
    return { ok: false, error: 'Network error while adding to wishlist' };
  }
};

export const removeFromWishlist = async (token: string, productId: string): Promise<{ ok: boolean; error?: string }> => {
  try {
    const res = await fetch(`${API_BASE_URL}/customers/me/wishlist/${productId}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
    if (!res.ok) {
      const data = await res.json();
      return { ok: false, error: data.error || 'Failed to remove from wishlist' };
    }
    return { ok: true };
  } catch (err) {
    console.error('removeFromWishlist failed', err);
    return { ok: false, error: 'Network error while removing from wishlist' };
  }
};
