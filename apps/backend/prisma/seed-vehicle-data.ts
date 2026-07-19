import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getOrCreateCategory(name: string, vehicleType: string, icon: string, image?: string) {
  const existing = await prisma.category.findFirst({ where: { name, vehicleType } });
  if (existing) return existing;
  return prisma.category.create({
    data: {
      name,
      icon,
      ...(image ? { image } : {}),
      vehicleType,
      status: 'Active',
    },
  });
}

async function resolveVendor() {
  const existing = await prisma.vendor.findFirst();
  if (existing) return existing;

  const user = await prisma.user.create({
    data: {
      phone: `SEED${Date.now()}`,
      role: 'VENDOR',
      name: 'Seed Vendor',
      password: 'seed',
    },
  });

  return prisma.vendor.create({
    data: {
      userId: user.id,
      storeName: 'MechBazar Seed Store',
      status: 'APPROVED',
      isActive: true,
    },
  });
}

async function main() {
  try {
    const vendor = await resolveVendor();

    const carCategories = [
      { name: 'Engine Oil', icon: '🛢️' },
      { name: 'Brake Pads', icon: '🛑' },
      { name: 'Brake Disc', icon: '💿' },
      { name: 'Battery', icon: '🔋' },
      { name: 'AC Compressor', icon: '❄️' },
      { name: 'Air Filter', icon: '🌬️' },
      { name: 'Cabin Filter', icon: '🏠' },
      { name: 'Clutch Kit', icon: '⚙️' },
      { name: 'Suspension', icon: '🔩' },
      { name: 'Shock Absorber', icon: '💥' },
      { name: 'Headlight', icon: '💡' },
      { name: 'Tail Light', icon: '🔅' },
      { name: 'Alternator', icon: '⚡' },
      { name: 'Radiator', icon: '🌡️' },
      { name: 'Spark Plug', icon: '✨' },
      { name: 'Wiper', icon: '🚿' },
      { name: 'Timing Belt', icon: '⏱️' },
      { name: 'Coolant', icon: '🧊' },
      { name: 'Steering Parts', icon: '🔄' },
      { name: 'Car Accessories', icon: '🚘' },
    ];

    // Consolidated Bike taxonomy: the original 18 granular categories below
    // (Engine Oil, Chain Kit, Brake Shoes, ...) have been folded into these 13
    // to match Car's flat, non-overlapping category style. See
    // BIKE_CATEGORY_REMAP below for how existing products/categories migrate.
    const bikeCategories = [
      { name: 'Engine Parts', icon: '🔧' },
      { name: 'Brake System', icon: '🛑' },
      { name: 'Clutch', icon: '⚙️' },
      { name: 'Transmission', icon: '⛓️' },
      { name: 'Suspension', icon: '🔩' },
      { name: 'Electrical', icon: '⚡' },
      { name: 'Filters', icon: '🌬️' },
      { name: 'Oils & Lubricants', icon: '🛢️' },
      { name: 'Tyres', icon: '🔵' },
      { name: 'Batteries', icon: '🔋' },
      { name: 'Accessories', icon: '🏍️' },
      { name: 'Body Parts', icon: '🚪' },
      { name: 'Lighting', icon: '🔔' },
    ];

    for (const cat of carCategories) {
      await getOrCreateCategory(cat.name, 'CAR', cat.icon);
    }
    for (const cat of bikeCategories) {
      await getOrCreateCategory(cat.name, 'BIKE', cat.icon);
    }

    // --- One-time migration: fold the old granular bike categories into the
    // consolidated list above, and repair "Spark Plug" which -- due to an
    // earlier incident where its vehicleType label was flipped in place --
    // ended up holding two real Car products (NGK Iridium Spark Plug BKR6E,
    // NGK Ignition Coil) alongside the one genuine Bike product. Idempotent:
    // once the old categories are gone, this is a no-op on future runs.
    const BIKE_CATEGORY_REMAP: Record<string, string> = {
      'Engine Oil': 'Oils & Lubricants',
      'Chain Lubricant': 'Oils & Lubricants',
      'Brake Shoes': 'Brake System',
      'Disc Brake': 'Brake System',
      'Chain Kit': 'Transmission',
      'Clutch Plate': 'Clutch',
      'Battery': 'Batteries', // the contaminated CAR-tagged "Battery" row is left untouched
      'Spark Plug': 'Electrical',
      'Air Filter': 'Filters',
      'Fuel Filter': 'Filters',
      'Tube': 'Tyres',
      'Helmet': 'Accessories',
      'Handle Grip': 'Accessories',
      'Mirror': 'Accessories',
      'Bike Accessories': 'Accessories',
      'Indicator': 'Lighting',
    };

    for (const [oldName, newName] of Object.entries(BIKE_CATEGORY_REMAP)) {
      const oldCat = await prisma.category.findFirst({ where: { name: oldName, vehicleType: 'BIKE' } });
      if (!oldCat) continue; // already migrated on a previous run

      const newCat = await getOrCreateCategory(newName, 'BIKE', bikeCategories.find((c) => c.name === newName)?.icon || '📦');

      // Only Bike-tagged products move -- "Spark Plug" also holds Car products
      // (from the vehicleType-flip incident) that must stay exactly where
      // they are, under a Car-tagged category.
      const moved = await prisma.product.updateMany({
        where: { categoryId: oldCat.id, vehicleType: 'BIKE' },
        data: { categoryId: newCat.id },
      });

      const remainingProducts = await prisma.product.count({ where: { categoryId: oldCat.id } });
      if (remainingProducts === 0) {
        await prisma.category.delete({ where: { id: oldCat.id } });
      } else {
        // Residual Car products (only expected for "Spark Plug") -- the
        // category itself was never really a Bike category, restore it. A
        // real Car category of the same name may already exist (e.g. the
        // carCategories loop above creates "Spark Plug"/CAR unconditionally),
        // in which case merge into that one instead of a raw update, which
        // would collide with the @@unique([name, vehicleType]) constraint.
        const existingCarCat = await prisma.category.findFirst({ where: { name: oldName, vehicleType: 'CAR' } });
        if (existingCarCat) {
          await prisma.product.updateMany({ where: { categoryId: oldCat.id }, data: { categoryId: existingCarCat.id } });
          await prisma.category.delete({ where: { id: oldCat.id } });
        } else {
          await prisma.category.update({ where: { id: oldCat.id }, data: { vehicleType: 'CAR' } });
        }
      }
      console.log(`Migrated "${oldName}" -> "${newName}" (${moved.count} product(s) moved).`);
    }

    const carBrands = ['Bosch', 'Castrol', 'Valeo', 'NGK', 'Exide'];
    const bikeBrands = ['Hero Genuine', 'TVS Genuine', 'Bajaj Genuine', 'Yamaha Genuine', 'Honda Genuine'];

    for (const name of carBrands) {
      await prisma.brand.upsert({
        where: { name },
        update: { vehicleType: 'CAR' },
        create: { name, vehicleType: 'CAR', logo: null },
      });
    }
    for (const name of bikeBrands) {
      await prisma.brand.upsert({
        where: { name },
        update: { vehicleType: 'BIKE' },
        create: { name, vehicleType: 'BIKE', logo: null },
      });
    }

    async function getBrand(name: string) {
      return prisma.brand.findUnique({ where: { name } });
    }

    async function makeProduct(data: any) {
      const { category, brand, ...rest } = data;
      const existing = await prisma.product.findFirst({
        where: { name: data.name, vehicleType: data.vehicleType, categoryId: data.categoryId },
      });
      if (existing) return null;
      return prisma.product.create({ data: rest });
    }

    const carProducts = [
      { name: 'Bosch Aerotwin Wiper Blade', category: 'Wiper', brand: 'Bosch', price: 899, mrp: 1299, stock: 80, description: 'Aerodynamic dual rubber wiper blade for superior visibility.', vehicleType: 'CAR', compatibleModels: 'Swift, Baleno, i20', isFeatured: true, isDeal: false, salesCount: 320, discountPrice: 650, images: ['https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=400&q=80', 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=400&q=80'] },
      { name: 'Castrol MAGNATEC 5W-30 Engine Oil 3L', category: 'Engine Oil', brand: 'Castrol', price: 1299, mrp: 1799, stock: 120, description: 'Intelligent molecules that protect engine from the moment you start.', vehicleType: 'CAR', compatibleModels: 'Baleno, i20, Ertiga', isFeatured: true, isDeal: false, salesCount: 410, discountPrice: null, images: ['https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&q=80'] },
      { name: 'Bosch Ceramic Brake Pads Front Set', category: 'Brake Pads', brand: 'Bosch', price: 1899, mrp: 2499, stock: 60, description: 'Low dust ceramic formula for smooth, quiet braking.', vehicleType: 'CAR', compatibleModels: 'Creta, Verna, Ciaz', isFeatured: false, isDeal: true, salesCount: 210, discountPrice: 1400, images: ['https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=400&q=80'] },
      { name: 'Valeo Headlight Assembly LH', category: 'Headlight', brand: 'Valeo', price: 3499, mrp: 4999, stock: 25, description: 'Complete headlight unit with projector lens for enhanced night vision.', vehicleType: 'CAR', compatibleModels: 'Swift, Baleno', isFeatured: true, isDeal: false, salesCount: 90, discountPrice: 2800, images: ['https://images.unsplash.com/photo-1507133750069-b2319296c3df?w=400&q=80'] },
      { name: 'NGK Iridium Spark Plug BKR6E', category: 'Spark Plug', brand: 'NGK', price: 499, mrp: 699, stock: 200, description: 'Iridium fine wire plug for improved fuel efficiency and ignition.', vehicleType: 'CAR', compatibleModels: 'i20, Verna, Ciaz', isFeatured: false, isDeal: true, salesCount: 500, discountPrice: 350, images: ['https://images.unsplash.com/photo-1591886960579-1a665580463f?w=400&q=80'] },
      { name: 'Exide Mileage Car Battery 38B20R', category: 'Battery', brand: 'Exide', price: 2899, mrp: 3599, stock: 45, description: 'High cranking power with extended warranty.', vehicleType: 'CAR', compatibleModels: 'Swift, Dzire, Alto', isFeatured: false, isDeal: true, salesCount: 350, discountPrice: 2300, images: ['https://images.unsplash.com/photo-1620288627223-53302f4e8c74?w=400&q=80'] },
      { name: 'Bosch Cabin Air Filter', category: 'Cabin Filter', brand: 'Bosch', price: 699, mrp: 899, stock: 150, description: 'Filters pollen and dust for cleaner cabin air.', vehicleType: 'CAR', compatibleModels: 'Baleno, i20, Fortuner', isFeatured: false, isDeal: false, salesCount: 180, discountPrice: 499, images: ['https://images.unsplash.com/photo-1519644116538-9ce9e62f5b42?w=400&q=80'] },
      { name: 'Valeo AC Compressor', category: 'AC Compressor', brand: 'Valeo', price: 8999, mrp: 11999, stock: 15, description: 'Original equipment quality compressor for reliable cooling.', vehicleType: 'CAR', compatibleModels: 'Ertiga, Swift, Vitara Brezza', isFeatured: false, isDeal: true, salesCount: 45, discountPrice: 7499, images: ['https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400&q=80'] },
      { name: 'Bosch Alternator 70A', category: 'Alternator', brand: 'Bosch', price: 6499, mrp: 8499, stock: 20, description: '70A alternator with high performance and durability.', vehicleType: 'CAR', compatibleModels: 'Scorpio, Bolero, Xuv500', isFeatured: false, isDeal: false, salesCount: 30, discountPrice: null, images: ['https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=400&q=80'] },
      { name: 'Castrol Radicool Coolant 1L', category: 'Coolant', brand: 'Castrol', price: 299, mrp: 449, stock: 300, description: 'Advanced formulation protects against overheating and corrosion.', vehicleType: 'CAR', compatibleModels: 'All Maruti, Hyundai, Tata', isFeatured: false, isDeal: false, salesCount: 440, discountPrice: 199, images: ['https://images.unsplash.com/photo-1608181831718-c9ffd7ae69fc?w=400&q=80'] },
      { name: 'Bosch Shock Absorber Rear', category: 'Shock Absorber', brand: 'Bosch', price: 1599, mrp: 2199, stock: 55, description: 'Gas-filled rear shock absorber for comfortable ride.', vehicleType: 'CAR', compatibleModels: 'Swift, Dzire, Ciaz', isFeatured: false, isDeal: true, salesCount: 150, discountPrice: 1299, images: ['https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=400&q=80'] },
      { name: 'NGK Ignition Coil', category: 'Spark Plug', brand: 'NGK', price: 999, mrp: 1399, stock: 90, description: 'OE-quality ignition coil for strong spark and smooth idling.', vehicleType: 'CAR', compatibleModels: 'i20, Verna, Elite i20', isFeatured: false, isDeal: false, salesCount: 260, discountPrice: 750, images: ['https://images.unsplash.com/photo-1591886960579-1a665580463f?w=400&q=80'] },
    ];

    const bikeProducts = [
      // Engine Parts
      { name: 'Hero Genuine Piston Kit', category: 'Engine Parts', brand: 'Hero Genuine', price: 1899, mrp: 2399, stock: 35, description: 'Complete piston, ring, and pin kit for a precise engine rebuild.', vehicleType: 'BIKE', compatibleModels: 'Splendor, Passion, HF Deluxe', isFeatured: false, isDeal: false, salesCount: 65, discountPrice: null, images: ['https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=400&q=80'] },
      { name: 'Bajaj Genuine Cylinder Head Gasket Set', category: 'Engine Parts', brand: 'Bajaj Genuine', price: 449, mrp: 599, stock: 80, description: 'Full gasket set to seal the cylinder head and prevent leaks.', vehicleType: 'BIKE', compatibleModels: 'Pulsar, Avenger, Dominar', isFeatured: false, isDeal: true, salesCount: 90, discountPrice: 349, images: ['https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=400&q=80'] },
      // Oils & Lubricants
      { name: 'Castrol POWER1 4T 10W-30 1L', category: 'Oils & Lubricants', brand: 'Hero Genuine', price: 549, mrp: 749, stock: 200, description: 'Triple action formula for instant acceleration and superior protection.', vehicleType: 'BIKE', compatibleModels: 'Activa, Splendor, Pulsar, Apache', isFeatured: true, isDeal: false, salesCount: 480, discountPrice: null, images: ['https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&q=80'] },
      { name: 'Motul 3000 4T 20W-50 1L', category: 'Oils & Lubricants', brand: 'Yamaha Genuine', price: 449, mrp: 599, stock: 160, description: 'Mineral-based engine oil for reliable everyday protection.', vehicleType: 'BIKE', compatibleModels: 'FZ-S, R15, MT-15', isFeatured: false, isDeal: false, salesCount: 210, discountPrice: null, images: ['https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&q=80'] },
      { name: 'TVS Genuine Chain Lubricant Spray 400ml', category: 'Oils & Lubricants', brand: 'TVS Genuine', price: 249, mrp: 349, stock: 220, description: 'All-weather chain spray that resists fling-off and reduces wear.', vehicleType: 'BIKE', compatibleModels: 'Apache, Jupiter, Wego', isFeatured: false, isDeal: true, salesCount: 300, discountPrice: 199, images: ['https://images.unsplash.com/photo-1608181831718-c9ffd7ae69fc?w=400&q=80'] },
      // Brake System
      { name: 'Bosch Brake Shoes Rear Set', category: 'Brake System', brand: 'Bosch', price: 799, mrp: 1099, stock: 110, description: 'Premium brake shoes with consistent friction characteristics.', vehicleType: 'BIKE', compatibleModels: 'Splendor, Passion, Shine', isFeatured: false, isDeal: true, salesCount: 290, discountPrice: 599, images: ['https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=400&q=80'] },
      { name: 'Bajaj Genuine Disc Brake Pad', category: 'Brake System', brand: 'Bajaj Genuine', price: 599, mrp: 799, stock: 140, description: 'Non-asbestos organic pads with excellent braking feel.', vehicleType: 'BIKE', compatibleModels: 'Pulsar, Avenger, Dominar', isFeatured: false, isDeal: true, salesCount: 210, discountPrice: 399, images: ['https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=400&q=80'] },
      { name: 'TVS Genuine Brake Lever Assembly', category: 'Brake System', brand: 'TVS Genuine', price: 399, mrp: 549, stock: 95, description: 'Direct-fit brake lever assembly with smooth pivot action.', vehicleType: 'BIKE', compatibleModels: 'Apache, Jupiter, Wego', isFeatured: false, isDeal: false, salesCount: 120, discountPrice: null, images: ['https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=400&q=80'] },
      // Clutch
      { name: 'Hero Genuine Clutch Plate Set', category: 'Clutch', brand: 'Hero Genuine', price: 699, mrp: 899, stock: 70, description: 'OEM quality clutch plate set for Hero motorcycles.', vehicleType: 'BIKE', compatibleModels: 'Splendor, Passion, HF Deluxe', isFeatured: false, isDeal: true, salesCount: 160, discountPrice: 499, images: ['https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=400&q=80'] },
      { name: 'Bajaj Genuine Clutch Cable', category: 'Clutch', brand: 'Bajaj Genuine', price: 249, mrp: 349, stock: 130, description: 'Corrosion-resistant clutch cable with a smooth, light pull.', vehicleType: 'BIKE', compatibleModels: 'Pulsar, Avenger, Dominar', isFeatured: false, isDeal: false, salesCount: 140, discountPrice: null, images: ['https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=400&q=80'] },
      // Transmission
      { name: 'TVS Genuine Chain Kit', category: 'Transmission', brand: 'TVS Genuine', price: 1299, mrp: 1699, stock: 65, description: 'Heavy duty chain kit with O-ring sealed rollers.', vehicleType: 'BIKE', compatibleModels: 'Apache, Jupiter, Wego', isFeatured: true, isDeal: false, salesCount: 340, discountPrice: null, images: ['https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400&q=80'] },
      { name: 'Rolon Sprocket Set', category: 'Transmission', brand: 'Hero Genuine', price: 899, mrp: 1199, stock: 60, description: 'Front and rear sprocket set for smooth, quiet power transfer.', vehicleType: 'BIKE', compatibleModels: 'Splendor, Passion, HF Deluxe', isFeatured: false, isDeal: true, salesCount: 130, discountPrice: 699, images: ['https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400&q=80'] },
      // Suspension
      { name: 'Yamaha Genuine Front Fork Oil Seal Kit', category: 'Suspension', brand: 'Yamaha Genuine', price: 349, mrp: 499, stock: 90, description: 'Oil seal and dust seal kit to keep front forks leak-free.', vehicleType: 'BIKE', compatibleModels: 'FZ-S, R15, MT-15', isFeatured: false, isDeal: false, salesCount: 95, discountPrice: null, images: ['https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=400&q=80'] },
      { name: 'Hero Genuine Rear Shock Absorber', category: 'Suspension', brand: 'Hero Genuine', price: 1599, mrp: 2099, stock: 45, description: 'Gas-charged rear shock absorber tuned for a comfortable ride.', vehicleType: 'BIKE', compatibleModels: 'Splendor, Passion, HF Deluxe', isFeatured: false, isDeal: true, salesCount: 110, discountPrice: 1299, images: ['https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=400&q=80'] },
      // Electrical
      { name: 'NGK Spark Plug CR8E', category: 'Electrical', brand: 'NGK', price: 299, mrp: 399, stock: 250, description: 'High heat range plug for demanding riding conditions.', vehicleType: 'BIKE', compatibleModels: 'Pulsar, Apache, Xpulse', isFeatured: false, isDeal: false, salesCount: 520, discountPrice: 199, images: ['https://images.unsplash.com/photo-1591886960579-1a665580463f?w=400&q=80'] },
      { name: 'Honda Genuine CDI Unit', category: 'Electrical', brand: 'Honda Genuine', price: 1299, mrp: 1699, stock: 40, description: 'Capacitor discharge ignition unit for consistent spark timing.', vehicleType: 'BIKE', compatibleModels: 'Activa, Dio, CB Shine', isFeatured: false, isDeal: false, salesCount: 70, discountPrice: null, images: ['https://images.unsplash.com/photo-1591886960579-1a665580463f?w=400&q=80'] },
      // Filters
      { name: 'Yamaha Genuine Air Filter', category: 'Filters', brand: 'Yamaha Genuine', price: 349, mrp: 499, stock: 180, description: 'High-flow air filter for maximum engine breathing.', vehicleType: 'BIKE', compatibleModels: 'R15, MT-15, FZ-S', isFeatured: false, isDeal: false, salesCount: 190, discountPrice: null, images: ['https://images.unsplash.com/photo-1519644116538-9ce9e62f5b42?w=400&q=80'] },
      { name: 'Honda Genuine Fuel Filter', category: 'Filters', brand: 'Honda Genuine', price: 299, mrp: 449, stock: 130, description: 'Precision filter for clean fuel supply.', vehicleType: 'BIKE', compatibleModels: 'Activa, Dio, CB Shine', isFeatured: false, isDeal: false, salesCount: 140, discountPrice: 199, images: ['https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=400&q=80'] },
      // Tyres
      { name: 'Bosch Tubeless Tyre', category: 'Tyres', brand: 'TVS Genuine', price: 2499, mrp: 3299, stock: 40, description: 'High grip tubeless tyre for city and highway riding.', vehicleType: 'BIKE', compatibleModels: 'Pulsar, Apache, R15', isFeatured: true, isDeal: true, salesCount: 85, discountPrice: 1999, images: ['https://images.unsplash.com/photo-1557804506-669a67965ba0?w=400&q=80'] },
      { name: 'MRF Nylogrip Tube', category: 'Tyres', brand: 'Bajaj Genuine', price: 399, mrp: 549, stock: 150, description: 'Durable rubber tube built for daily city commuting.', vehicleType: 'BIKE', compatibleModels: 'Splendor, Activa, Pulsar', isFeatured: false, isDeal: false, salesCount: 160, discountPrice: null, images: ['https://images.unsplash.com/photo-1557804506-669a67965ba0?w=400&q=80'] },
      // Batteries
      { name: 'Exide Bike Battery 2.5Ah', category: 'Batteries', brand: 'Hero Genuine', price: 1199, mrp: 1599, stock: 55, description: 'Maintenance-free sealed battery with reliable cold cranking.', vehicleType: 'BIKE', compatibleModels: 'Splendor, Passion, HF Deluxe', isFeatured: false, isDeal: true, salesCount: 130, discountPrice: 999, images: ['https://images.unsplash.com/photo-1620288627223-53302f4e8c74?w=400&q=80'] },
      { name: 'Honda Genuine Battery 3Ah', category: 'Batteries', brand: 'Honda Genuine', price: 1399, mrp: 1799, stock: 40, description: 'Higher capacity sealed battery for electric-start models.', vehicleType: 'BIKE', compatibleModels: 'Activa, Dio, CB Shine', isFeatured: false, isDeal: false, salesCount: 90, discountPrice: null, images: ['https://images.unsplash.com/photo-1620288627223-53302f4e8c74?w=400&q=80'] },
      // Accessories
      { name: 'Studds Helmet Shifter', category: 'Accessories', brand: 'Hero Genuine', price: 1499, mrp: 2199, stock: 100, description: 'ISI certified full face helmet with clear visor.', vehicleType: 'BIKE', compatibleModels: 'Universal', isFeatured: true, isDeal: false, salesCount: 270, discountPrice: null, images: ['https://images.unsplash.com/photo-1557804506-669a67965ba0?w=400&q=80'] },
      { name: 'Hero Genuine Handle Grip', category: 'Accessories', brand: 'Hero Genuine', price: 199, mrp: 299, stock: 300, description: 'Soft knurl rubber grip for fatigue-free riding.', vehicleType: 'BIKE', compatibleModels: 'Splendor, Passion, HF Deluxe', isFeatured: false, isDeal: true, salesCount: 110, discountPrice: 149, images: ['https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=400&q=80'] },
      { name: 'TVS Mirror Set', category: 'Accessories', brand: 'TVS Genuine', price: 399, mrp: 549, stock: 160, description: 'Pair of mirrors with crisp reflection and secure mounting.', vehicleType: 'BIKE', compatibleModels: 'Apache, Jupiter, Wego', isFeatured: false, isDeal: false, salesCount: 175, discountPrice: null, images: ['https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&q=80'] },
      { name: 'Bajaj Genuine Seat Cover', category: 'Accessories', brand: 'Bajaj Genuine', price: 599, mrp: 799, stock: 120, description: 'Water-resistant seat cover with a grippy, non-slip finish.', vehicleType: 'BIKE', compatibleModels: 'Pulsar, Avenger, Dominar', isFeatured: false, isDeal: false, salesCount: 85, discountPrice: null, images: ['https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&q=80'] },
      // Body Parts
      { name: 'TVS Genuine Side Panel Set', category: 'Body Parts', brand: 'TVS Genuine', price: 799, mrp: 999, stock: 50, description: 'OEM-fit side panel set matching factory colour and finish.', vehicleType: 'BIKE', compatibleModels: 'Apache, Jupiter, Wego', isFeatured: false, isDeal: false, salesCount: 60, discountPrice: null, images: ['https://images.unsplash.com/photo-1519644116538-9ce9e62f5b42?w=400&q=80'] },
      { name: 'Honda Genuine Mudguard', category: 'Body Parts', brand: 'Honda Genuine', price: 449, mrp: 599, stock: 75, description: 'Durable front mudguard that protects against road spray.', vehicleType: 'BIKE', compatibleModels: 'Activa, Dio, CB Shine', isFeatured: false, isDeal: true, salesCount: 55, discountPrice: 349, images: ['https://images.unsplash.com/photo-1519644116538-9ce9e62f5b42?w=400&q=80'] },
      // Lighting
      { name: 'Hero Genuine Indicator Set', category: 'Lighting', brand: 'Hero Genuine', price: 299, mrp: 399, stock: 140, description: 'Front and rear indicator set with a bright, wide beam.', vehicleType: 'BIKE', compatibleModels: 'Splendor, Passion, HF Deluxe', isFeatured: false, isDeal: false, salesCount: 100, discountPrice: null, images: ['https://images.unsplash.com/photo-1507133750069-b2319296c3df?w=400&q=80'] },
      { name: 'Bajaj Genuine LED Headlight Bulb', category: 'Lighting', brand: 'Bajaj Genuine', price: 599, mrp: 799, stock: 110, description: 'Bright, low-power LED replacement bulb for better night visibility.', vehicleType: 'BIKE', compatibleModels: 'Pulsar, Avenger, Dominar', isFeatured: false, isDeal: true, salesCount: 145, discountPrice: 449, images: ['https://images.unsplash.com/photo-1507133750069-b2319296c3df?w=400&q=80'] },
    ];

    let carProductsCreated = 0;
    for (const p of carProducts) {
      const category = await getOrCreateCategory(p.category, 'CAR', '📦');
      const brand = await getBrand(p.brand);
      if (!category || !brand) continue;
      const created = await makeProduct({ ...p, categoryId: category.id, brandId: brand.id, vendorId: vendor.id });
      if (created) carProductsCreated++;
    }

    let bikeProductsCreated = 0;
    for (const p of bikeProducts) {
      const category = await getOrCreateCategory(p.category, 'BIKE', '📦');
      const brand = await getBrand(p.brand);
      if (!category || !brand) continue;
      const created = await makeProduct({ ...p, categoryId: category.id, brandId: brand.id, vendorId: vendor.id });
      if (created) bikeProductsCreated++;
    }

    const banners = [
      { title: 'Monsoon Service Sale - Up to 40% Off', vehicleType: 'CAR', image: 'https://images.unsplash.com/photo-1553440569-bcc63803a83d?w=800&q=80', buttonText: 'SHOP NOW', redirectLink: 'https://mechbazar.com', type: 'HOMEPAGE', isActive: true },
      { title: 'New Arrivals in Car Care', vehicleType: 'CAR', image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&q=80', buttonText: 'SHOP NOW', redirectLink: 'https://mechbazar.com', type: 'HOMEPAGE', isActive: true },
      { title: 'Bike Care Festival', vehicleType: 'BIKE', image: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=800&q=80', buttonText: 'SHOP NOW', redirectLink: 'https://mechbazar.com', type: 'HOMEPAGE', isActive: true },
      { title: 'Helmets & Riding Gear Sale', vehicleType: 'BIKE', image: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&q=80', buttonText: 'SHOP NOW', redirectLink: 'https://mechbazar.com', type: 'HOMEPAGE', isActive: true },
    ];

    let bannersCreated = 0;
    for (const b of banners) {
      const existing = await prisma.banner.findFirst({ where: { title: b.title, vehicleType: b.vehicleType } });
      if (!existing) {
        await prisma.banner.create({ data: b });
      } else {
        await prisma.banner.update({ where: { id: existing.id }, data: b });
      }
      bannersCreated++;
    }

    const offers = [
      { title: 'Car Parts Discount', description: 'Get 10% off on all car parts', code: 'CAR10', discountType: 'PERCENTAGE', discountValue: 10, minOrderValue: 500, vehicleType: 'CAR', isActive: true },
      { title: 'Car Flat Discount', description: 'Flat 200 off on orders above 1500', code: 'CARFLAT200', discountType: 'FLAT', discountValue: 200, minOrderValue: 1500, vehicleType: 'CAR', isActive: true },
      { title: 'Bike Parts Discount', description: 'Get 15% off on bike parts', code: 'BIKE15', discountType: 'PERCENTAGE', discountValue: 15, minOrderValue: 300, vehicleType: 'BIKE', isActive: true },
      { title: 'Bike Flat Offer', description: 'Flat 99 off on orders above 999', code: 'BIKEFREE99', discountType: 'FLAT', discountValue: 99, minOrderValue: 999, vehicleType: 'BIKE', isActive: true },
    ];

    let offersCreated = 0;
    for (const o of offers) {
      await prisma.offer.upsert({
        where: { code: o.code },
        update: o,
        create: o,
      });
      offersCreated++;
    }

    const summary = await prisma.$transaction([
      prisma.category.count(),
      prisma.brand.count(),
      prisma.product.count(),
      prisma.banner.count(),
      prisma.offer.count(),
    ]);

    console.log('Seed summary:', {
      categories: summary[0],
      brands: summary[1],
      products: summary[2],
      banners: summary[3],
      offers: summary[4],
      carProductsCreated,
      bikeProductsCreated,
      bannersCreated,
      offersCreated,
    });
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
