import { API_BASE_URL } from './api';

export interface TopVendor {
  id: string;
  storeName: string;
  categories: string[];
  productCount: number;
  salesCount: number;
}

// Backs the homepage "Top Vendors" section -- GET /vendors/top is public and
// only ever returns storeName/categories/product stats (see
// getTopVendors in vendor.controller.ts), never KYC/banking data.
export const fetchTopVendors = async (): Promise<TopVendor[]> => {
  try {
    const res = await fetch(`${API_BASE_URL}/vendors/top`);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error('fetchTopVendors failed', err);
    return [];
  }
};
