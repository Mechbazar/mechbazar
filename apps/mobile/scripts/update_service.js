const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '../src/services/product.service.ts');
let content = fs.readFileSync(targetPath, 'utf8');

// The new imports
content = content.replace(
  /import \{ Product, FilterOptions, VehicleType, Category, VehicleBrand, VehicleModel \} from '\.\.\/types\/product';/,
  "import { Product, FilterOptions, VehicleType, Category, VehicleBrand, VehicleModel, VehicleTaxonomy } from '../types/product';"
);

// Add ALL_TAXONOMIES right before ALL_PRODUCTS
const newTaxonomies = `
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

`;
content = content.replace('// ==== PRODUCT DATA ====', newTaxonomies + '// ==== PRODUCT DATA ====');

// Update Product CompatibleVehicles mapping
content = content.replace(/compatibleVehicles: \['Honda City', 'Hyundai Creta', 'Maruti Swift'\],/g, "compatibleVehicleIds: ['tax_c1', 'tax_c2', 'tax_c4', 'tax_c5'],");
content = content.replace(/compatibleVehicles: \['Honda City 2014-2020', 'Honda Amaze'\],/g, "compatibleVehicleIds: ['tax_c1', 'tax_c2', 'tax_c3'],");
content = content.replace(/compatibleVehicles: \['Royal Enfield Classic 350', 'KTM Duke 390', 'Bajaj Pulsar'\],/g, "compatibleVehicleIds: ['tax_b1', 'tax_b2', 'tax_b3'],");
content = content.replace(/compatibleVehicles: \['Bajaj Pulsar 150'\],/g, "compatibleVehicleIds: ['tax_b2'],");

// Update filtering in getCategoryProducts
content = content.replace(
  /if \(modelId\) \{[\s\S]*?\}\s*\}/,
  `if (modelId) {
    // Note: for this mock, modelId is actually the vehicleTaxonomyId
    results = results.filter(p => p.compatibleVehicleIds && p.compatibleVehicleIds.includes(modelId));
  }`
);

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Successfully updated product.service.ts');
