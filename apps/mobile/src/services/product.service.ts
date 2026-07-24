import { Platform } from 'react-native';
import { Product, FilterOptions, VehicleType, Category, VehicleBrand, VehicleModel, VehicleTaxonomy } from '../types/product';
import { API_BASE_URL, SERVER_ORIGIN } from './api';

// Every fetch function below swallows failures and returns an empty
// array/undefined by default -- that's deliberate existing behavior mobile
// depends on for resilience (a flaky network shouldn't blank-crash the app).
// The desktop catalog's error states (Stage 4) need to tell "genuinely no
// results" apart from "the request actually failed" though, so functions
// that support it take an optional trailing { rethrow, signal } argument:
// omitted (every existing caller), behavior is byte-identical to before;
// passed with rethrow:true, the function throws an ApiError instead of
// swallowing, and `signal` (an AbortController's signal) enables real
// caller-driven request timeouts.
export class ApiError extends Error {
  status?: number;
  kind: 'network' | 'timeout' | 'http';
  constructor(message: string, opts: { status?: number; kind: ApiError['kind'] }) {
    super(message);
    this.name = 'ApiError';
    this.status = opts.status;
    this.kind = opts.kind;
  }
}

interface FetchOpts { rethrow?: boolean; signal?: AbortSignal }

function toApiError(err: any): ApiError {
  if (err instanceof ApiError) return err;
  if (err?.name === 'AbortError') return new ApiError('Request timed out', { kind: 'timeout' });
  return new ApiError(err?.message || 'Network request failed', { kind: 'network' });
}

// Dynamic Categories will be fetched from the backend API.
// We keep the arrays empty initially and fetch them in HomeScreen.
export let CAR_CATEGORIES: Category[] = [];
export let BIKE_CATEGORIES: Category[] = [];

const getFallbackCategories = (type: VehicleType): Category[] => {
  const fallbackCategories: Record<VehicleType, Category[]> = {
    [VehicleType.CAR]: [
      { id: 'fallback-car-1', name: 'Engine Oils', icon: '🛢️', image: null, vehicleType: VehicleType.CAR, productCount: 18 },
      { id: 'fallback-car-2', name: 'Brake Pads', icon: '🛑', image: null, vehicleType: VehicleType.CAR, productCount: 12 },
      { id: 'fallback-car-3', name: 'Filters', icon: '🧼', image: null, vehicleType: VehicleType.CAR, productCount: 9 },
      { id: 'fallback-car-4', name: 'Batteries', icon: '🔋', image: null, vehicleType: VehicleType.CAR, productCount: 7 },
    ],
    [VehicleType.BIKE]: [
      { id: 'fallback-bike-1', name: 'Engine Oils', icon: '🛢️', image: null, vehicleType: VehicleType.BIKE, productCount: 10 },
      { id: 'fallback-bike-2', name: 'Chains & Sprockets', icon: '⛓️', image: null, vehicleType: VehicleType.BIKE, productCount: 6 },
      { id: 'fallback-bike-3', name: 'Brakes', icon: '🛑', image: null, vehicleType: VehicleType.BIKE, productCount: 8 },
      { id: 'fallback-bike-4', name: 'Accessories', icon: '🪪', image: null, vehicleType: VehicleType.BIKE, productCount: 5 },
    ],
  };

  return fallbackCategories[type] || fallbackCategories[VehicleType.CAR];
};

export const CAR_BRANDS: VehicleBrand[] = [
  { id: 'cb1', name: 'Honda', vehicleType: VehicleType.CAR },
  { id: 'cb2', name: 'Hyundai', vehicleType: VehicleType.CAR },
  { id: 'cb3', name: 'Tata', vehicleType: VehicleType.CAR },
  { id: 'cb4', name: 'Mahindra', vehicleType: VehicleType.CAR },
  { id: 'cb5', name: 'Toyota', vehicleType: VehicleType.CAR },
  { id: 'cb6', name: 'Maruti Suzuki', vehicleType: VehicleType.CAR },
  { id: 'cb7', name: 'Kia', vehicleType: VehicleType.CAR },
  { id: 'cb8', name: 'MG', vehicleType: VehicleType.CAR },
];

