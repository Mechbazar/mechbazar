import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const warehouse = await prisma.warehouse.upsert({
    where: { code: 'MAIN_WH_01' },
    update: {},
    create: {
      name: 'MechBazar Central Warehouse',
      code: 'MAIN_WH_01',
      address: 'Mumbai Central',
      capacity: 100000,
    }
  });

  console.log('Main Warehouse verified:', warehouse.code);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
