// Incident recovery: the enum migration's `prisma db push --accept-data-loss`
// (schema.prisma's Category/Brand/Product/Banner/Offer vehicleType columns
// going from String? to VehicleType) dropped and recreated those columns,
// resetting every row's vehicleType to the new column default (CAR) instead
// of preserving each row's actual prior value. Relations (categoryId on
// products, counts, etc.) were NOT affected -- only the vehicleType label
// itself was reset. This restores the label for every row we can identify
// with certainty by exact name (the specific 12 seeded bike products, their
// categories, the 5 bike brands, 2 bike banners, 2 bike offers -- all
// unambiguous seed-vehicle-data.ts / seed.ts literals). Ambiguous rows where
// a Category name also picked up real, pre-existing Car products under it
// (e.g. "Battery", "Suspension") are deliberately left as CAR rather than
// guessed at -- the fresh consolidated Bike taxonomy (seed-vehicle-data.ts)
// creates its own dedicated categories for those concepts instead of
// reclaiming the contaminated rows.
//
// Run with:  npx tsx prisma/recover-bike-vehicletype.ts
import prisma from '../src/config/prisma';

const BIKE_PRODUCT_NAMES = [
  'Castrol POWER1 4T 10W-30 1L',
  'Bosch Brake Shoes Rear Set',
  'NGK Spark Plug CR8E',
  'Hero Genuine Clutch Plate Set',
  'TVS Genuine Chain Kit',
  'Bajaj Genuine Disc Brake Pad',
  'Yamaha Genuine Air Filter',
  'Honda Genuine Fuel Filter',
  'Studds Helmet Shifter',
  'Hero Genuine Handle Grip',
  'TVS Mirror Set',
  'Bosch Tubeless Tyre',
];

const BIKE_BRAND_NAMES = ['Hero Genuine', 'TVS Genuine', 'Bajaj Genuine', 'Yamaha Genuine', 'Honda Genuine'];
const BIKE_BANNER_TITLES = ['Bike Care Festival', 'Helmets & Riding Gear Sale'];
const BIKE_OFFER_CODES = ['BIKE15', 'BIKEFREE99'];

// Categories that were part of seed-vehicle-data.ts's original bikeCategories
// list but ended up with 0 products (so unambiguous to relabel -- no risk of
// misclassifying real Car product data). "Battery" and "Suspension" are
// deliberately excluded: they now hold 3 and 8 products respectively, which
// predate any bike seeding and are almost certainly real Car catalog items
// that happened to share a category name with the bike taxonomy.
const UNAMBIGUOUS_EMPTY_BIKE_CATEGORY_NAMES = ['Indicator', 'Tube', 'Chain Lubricant', 'Bike Accessories'];

async function main() {
  const products = await prisma.product.findMany({
    where: { name: { in: BIKE_PRODUCT_NAMES } },
    select: { id: true, name: true, categoryId: true },
  });
  console.log(`Found ${products.length}/${BIKE_PRODUCT_NAMES.length} known bike products.`);

  const productUpdate = await prisma.product.updateMany({
    where: { id: { in: products.map((p) => p.id) } },
    data: { vehicleType: 'BIKE' },
  });
  console.log(`Restored vehicleType=BIKE on ${productUpdate.count} product(s).`);

  const categoryIds = [...new Set(products.map((p) => p.categoryId))];
  const categoryUpdate = await prisma.category.updateMany({
    where: { id: { in: categoryIds } },
    data: { vehicleType: 'BIKE' },
  });
  console.log(`Restored vehicleType=BIKE on ${categoryUpdate.count} categor(y/ies) (by exact product categoryId).`);

  const emptyCatUpdate = await prisma.category.updateMany({
    where: { name: { in: UNAMBIGUOUS_EMPTY_BIKE_CATEGORY_NAMES }, products: { none: {} } },
    data: { vehicleType: 'BIKE' },
  });
  console.log(`Restored vehicleType=BIKE on ${emptyCatUpdate.count} additional empty (unambiguous) bike categor(y/ies).`);

  const brandUpdate = await prisma.brand.updateMany({
    where: { name: { in: BIKE_BRAND_NAMES } },
    data: { vehicleType: 'BIKE' },
  });
  console.log(`Restored vehicleType=BIKE on ${brandUpdate.count} brand(s).`);

  const bannerUpdate = await prisma.banner.updateMany({
    where: { title: { in: BIKE_BANNER_TITLES } },
    data: { vehicleType: 'BIKE' },
  });
  console.log(`Restored vehicleType=BIKE on ${bannerUpdate.count} banner(s).`);

  const offerUpdate = await prisma.offer.updateMany({
    where: { code: { in: BIKE_OFFER_CODES } },
    data: { vehicleType: 'BIKE' },
  });
  console.log(`Restored vehicleType=BIKE on ${offerUpdate.count} offer(s).`);

  console.log('\nDone. Everything else (all real Car categories/products/brands, and');
  console.log('empty categories of ambiguous origin) intentionally left as CAR.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