export const CAR_MODELS: VehicleModel[] = [
  { id: 'cm1', brandId: 'cb1', name: 'City' },
  { id: 'cm2', brandId: 'cb1', name: 'Amaze' },
  { id: 'cm3', brandId: 'cb2', name: 'Creta' },
  { id: 'cm4', brandId: 'cb3', name: 'Nexon' },
  { id: 'cm5', brandId: 'cb6', name: 'Swift' },
];

export const fetchCategories = async (type: VehicleType, opts?: FetchOpts): Promise<Category[]> => {
  const fallbackCategories = getFallbackCategories(type);
  // The localhost/SERVER_ORIGIN retries only make sense in local dev, where
  // API_BASE_URL === `${SERVER_ORIGIN}/api` (no EXPO_PUBLIC_API_URL set) and
  // the dev host guess can be wrong. In production, EXPO_PUBLIC_API_URL is
  // always set to the real HTTPS API, so these would just be dead, always-
  // failing requests against a port real users can't reach.
  const urls = process.env.EXPO_PUBLIC_API_URL
    ? [`${API_BASE_URL}/categories?vehicleType=${encodeURIComponent(type)}`]
    : [
        `${API_BASE_URL}/categories?vehicleType=${encodeURIComponent(type)}`,
        `http://localhost:5001/api/categories?vehicleType=${encodeURIComponent(type)}`,
      ];

  // Only counts as a real outage (worth rethrow:true throwing instead of
  // falling back) if every URL threw -- a plain !res.ok/empty response still
  // falls back to defaults exactly as before, that's normal degraded
  // operation, not an error state.
  let allThrew = true;
  let lastErr: any;

  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: opts?.signal });
      allThrew = false;
      if (!res.ok) continue;
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        return fallbackCategories;
      }

      const categories = data
        .filter((c: any) => c.status === 'Active' || c.status === undefined)
        .map((c: any) => ({
          id: c.id,
          name: c.name,
          icon: c.icon || '📦',
          image: c.image?.startsWith('/') ? `${SERVER_ORIGIN}${c.image}` : c.image,
          vehicleType: c.vehicleType || type,
          productCount: c.productCount ?? 0,
        }));

      return categories.length > 0 ? categories : fallbackCategories;
    } catch (err) {
      lastErr = err;
      console.warn(`Category fetch failed for ${url}`, err);
    }
  }

  if (opts?.rethrow && allThrew) throw toApiError(lastErr);

  console.warn(`Using fallback categories for ${type}`);
  return fallbackCategories;
};

export const fetchBanners = async (type: VehicleType, opts?: FetchOpts): Promise<any[]> => {
  try {
    // /banners (GET /) is the admin-only listing (authenticate + authorize(admins)).
    // The customer app has no admin token, so it must use the dedicated public
    // endpoint instead, which also does the isActive + vehicleType filtering.
    const res = await fetch(`${API_BASE_URL}/banners/public?vehicle=${type}`, { signal: opts?.signal });
    if (!res.ok) {
      if (opts?.rethrow) throw new ApiError('Failed to fetch banners', { status: res.status, kind: 'http' });
      return [];
    }
    const data = await res.json();
    return data.map((b: any) => {
      let imageUrl = b.image as string | undefined;
      if (imageUrl?.startsWith('/')) {
        imageUrl = `${SERVER_ORIGIN}${imageUrl}`;
      }
      return {
        id: b.id,
        title: b.title,
        subtitle: b.subtitle,
        offer: b.buttonText || 'Shop Now',
        redirectLink: b.redirectLink || b.link,
        image: imageUrl ? { uri: imageUrl } : require('../../assets/car_banner.jpg'),
        vehicleType: type
      };
    });
  } catch (err) {
    if (opts?.rethrow) throw toApiError(err);
    console.error(err);
    return [];
  }
};

export interface HomeOffer {
  id: string;
  title: string;
  description?: string;
  code?: string;
  discountType: string;
  discountValue: number;
}

