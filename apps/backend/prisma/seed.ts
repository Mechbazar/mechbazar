import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Create a dummy user and vendor
  const user = await prisma.user.upsert({
    where: { phone: '9999999999' },
    update: {},
    create: {
      phone: '9999999999',
      name: 'Default Vendor User',
      role: Role.VENDOR,
    },
  });

  const vendor = await prisma.vendor.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      storeName: 'MechBazar Default Store',
    },
  });

  // 2. Create Brands
  const brands = ['Castrol', 'Bosch', 'Amaron', 'Motul'];
  for (const b of brands) {
    await prisma.brand.upsert({
      where: { name: b },
      update: {},
      create: { name: b },
    });
  }

  // 3. Create Categories
  const categories = ['Engine Oils', 'Brake Pads', 'Batteries', 'Tyres', 'Spark Plugs', 'Wipers'];
  for (const c of categories) {
    // We don't have a unique constraint on Category name, so we use findFirst
    const existing = await prisma.category.findFirst({ where: { name: c } });
    if (!existing) {
      await prisma.category.create({
        data: { name: c },
      });
    }
  }

  // 4. Create some initial products based on the mock data
  const engineOilsCategory = await prisma.category.findFirst({ where: { name: 'Engine Oils' } });
  const brakePadsCategory = await prisma.category.findFirst({ where: { name: 'Brake Pads' } });
  const batteriesCategory = await prisma.category.findFirst({ where: { name: 'Batteries' } });

  const castrolBrand = await prisma.brand.findUnique({ where: { name: 'Castrol' } });
  const boschBrand = await prisma.brand.findUnique({ where: { name: 'Bosch' } });
  const amaronBrand = await prisma.brand.findUnique({ where: { name: 'Amaron' } });

  if (engineOilsCategory && castrolBrand) {
    await prisma.product.create({
      data: {
        vendorId: vendor.id,
        categoryId: engineOilsCategory.id,
        brandId: castrolBrand.id,
        name: 'Castrol MAGNATEC 5W-30 (3.5L)',
        description: 'Premium synthetic engine oil.',
        price: 1850,
        mrp: 2000,
        stock: 450,
        oemNumber: 'CST-5W30',
      },
    });
  }

  if (brakePadsCategory && boschBrand) {
    await prisma.product.create({
      data: {
        vendorId: vendor.id,
        categoryId: brakePadsCategory.id,
        brandId: boschBrand.id,
        name: 'Bosch Premium Brake Pads',
        description: 'High quality brake pads.',
        price: 1500,
        mrp: 1800,
        stock: 120,
        oemNumber: 'BOSCH-BP-112',
      },
    });
  }

  if (batteriesCategory && amaronBrand) {
    await prisma.product.create({
      data: {
        vendorId: vendor.id,
        categoryId: batteriesCategory.id,
        brandId: amaronBrand.id,
        name: 'Amaron Go 12V Battery',
        description: 'Long lasting battery.',
        price: 4200,
        mrp: 4500,
        stock: 15,
        oemNumber: 'AM-12V',
      },
    });
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
