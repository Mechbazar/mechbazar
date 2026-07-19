import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const firstVendor = await prisma.vendor.findFirst();
  if (!firstVendor) {
    console.log("No vendors found.");
    return;
  }

  const updated = await prisma.vendor.update({
    where: { id: firstVendor.id },
    data: { walletBalance: 50000 }
  });

  console.log(`Updated vendor ${updated.storeName} wallet balance to 50000`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