// Real Offer rows (admin-managed, GET /api/offers is public) -- this used to
// be a hardcoded local OFFERS array on the Home screen showing the same 4
// "Flash Sale / Combo Deals / Battery Exchange / Free Delivery" cards with
// invented codes to every customer regardless of what's actually active.
export const fetchOffers = async (type: VehicleType, opts?: FetchOpts): Promise<HomeOffer[]> => {
  try {
    const res = await fetch(`${API_BASE_URL}/offers?vehicle=${type}`, { signal: opts?.signal });
    if (!res.ok) {
      if (opts?.rethrow) throw new ApiError('Failed to fetch offers', { status: res.status, kind: 'http' });
      return [];
    }
    const data = await res.json();
    return data.map((o: any) => ({
      id: o.id,
      title: o.title,
      description: o.description || undefined,
      code: o.code || undefined,
      discountType: o.discountType,
      discountValue: o.discountValue,
    }));
  } catch (err) {
    if (opts?.rethrow) throw toApiError(err);
    console.error(err);
    return [];
  }
};

export const fetchManufacturers = async (type?: 'CAR' | 'BIKE'): Promise<any[]> => {
  try {
    const query = type ? `?type=${type}` : '';
    const res = await fetch(`${API_BASE_URL}/vehicles/manufacturers${query}`);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error(err);
    return [];
  }
};

export const fetchModels = async (manufacturerId: string): Promise<any[]> => {
  try {
    const res = await fetch(`${API_BASE_URL}/vehicles/models?manufacturerId=${manufacturerId}`);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error(err);
    return [];
  }
};

export const fetchVariants = async (modelId: string): Promise<any[]> => {
  try {
    const res = await fetch(`${API_BASE_URL}/vehicles/variants?modelId=${modelId}`);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error(err);
    return [];
  }
};

export const BIKE_BRANDS: VehicleBrand[] = [
  { id: 'bb1', name: 'Hero', vehicleType: VehicleType.BIKE },
  { id: 'bb2', name: 'Honda', vehicleType: VehicleType.BIKE },
  { id: 'bb3', name: 'TVS', vehicleType: VehicleType.BIKE },
  { id: 'bb4', name: 'Bajaj', vehicleType: VehicleType.BIKE },
  { id: 'bb5', name: 'Yamaha', vehicleType: VehicleType.BIKE },
  { id: 'bb6', name: 'KTM', vehicleType: VehicleType.BIKE },
  { id: 'bb7', name: 'Royal Enfield', vehicleType: VehicleType.BIKE },
  { id: 'bb8', name: 'Suzuki', vehicleType: VehicleType.BIKE },
  { id: 'bb9', name: 'Kawasaki', vehicleType: VehicleType.BIKE },
];

export const BIKE_MODELS: VehicleModel[] = [
  { id: 'bm1', brandId: 'bb1', name: 'Splendor Plus' },
  { id: 'bm2', brandId: 'bb2', name: 'Activa 6G' },
  { id: 'bm3', brandId: 'bb4', name: 'Pulsar 150' },
  { id: 'bm4', brandId: 'bb7', name: 'Classic 350' },
  { id: 'bm5', brandId: 'bb6', name: 'Duke 390' },
];


// Shared by getCategoryProducts/getTrendingProducts/getProductById/the wishlist
// service below -- was duplicated identically in all three before this.
// Inline SVG data URI so products with no uploaded image still render something
// instead of a broken-image icon -- an external placeholder host (previously
// Unsplash) is a live dependency that can 403/rate-limit or trip Chrome's
// Opaque Response Blocking, which is exactly what was happening in production.
export const NO_IMAGE_PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">` +
      `<rect width="400" height="400" fill="#F1F3F5"/>` +
      `<path d="M140 260 L180 210 L215 245 L255 190 L280 260 Z" fill="#CED4DA"/>` +
      `<circle cx="160" cy="165" r="20" fill="#CED4DA"/>` +
      `</svg>`
  );

