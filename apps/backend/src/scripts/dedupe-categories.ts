// One-time cleanup: merge duplicate Category rows (same name, case-insensitive,
// same vehicleType) into a single canonical row, reassigning any Products and
// child Categories pointing at the duplicates before deleting them.
import prisma from '../config/prisma';

async function main() {
  const categories = await prisma.category.findMany({
    include: { _count: { select: { products: true, children: true } } }
  });

  const groups = new Map<string, typeof categories>();
  for (const cat of categories) {
    const key = `${cat.name.trim().toLowerCase()}|${cat.vehicleType || ''}`;
    const list = groups.get(key) || [];
    list.push(cat);
    groups.set(key, list);
  }

  let mergedGroups = 0;
  let reassignedProducts = 0;
  let reassignedChildren = 0;
  let deletedCategories = 0;

  for (const [key, group] of groups) {
    if (group.length <= 1) continue;
    mergedGroups++;

    // Keep the row with the most products already attached; ties broken by most children.
    const [winner, ...losers] = [...group].sort((a, b) => {
      if (b._count.products !== a._count.products) return b._count.products - a._count.products;
      return b._count.children - a._count.children;
    });

    for (const loser of losers) {
      const productUpdate = await prisma.product.updateMany({
        where: { categoryId: loser.id },
        data: { categoryId: winner.id }
      });
      reassignedProducts += productUpdate.count;

      const childUpdate = await prisma.category.updateMany({
        where: { parentId: loser.id },
        data: { parentId: winner.id }
      });
      reassignedChildren += childUpdate.count;

      await prisma.category.delete({ where: { id: loser.id } });
      deletedCategories++;
    }

    console.log(`Merged "${winner.name}" (${winner.vehicleType}): kept ${winner.id}, removed ${losers.length} duplicate(s)`);
  }

  console.log('\n--- Summary ---');
  console.log(`Duplicate groups merged: ${mergedGroups}`);
  console.log(`Categories deleted: ${deletedCategories}`);
  console.log(`Products reassigned: ${reassignedProducts}`);
  console.log(`Child categories reassigned: ${reassignedChildren}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
