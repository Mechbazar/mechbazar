export enum VehicleType {
  CAR = 'CAR',
  BIKE = 'BIKE',
}

export interface UserVehicle {
  id: string;
  nickname?: string;
  vehicleType: VehicleType;
  brand: string;
  model: string;
  year: string;
  fuelType: string;
  engine: string;
  transmission: string;
  trim: string;
  isDefault: boolean;
}

export interface VehicleTaxonomy {
  id: string; // The primary key for this specific vehicle configuration
  vehicleType: VehicleType;
  brand: string;
  model: string;
  year: string;
  fuelType: string;
  engine: string;
  transmission: string;
  trim: string;
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  price: number;
  originalPrice: number;
  b2bPrice?: number;
  discountPercentage?: number;
  time: string;
  image: string;
  isB2B: boolean;
  moq?: number;
  category: string;
  stockStatus: 'In Stock' | 'Out of Stock' | 'Limited Stock';
  rating?: number;
  reviewsCount?: number;

  vehicleType: VehicleType;
  // Instead of an array of string descriptions, this should ideally be an array of VehicleTaxonomy IDs.
  // For the mock, we will keep it simple.
  compatibleVehicleIds: string[];
  oemNumber?: string;
  specs?: Record<string, string>;
  warranty?: string;
  description?: string;
  // Real backend fields (Product.salesCount/createdAt/isFeatured/isDeal in
  // prisma/schema.prisma) -- added for the desktop catalog's Newest/Best
  // Selling sorts and badges. Optional since older call sites don't set them.
  salesCount?: number;
  createdAt?: string;
  isFeatured?: boolean;
  isDeal?: boolean;
}

export interface FilterOptions {
  sortBy: 'price_low_high' | 'price_high_low' | 'popular' | 'discount' | 'newest' | 'best_selling' | 'rating';
  brands: string[];
  inStockOnly: boolean;
  // Desktop catalog additions (Stage 3) -- optional, existing callers
  // (mobile's FilterSortSheet) don't set them so behavior there is unchanged.
  priceMin?: number;
  priceMax?: number;
  minRating?: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  image?: string | null;
  vehicleType: VehicleType;
  productCount?: number;
}

export interface VehicleBrand {
  id: string;
  name: string;
  logoUrl?: string;
  vehicleType: VehicleType;
}

export interface VehicleModel {
  id: string;
  brandId: string;
  name: string;
}

