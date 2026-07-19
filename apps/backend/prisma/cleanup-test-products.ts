// Removes all seeded [TEST]-prefixed products before launch, along with any orders placed
// against them during manual testing (Product.delete refuses to run while OrderItems still
// reference the product, so those have to be cleaned up first).
//
// Run with:  npx tsx prisma/cleanup-test-products.ts
import prisma from '../src/config/prisma';

async function main() {
  const testProducts = await prisma.product.findMany({
    where: { name: { startsWith: '[TEST]' } },
    select: { id: true, name: true },
  });

  if (testProducts.length === 0) {
    console.log('No [TEST] products found. Nothing to clean up.');
    return;
  }

  const productIds = testProducts.map((p) => p.id);
  console.log(`Found ${testProducts.length} [TEST] product(s):`);
  testProducts.forEach((p) => console.log(`  - ${p.name} (${p.id})`));

  const testOrderItems = await prisma.orderItem.findMany({
    where: { productId: { in: productIds } },
    select: { orderId: true },
  });
  const orderIds = [...new Set(testOrderItems.map((oi) => oi.orderId))];

  if (orderIds.length > 0) {
    console.log(`\nRemoving ${orderIds.length} order(s) placed against [TEST] products...`);
    await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  }

  console.log(`\nRemoving ${testProducts.length} [TEST] product(s)...`);
  const { count } = await prisma.product.deleteMany({ where: { id: { in: productIds } } });

  console.log(`\nDone. Deleted ${count} product(s) and ${orderIds.length} associated order(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
