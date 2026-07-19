import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const inv = await prisma.inventory.findMany();
  console.log('Total inventory records:', inv.length);
}
main().catch(console.error).finally(() => prisma.$disconnect());
