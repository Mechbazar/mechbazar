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
}

export interface FilterOptions {
  sortBy: 'price_low_high' | 'price_high_low' | 'popular' | 'discount';
  brands: string[];
  inStockOnly: boolean;
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