export const mapBackendProduct = (p: any, opts?: { vehicleType?: VehicleType; categoryFallback?: string }): Product => {
  let imageUrl = NO_IMAGE_PLACEHOLDER;
  if (Array.isArray(p.images) && p.images.length > 0 && p.images[0] && typeof p.images[0] === 'string' && p.images[0].trim() !== '') {
    imageUrl = p.images[0];
    if (imageUrl.startsWith('/')) {
      imageUrl = `${SERVER_ORIGIN}${imageUrl}`;
    }
  }

  return {
    id: p.id,
    name: p.name,
    brand: p.brand?.name || 'Unknown',
    price: p.price,
    originalPrice: p.mrp || p.price,
    b2bPrice: p.b2bPrice,
    discountPercentage: p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0,
    time: 'SAME DAY',
    image: imageUrl,
    isB2B: p.type === 'B2B',
    moq: p.moq || 1,
    category: p.category?.name || opts?.categoryFallback || 'Unknown',
    stockStatus: p.stock > 0 ? (p.stock > (p.lowStockThreshold ?? 10) ? 'In Stock' : 'Limited Stock') : 'Out of Stock',
    // Real average from the backend's `reviews` relation (0 when the product
    // has no reviews yet -- callers show a "New" badge instead of a star in
    // that case rather than a fabricated rating).
    rating: typeof p.avgRating === 'number' ? p.avgRating : 0,
    reviewsCount: typeof p.reviewCount === 'number' ? p.reviewCount : (p.reviews?.length || 0),
    vehicleType: opts?.vehicleType ?? (p.vehicleType === 'BIKE' ? VehicleType.BIKE : VehicleType.CAR),
    compatibleVehicleIds: p.compatibilities?.map((c: any) => c.vehicleId) || [],
    oemNumber: p.oemNumber,
    description: p.description,
    // Real spec sheet from Product.specifications (Json?) -- previously this
    // was never set for backend products, so ProductDetailsScreen's specs
    // section only ever rendered for the local ALL_PRODUCTS mock data.
    specs: p.specifications && typeof p.specifications === 'object' ? p.specifications : undefined,
    salesCount: p.salesCount ?? 0,
    createdAt: p.createdAt,
    isFeatured: !!p.isFeatured,
    isDeal: !!p.isDeal,
  };
};

