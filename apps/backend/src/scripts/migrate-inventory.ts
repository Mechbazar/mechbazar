import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting Inventory Migration...');

  // 1. Create a Default Main Warehouse
  let mainWarehouse = await prisma.warehouse.findUnique({
    where: { code: 'MAIN_WH_01' }
  });

  if (!mainWarehouse) {
    mainWarehouse = await prisma.warehouse.create({
      data: {
        name: 'Main Central Warehouse',
        code: 'MAIN_WH_01',
        address: '123 Industrial Area, Phase 1',
        capacity: 10000,
        isActive: true
      }
    });
    console.log('Created Main Warehouse:', mainWarehouse.id);
  } else {
    console.log('Main Warehouse already exists:', mainWarehouse.id);
  }

  // 2. Fetch all products
  const products = await prisma.product.findMany({
    select: { id: true, stock: true }
  });

  console.log(`Found ${products.length} products to migrate.`);

  let migratedCount = 0;

  // 3. Migrate each product's stock into the Inventory table
  for (const product of products) {
    const existingInventory = await prisma.inventory.findUnique({
      where: {
        productId_warehouseId: {
          productId: product.id,
          warehouseId: mainWarehouse.id
        }
      }
    });

    if (!existingInventory) {
      await prisma.inventory.create({
        data: {
          productId: product.id,
          warehouseId: mainWarehouse.id,
          availableStock: product.stock, // Transfer existing stock here
          reservedStock: 0,
          damagedStock: 0,
          reorderLevel: 5 // Default reorder level
        }
      });
      migratedCount++;
    }
  }

  console.log(`Successfully migrated ${migratedCount} products to the new Inventory system.`);
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
