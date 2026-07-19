// Pre-existing data integrity issue found while migrating vehicleType to a real
// enum: prisma db push refused to apply the schema (Category is unique on
// [name, vehicleType]) because 87 (name, vehicleType) pairs already had two
// rows each in the live DB -- unrelated to this feature, but blocking it.
// For every duplicate group: keep one canonical row, repoint any Products
// (and any child categories' parentId) from the other row(s) onto it, then
// delete the now-empty duplicates.
//
// Run with:  npx tsx prisma/dedupe-categories.ts
import prisma from '../src/config/prisma';

async function main() {
  const categories = await prisma.category.findMany({
    select: { id: true, name: true, vehicleType: true },
  });

  const groups = new Map<string, typeof categories>();
  for (const c of categories) {
    const key = `${c.name}::${c.vehicleType}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }

  const duplicateGroups = [...groups.entries()].filter(([, rows]) => rows.length > 1);
  console.log(`Found ${duplicateGroups.length} duplicate (name, vehicleType) group(s).`);

  let mergedCategories = 0;
  let reassignedProducts = 0;
  let reassignedChildren = 0;

  for (const [key, rows] of duplicateGroups) {
    const [canonical, ...dupes] = rows;
    const dupeIds = dupes.map((d) => d.id);

    const productUpdate = await prisma.product.updateMany({
      where: { categoryId: { in: dupeIds } },
      data: { categoryId: canonical.id },
    });
    reassignedProducts += productUpdate.count;

    const childUpdate = await prisma.category.updateMany({
      where: { parentId: { in: dupeIds } },
      data: { parentId: canonical.id },
    });
    reassignedChildren += childUpdate.count;

    const { count } = await prisma.category.deleteMany({ where: { id: { in: dupeIds } } });
    mergedCategories += count;

    console.log(`  ${key}: kept ${canonical.id}, merged ${dupeIds.length} dup(s) (products moved: ${productUpdate.count}, children repointed: ${childUpdate.count})`);
  }

  console.log(`\nDone. Merged ${mergedCategories} duplicate categories, reassigned ${reassignedProducts} product(s) and ${reassignedChildren} child categor(y/ies).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