// Real brand list for the catalog page's filter sidebar -- previously that
// sidebar derived "available brands" from whatever products happened to be
// in the currently-fetched batch, which shrank to just the current page's
// ~24 items once pagination went server-side (see getCategoryProducts).
export const fetchBrands = async (vehicleType: VehicleType): Promise<string[]> => {
  try {
    const res = await fetch(`${API_BASE_URL}/products/brands?vehicleType=${encodeURIComponent(vehicleType)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((b: any) => b.name).sort();
  } catch (err) {
    console.error(err);
    return [];
  }
};

export const getCategoryProducts = async (
  vehicleType: VehicleType,
  categoryName: string,
  searchQuery: string = '',
  brandId?: string,
  modelId?: string,
  year?: string,
  filters?: FilterOptions,
  page: number = 1,
  limit: number = 10,
  opts?: FetchOpts
): Promise<{ products: Product[], hasMore: boolean, total: number }> => {
  try {
    let url = `${API_BASE_URL}/products?`;
    url += `vehicleType=${encodeURIComponent(vehicleType)}&`;
    if (categoryName && categoryName !== 'Search Results') {
      url += `categoryName=${encodeURIComponent(categoryName)}&`;
    }
    if (searchQuery) {
      url += `q=${encodeURIComponent(searchQuery)}&`;
    }
    // Despite the parameter names, callers (HomeScreen's search, this
    // screen's own compatibility filter) already pass vehicle BRAND/MODEL
    // NAMES here (e.g. activeVehicle.brand from UserVehicle, which is a
    // string name, not a manufacturer UUID) -- so these map directly onto
    // the backend's vehicleMake/vehicleModel compatibility filter.
    if (brandId) {
      url += `vehicleMake=${encodeURIComponent(brandId)}&`;
    }
    if (modelId) {
      url += `vehicleModel=${encodeURIComponent(modelId)}&`;
    }
    // Sorting/filtering/pagination all happen server-side now (GET
    // /products supports brand/priceMin/priceMax/inStock/minRating/sortBy
    // and returns X-Total-Count/X-Has-More headers) -- this used to fetch a
    // flat 200-item batch and do all of that in JS, which silently capped
    // every category at 200 products and re-filtered the same batch on
    // every page.
    if (filters) {
      if (filters.inStockOnly) url += `inStock=true&`;
      if (filters.brands && filters.brands.length > 0) url += `brand=${encodeURIComponent(filters.brands.join(','))}&`;
      if (typeof filters.priceMin === 'number') url += `priceMin=${filters.priceMin}&`;
      if (typeof filters.priceMax === 'number') url += `priceMax=${filters.priceMax}&`;
      if (typeof filters.minRating === 'number') url += `minRating=${filters.minRating}&`;
      if (filters.sortBy) url += `sortBy=${encodeURIComponent(filters.sortBy)}&`;
    }
    url += `page=${page}&limit=${limit}&`;

    const response = await fetch(url, { signal: opts?.signal });
    if (!response.ok) {
      throw new ApiError('Failed to fetch products', { status: response.status, kind: 'http' });
    }
    const data = await response.json();
    const total = Number(response.headers.get('X-Total-Count') ?? data.length);
    const hasMore = response.headers.get('X-Has-More') === 'true';

    const products: Product[] = data.map((p: any) => mapBackendProduct(p, { vehicleType, categoryFallback: categoryName }));

    return { products, hasMore, total };
  } catch (err) {
    if (opts?.rethrow) throw toApiError(err);
    console.error(err);
    // Fallback to empty if api fails for any reason
    return { products: [], hasMore: false, total: 0 };
  }
};

export const getTrendingProducts = async (vehicleType: VehicleType, limit: number = 5, opts?: FetchOpts): Promise<Product[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/products?vehicleType=${encodeURIComponent(vehicleType)}`, { signal: opts?.signal });
    if (!response.ok) {
      throw new ApiError('Failed to fetch trending products', { status: response.status, kind: 'http' });
    }
    const data = await response.json();

    // Map backend products to mobile frontend format
    let results: Product[] = data.map((p: any) => mapBackendProduct(p));

    // Simple randomization or just taking the first N as 'trending' for now
    return results.slice(0, limit);
  } catch (err) {
    if (opts?.rethrow) throw toApiError(err);
    console.error(err);
    return [];
  }
};

export const getProductById = async (id: string): Promise<Product | undefined> => {
  try {
    const response = await fetch(`${API_BASE_URL}/products/${id}`);
    if (!response.ok) return undefined;
    const p = await response.json();
    return mapBackendProduct(p);
  } catch(err) {
    console.error(err);
    return undefined;
  }
};

export const getRelatedProducts = async (id: string): Promise<Product[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/products/${id}/related`);
    if (!response.ok) return [];
    const data = await response.json();
    return data.map((p: any) => mapBackendProduct(p));
  } catch (err) {
    console.error(err);
    return [];
  }
};

export interface SearchSuggestion {
  id: string;
  name: string;
  image: string;
  price: number;
  categoryName: string;
}

export const fetchSearchSuggestions = async (
  query: string,
  vehicleType?: VehicleType,
  opts?: { signal?: AbortSignal },
): Promise<SearchSuggestion[]> => {
  try {
    if (query.trim().length < 2) return [];
    let url = `${API_BASE_URL}/products/suggestions?q=${encodeURIComponent(query.trim())}`;
    if (vehicleType) url += `&vehicleType=${encodeURIComponent(vehicleType)}`;
    const res = await fetch(url, { signal: opts?.signal });
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((p: any) => ({
      id: p.id,
      name: p.name,
      image: Array.isArray(p.images) && p.images[0]
        ? (p.images[0].startsWith('/') ? `${SERVER_ORIGIN}${p.images[0]}` : p.images[0])
        : NO_IMAGE_PLACEHOLDER,
      price: p.price,
      categoryName: p.category?.name || '',
    }));
  } catch (err) {
    return [];
  }
};
