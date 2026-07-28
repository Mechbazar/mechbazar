// Gives every product with an empty images[] something to render.
//
// WHY THIS EXISTS SEPARATELY FROM catalog-hygiene.ts
// --------------------------------------------------
// catalog-hygiene.ts already contains the fallback policy this implements
// ("no usable image -> use the category's image"), but its fixProductImages()
// begins with `if (!p.images || p.images.length === 0) continue;`, so the
// products that have *no* images -- precisely the ones the fallback is for --
// were the only ones it never reached. That skip is fixed there too, but
// running the whole hygiene pass against production does much more than this:
// it deletes junk rows, merges categories, and strips every external
// images.unsplash.com URL from the ~42 catalogue products that still carry
// one. Those are all defensible, but they are a bigger, more visible change
// than "fill in the blanks" and should be an explicit decision rather than a
// side effect. This script does only the blank-filling.
//
// WHAT IT DOES
//   1. Any category with no image gets a generated local placeholder SVG
//      (uploads/cat-placeholder-<slug>-<vehicle>.svg). As of the last check
//      all 35 live categories were imageless, so without this step there is
//      nothing for step 2 to copy.
//   2. Any product with an empty images[] adopts its category's image.
//
// WHAT IT DELIBERATELY DOES NOT DO
//   - Invent product photography, or point at an external stock-photo host.
//     A placeholder that is honestly a placeholder beats a stock photo of
//     someone else's brake pad presented as this product.
//   - Touch products that already have images, including the Unsplash ones.
//   - Dress up test fixtures. Rows that look like leftover test data are
//     reported for deletion (see catalog-hygiene.ts's removeJunkProducts)
//     rather than given artwork, because the fix for a test product in a live
//     catalogue is removing it, not photographing it.
//
// Idempotent: re-running changes nothing once every row is filled.
//
// Run with:  npx tsx prisma/backfill-missing-product-images.ts
//            npx tsx prisma/backfill-missing-product-images.ts --dry-run
//
// NOTE: writes files into the backend's uploads/ directory, so it must run
// where that directory is the one actually served at /uploads (on the VPS,
// inside the backend container or against its mounted volume).
import prisma from '../src/config/prisma';
import { writeCategoryPlaceholder } from './lib/placeholder-images';

const DRY_RUN = process.argv.includes('--dry-run');

// Matches the leftovers of manual/automated testing that reached the live
// catalogue. Kept in sync with catalog-hygiene.ts's removeJunkProducts.
const TEST_ROW = /^(\[TEST\]|E2E Test|Phase2 ?b?( Test)?)/i;

async function backfillCategoryImages() {
  const missing = await prisma.category.findMany({
    where: { image: null },
    select: { id: true, name: true, vehicleType: true },
    orderBy: { name: 'asc' },
  });

  if (missing.length === 0) {
    console.log('[categories] every category already has an image.');
    return;
  }

  console.log(`[categories] ${missing.length} without an image.`);
  for (const [i, cat] of missing.entries()) {
    if (DRY_RUN) {
      console.log(`  would generate placeholder for "${cat.name}" (${cat.vehicleType})`);
      continue;
    }
    const url = writeCategoryPlaceholder(cat.name, cat.vehicleType, i);
    await prisma.category.update({ where: { id: cat.id }, data: { image: url } });
    console.log(`  ${cat.name} (${cat.vehicleType}) -> ${url}`);
  }
}

async function backfillProductImages() {
  // `images: { isEmpty: true }` covers the empty-array case; the column is a
  // non-nullable String[] so there is no null variant to handle.
  const blanks = await prisma.product.findMany({
    where: { images: { isEmpty: true } },
    select: {
      id: true,
      name: true,
      category: { select: { id: true, name: true, image: true, vehicleType: true } },
    },
    orderBy: { name: 'asc' },
  });

  if (blanks.length === 0) {
    console.log('[products] every product already has an image.');
    return;
  }

  console.log(`\n[products] ${blanks.length} with no image.`);

  const testRows = blanks.filter((p) => TEST_ROW.test(p.name));
  const real = blanks.filter((p) => !TEST_ROW.test(p.name));

  for (const p of real) {
    // Re-read the category rather than trusting the value fetched before
    // backfillCategoryImages ran, so a category filled in this same pass is
    // still usable here.
    const category = await prisma.category.findUnique({
      where: { id: p.category.id },
      select: { image: true },
    });
    if (!category?.image) {
      console.log(`  SKIP  ${p.name} -- category "${p.category.name}" still has no image`);
      continue;
    }
    if (DRY_RUN) {
      console.log(`  would set ${p.name} -> ${category.image}`);
      continue;
    }
    await prisma.product.update({ where: { id: p.id }, data: { images: [category.image] } });
    console.log(`  ${p.name} -> ${category.image}`);
  }

  if (testRows.length > 0) {
    console.log(
      `\n[products] left ${testRows.length} test row(s) alone -- these should be deleted from the live` +
        ' catalogue (npx tsx prisma/catalog-hygiene.ts), not given artwork:'
    );
    testRows.forEach((p) => console.log(`  - ${p.name} (${p.id}) in category "${p.category.name}"`));
  }
}

async function main() {
  if (DRY_RUN) console.log('DRY RUN -- no writes will be made.\n');
  await backfillCategoryImages();
  await backfillProductImages();
  console.log('\nDone.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
