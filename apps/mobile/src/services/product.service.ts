import { Platform } from 'react-native';
import { Product, FilterOptions, VehicleType, Category, VehicleBrand, VehicleModel, VehicleTaxonomy } from '../types/product';
import { API_BASE_URL, SERVER_ORIGIN } from './api';

// getCategoryProducts fetches one batch and does all sorting/filtering/
// pagination client-side (see there) -- this is how many products it asks
// the backend for per request, independent of the UI's own page size.
const FETCH_BATCH_SIZE = 200;

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

export const fetchCategories = async (type: VehicleType): Promise<Category[]> => {
  const fallbackCategories = getFallbackCategories(type);
  const urls = [
    `${API_BASE_URL}/categories?vehicleType=${encodeURIComponent(type)}`,
    `${SERVER_ORIGIN}/api/categories?vehicleType=${encodeURIComponent(type)}`,
    `http://localhost:5001/api/categories?vehicleType=${encodeURIComponent(type)}`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url);
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
      console.warn(`Category fetch failed for ${url}`, err);
    }
  }

  console.warn(`Using fallback categories for ${type}`);
  return fallbackCategories;
};

export const fetchBanners = async (type: VehicleType): Promise<any[]> => {
  try {
    // /banners (GET /) is the admin-only listing (authenticate + authorize(admins)).
    // The customer app has no admin token, so it must use the dedicated public
    // endpoint instead, which also does the isActive + vehicleType filtering.
    const res = await fetch(`${API_BASE_URL}/banners/public?vehicle=${type}`);
    if (!res.ok) return [];
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
        image: imageUrl ? { uri: imageUrl } : require('../../assets/car_banner.png'),
        vehicleType: type
      };
    });
  } catch (err) {
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


export const ALL_TAXONOMIES: VehicleTaxonomy[] = [
  // CARS
  { id: 'tax_c1', vehicleType: VehicleType.CAR, brand: 'Honda', model: 'City', year: '2020', fuelType: 'Petrol', engine: '1.5L i-VTEC', transmission: 'Automatic', trim: 'ZX' },
  { id: 'tax_c2', vehicleType: VehicleType.CAR, brand: 'Honda', model: 'City', year: '2020', fuelType: 'Petrol', engine: '1.5L i-VTEC', transmission: 'Manual', trim: 'VX' },
  { id: 'tax_c3', vehicleType: VehicleType.CAR, brand: 'Honda', model: 'Amaze', year: '2021', fuelType: 'Diesel', engine: '1.5L i-DTEC', transmission: 'Manual', trim: 'VX' },
  { id: 'tax_c4', vehicleType: VehicleType.CAR, brand: 'Hyundai', model: 'Creta', year: '2023', fuelType: 'Diesel', engine: '1.5L CRDi', transmission: 'Automatic', trim: 'SX' },
  { id: 'tax_c5', vehicleType: VehicleType.CAR, brand: 'Maruti Suzuki', model: 'Swift', year: '2021', fuelType: 'Petrol', engine: '1.2L DualJet', transmission: 'Manual', trim: 'ZXi' },
  { id: 'tax_c6', vehicleType: VehicleType.CAR, brand: 'Tata', model: 'Nexon', year: '2022', fuelType: 'Petrol', engine: '1.2L Turbo', transmission: 'Automatic', trim: 'XZA+' },
  { id: 'tax_c7', vehicleType: VehicleType.CAR, brand: 'Mahindra', model: 'Thar', year: '2022', fuelType: 'Diesel', engine: '2.2L mHawk', transmission: 'Automatic', trim: 'LX 4-Str Hard Top' },
  // BIKES
  { id: 'tax_b1', vehicleType: VehicleType.BIKE, brand: 'Royal Enfield', model: 'Classic 350', year: '2022', fuelType: 'Petrol', engine: '349cc', transmission: 'Manual', trim: 'Standard' },
  { id: 'tax_b2', vehicleType: VehicleType.BIKE, brand: 'Bajaj', model: 'Pulsar 150', year: '2019', fuelType: 'Petrol', engine: '149cc', transmission: 'Manual', trim: 'Twin Disc' },
  { id: 'tax_b3', vehicleType: VehicleType.BIKE, brand: 'KTM', model: 'Duke 390', year: '2021', fuelType: 'Petrol', engine: '373cc', transmission: 'Manual', trim: 'Standard' },
  { id: 'tax_b4', vehicleType: VehicleType.BIKE, brand: 'Yamaha', model: 'R15 V4', year: '2023', fuelType: 'Petrol', engine: '155cc', transmission: 'Manual', trim: 'Racing Blue' },
];

// ==== PRODUCT DATA ====
export const ALL_PRODUCTS: Product[] = [
  // Car Products
  { id: '1', name: 'Castrol MAGNATEC 10W-40 Engine Oil 3.5L', brand: 'Castrol', price: 1650, originalPrice: 1950, discountPercentage: 15, time: '15 MINS', image: 'https://images.unsplash.com/photo-1606169429760-4b2e88a38a7c?w=400&q=80', isB2B: false, category: 'Engine Oils', stockStatus: 'In Stock', rating: 4.8, reviewsCount: 124, vehicleType: VehicleType.CAR, compatibleVehicleIds: ['tax_c1', 'tax_c2', 'tax_c4', 'tax_c5'], oemNumber: 'CAS-10W40-3.5', specs: { 'Viscosity': '10W-40', 'Volume': '3.5L', 'Type': 'Synthetic Blend' }, warranty: 'No Warranty', description: 'Premium engine oil providing instant protection from the moment you start.' },
  { id: '4', name: 'Bosch Premium Disc Brake Pad Set', brand: 'Bosch', price: 850, originalPrice: 1100, discountPercentage: 22, time: '20 MINS', image: 'https://images.unsplash.com/photo-1596773356073-670d8a57e930?w=400&q=80', isB2B: false, category: 'Brake Pads', stockStatus: 'In Stock', rating: 4.5, reviewsCount: 201, vehicleType: VehicleType.CAR, compatibleVehicleIds: ['tax_c1', 'tax_c2', 'tax_c3'], oemNumber: 'BOSCH-BP-1234', specs: { 'Material': 'Semi-Metallic', 'Position': 'Front' }, warranty: '6 Months', description: 'High performance brake pads for superior stopping power and reduced dust.' },
  
  // Bike Products
  { id: 'b_1', name: 'Motul 7100 4T 20W-50 API SN Fully Synthetic', brand: 'Motul', price: 850, originalPrice: 950, discountPercentage: 10, time: '20 MINS', image: 'https://images.unsplash.com/photo-1610444585868-b35cb611b849?w=400&q=80', isB2B: false, category: 'Engine Oils', stockStatus: 'In Stock', rating: 4.9, reviewsCount: 312, vehicleType: VehicleType.BIKE, compatibleVehicleIds: ['tax_b1', 'tax_b2', 'tax_b3'], oemNumber: 'MOT-7100-1L', specs: { 'Viscosity': '20W-50', 'Volume': '1L', 'Type': 'Fully Synthetic' }, warranty: 'No Warranty', description: '100% Synthetic 4-Stroke motorcycle racing lubricant.' },
  { id: 'b_2', name: 'Rolon Brass Chain Sprocket Kit', brand: 'Rolon', price: 1200, originalPrice: 1500, discountPercentage: 20, time: 'SAME DAY', image: 'https://images.unsplash.com/photo-1596773356073-670d8a57e930?w=400&q=80', isB2B: false, category: 'Chains & Sprockets', stockStatus: 'Limited Stock', rating: 4.7, reviewsCount: 45, vehicleType: VehicleType.BIKE, compatibleVehicleIds: ['tax_b2'], oemNumber: 'ROL-CS-P150', specs: { 'Material': 'Brass/Steel', 'Teeth': '42T/14T' }, warranty: '3 Months', description: 'Durable brass plated chain and sprocket kit for enhanced life.' },
];

// Shared by getCategoryProducts/getTrendingProducts/getProductById/the wishlist
// service below -- was duplicated identically in all three before this.
export const mapBackendProduct = (p: any, opts?: { vehicleType?: VehicleType; categoryFallback?: string }): Product => {
  let imageUrl = 'https://images.unsplash.com/photo-1606169429760-4b2e88a38a7c?w=400&q=80';
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
    rating: 4.5,
    reviewsCount: p.reviews?.length || 0,
    vehicleType: opts?.vehicleType ?? (p.vehicleType === 'BIKE' ? VehicleType.BIKE : VehicleType.CAR),
    compatibleVehicleIds: p.compatibilities?.map((c: any) => c.vehicleId) || [],
    oemNumber: p.oemNumber,
    description: p.description,
    salesCount: p.salesCount ?? 0,
    createdAt: p.createdAt,
    isFeatured: !!p.isFeatured,
    isDeal: !!p.isDeal,
  };
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
  limit: number = 10
): Promise<{ products: Product[], hasMore: boolean }> => {
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
    // the backend's vehicleMake/vehicleModel compatibility filter. Wiring
    // them into the request fixes a pre-existing gap where vehicle-based
    // filtering was silently dropped despite being threaded through from
    // every call site.
    if (brandId) {
      url += `vehicleMake=${encodeURIComponent(brandId)}&`;
    }
    if (modelId) {
      url += `vehicleModel=${encodeURIComponent(modelId)}&`;
    }
    // Sorting/filtering below happens entirely client-side over this one
    // batch (the backend has no sort-by-discount/rating/etc. or brand-list
    // support), so fetch a large batch up front rather than the small
    // per-page `limit` -- otherwise pages beyond the first would just
    // re-slice the same handful of already-fetched items instead of
    // reaching real additional products.
    url += `limit=${FETCH_BATCH_SIZE}&`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch products');
    }
    const data = await response.json();

    // Map backend products to mobile frontend format
    let results: Product[] = data.map((p: any) => mapBackendProduct(p, { vehicleType, categoryFallback: categoryName }));

    if (filters) {
      if (filters.inStockOnly) {
        results = results.filter(p => p.stockStatus === 'In Stock');
      }

      if (filters.brands && filters.brands.length > 0) {
        results = results.filter(p => filters.brands.includes(p.brand));
      }

      if (typeof filters.priceMin === 'number') {
        results = results.filter(p => p.price >= filters.priceMin!);
      }
      if (typeof filters.priceMax === 'number') {
        results = results.filter(p => p.price <= filters.priceMax!);
      }
      if (typeof filters.minRating === 'number') {
        results = results.filter(p => (p.rating ?? 0) >= filters.minRating!);
      }

      switch (filters.sortBy) {
        case 'price_low_high':
          results.sort((a, b) => a.price - b.price);
          break;
        case 'price_high_low':
          results.sort((a, b) => b.price - a.price);
          break;
        case 'discount':
          results.sort((a, b) => (b.discountPercentage || 0) - (a.discountPercentage || 0));
          break;
        case 'popular':
          results.sort((a, b) => (b.reviewsCount || 0) - (a.reviewsCount || 0));
          break;
        case 'newest':
          results.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          break;
        case 'best_selling':
          results.sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0));
          break;
        case 'rating':
          results.sort((a, b) => (b.rating || 0) - (a.rating || 0));
          break;
      }
    }

    const startIndex = (page - 1) * limit;
    const paginated = results.slice(startIndex, startIndex + limit);

    return {
      products: paginated,
      hasMore: startIndex + limit < results.length
    };
  } catch (err) {
    console.error(err);
    // Fallback to empty if api fails for any reason
    return { products: [], hasMore: false };
  }
};

export const getTrendingProducts = async (vehicleType: VehicleType, limit: number = 5): Promise<Product[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/products?vehicleType=${encodeURIComponent(vehicleType)}`);
    if (!response.ok) {
      throw new Error('Failed to fetch trending products');
    }
    const data = await response.json();
    
    // Map backend products to mobile frontend format
    let results: Product[] = data.map((p: any) => mapBackendProduct(p));

    // Simple randomization or just taking the first N as 'trending' for now
    return results.slice(0, limit);
  } catch (err) {
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
