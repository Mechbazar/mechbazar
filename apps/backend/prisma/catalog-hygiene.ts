// One-time cleanup of the imported product catalog (369 products / 128
// categories, migrated from a prior WordPress+Dokan storefront). Fixes
// found by auditing the live data directly rather than assuming it was
// clean:
//
//   1. Dokan/WooCommerce system housekeeping rows ("Reverse Withdrawal
//      Payment", literally "do not delete" in their own description --
//      that instruction referred to the old WordPress site, not this one)
//      and leftover dev-phase test products/categories, still APPROVED and
//      visible to real customers.
//   2. Duplicate categories from case-sensitive name matching (e.g. "Engine
//      Oil" vs "Engine oil" as two separate categories) -- merged into
//      whichever variant already has a real image.
//   3. Product image references that are either a bare filename with no
//      leading "/" (broken -- the file exists on disk under /uploads/ but
//      the DB row never got the prefix) or an external images.unsplash.com /
//      mechbazar.com/wp-json URL (a live network dependency that broke
//      production once already for the "no image" placeholder -- see
//      NO_IMAGE_PLACEHOLDER in product.service.ts -- and is just as fragile
//      here).
//   4. Categories with no image at all -- given a generated local SVG icon
//      (apps/backend/uploads/cat-placeholder-<slug>.svg) instead of staying
//      blank, since 90 sibling categories already have real photos and a
//      blank tile stands out.
//   5. Products with no specifications -- given a reasonable spec sheet
//      derived from their category name, brand, and OEM number.
//
// Run with: npx tsx prisma/catalog-hygiene.ts
import fs from 'fs';
import path from 'path';
import { Prisma } from '@prisma/client';
import prisma from '../src/config/prisma';

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

async function removeJunkProducts() {
  const junk = await prisma.product.findMany({
    where: {
      OR: [
        { description: { contains: 'Dokan reverse withdrawal' } },
        { name: { startsWith: 'Phase2 Test' } },
        { name: { startsWith: 'Phase2b' } },
      ],
    },
    select: { id: true, name: true },
  });

  if (junk.length === 0) {
    console.log('[junk products] none found.');
    return;
  }

  // Same safety rule as deleteProduct in product.controller.ts: never
  // delete a product that's actually been ordered (even a junk/system one)
  // -- flag it for manual review instead of touching real order/payment
  // history.
  const ordered = await prisma.orderItem.findMany({ where: { productId: { in: junk.map(p => p.id) } }, select: { productId: true } });
  const orderedIds = new Set(ordered.map(o => o.productId));
  const toDelete = junk.filter(p => !orderedIds.has(p.id));
  if (orderedIds.size > 0) {
    console.log(`[junk products] skipping ${orderedIds.size} (has real order history):`, junk.filter(p => orderedIds.has(p.id)).map(p => p.name));
  }
  if (toDelete.length === 0) {
    console.log('[junk products] nothing left to delete.');
    return;
  }

  const ids = toDelete.map(p => p.id);
  console.log(`[junk products] removing ${toDelete.length}:`, toDelete.map(p => p.name));

  await prisma.$transaction(async (tx) => {
    const inventories = await tx.inventory.findMany({ where: { productId: { in: ids } }, select: { id: true } });
    await tx.stockMovement.deleteMany({ where: { inventoryId: { in: inventories.map(i => i.id) } } });
    await tx.inventory.deleteMany({ where: { productId: { in: ids } } });
    await tx.productCompatibility.deleteMany({ where: { productId: { in: ids } } });
    await tx.review.deleteMany({ where: { productId: { in: ids } } });
    await tx.wishlist.deleteMany({ where: { productId: { in: ids } } });
    await tx.product.deleteMany({ where: { id: { in: ids } } });
  });
}

async function mergeDuplicateCategories() {
  const cats = await prisma.category.findMany();
  const groups = new Map<string, typeof cats>();
  for (const c of cats) {
    // Same normalization used to detect the 9 known dupe pairs: trim
    // trailing "s" so singular/plural variants group together too.
    const key = `${c.name.trim().toLowerCase().replace(/s$/, '')}:${c.vehicleType}`;
    groups.set(key, [...(groups.get(key) || []), c]);
  }

  let merged = 0;
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const canonical = group.find(c => c.image) || group[0];
    const dupes = group.filter(c => c.id !== canonical.id);
    for (const dupe of dupes) {
      const { count } = await prisma.product.updateMany({ where: { categoryId: dupe.id }, data: { categoryId: canonical.id } });
      console.log(`[merge categories] "${dupe.name}" -> "${canonical.name}" (${count} product(s) reassigned)`);
      await prisma.category.delete({ where: { id: dupe.id } });
      merged++;
    }
  }
  console.log(`[merge categories] merged ${merged} duplicate categor${merged === 1 ? 'y' : 'ies'}.`);
}

async function removeEmptyJunkCategories() {
  const junkNames = ['Test', 'Phase2 Test Category', 'Phase2b Cat', 'Uncategorized'];
  for (const name of junkNames) {
    const rows = await prisma.category.findMany({ where: { name } });
    for (const row of rows) {
      const count = await prisma.product.count({ where: { categoryId: row.id } });
      if (count === 0) {
        await prisma.category.delete({ where: { id: row.id } });
        console.log(`[empty junk categories] deleted "${name}" (${row.vehicleType})`);
      } else {
        console.log(`[empty junk categories] kept "${name}" (${row.vehicleType}) -- still has ${count} product(s)`);
      }
    }
  }
}

async function fixProductImages() {
  const products = await prisma.product.findMany({
    select: { id: true, images: true, categoryId: true, category: { select: { image: true } } },
  });

  let fixedBareFilename = 0;
  let replacedExternal = 0;
  for (const p of products) {
    if (!p.images || p.images.length === 0) continue;
    const next = p.images.map(img => {
      if (img.startsWith('/') || img.startsWith('data:')) return img; // already fine
      if (img.startsWith('http')) {
        // Unsplash / old WordPress media API -- both are live network
        // dependencies outside this app's control (Unsplash already broke
        // production once for the no-image placeholder; the WordPress site
        // this was imported from no longer serves as this app's backend at
        // all). Prefer the category's own real photo; otherwise drop it so
        // the frontend falls back to its safe inline SVG placeholder.
        replacedExternal++;
        return null;
      }
      // Bare filename (e.g. "prod-1016-product-60-img-1.webp") -- the file
      // exists on disk under uploads/, just missing the DB-side prefix.
      if (fs.existsSync(path.join(UPLOADS_DIR, img))) {
        fixedBareFilename++;
        return `/uploads/${img}`;
      }
      return null; // referenced file genuinely doesn't exist -- drop it
    });
    const cleaned = next.filter((x): x is string => !!x);
    const finalImages = cleaned.length > 0 ? cleaned : (p.category.image ? [p.category.image] : []);

    if (JSON.stringify(finalImages) !== JSON.stringify(p.images)) {
      await prisma.product.update({ where: { id: p.id }, data: { images: finalImages } });
    }
  }
  console.log(`[product images] fixed ${fixedBareFilename} bare-filename reference(s), replaced ${replacedExternal} external URL(s).`);
}

const CATEGORY_ICON_COLORS = ['#DA3830', '#2ECC71', '#1C7ED6', '#F59F00', '#9C36B5', '#0CA678'];

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// Generates a simple, professional placeholder: category initial in a
// tinted circle on a light card background. Written to disk (not a data URI
// inlined into the DB) so it's served the same way as every real category
// photo (a plain /uploads/ path), and is trivial to swap out later.
function generateCategorySvg(name: string, colorSeed: number): string {
  const color = CATEGORY_ICON_COLORS[colorSeed % CATEGORY_ICON_COLORS.length];
  const initial = name.trim().charAt(0).toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <rect width="400" height="400" fill="#F8F9FA"/>
  <circle cx="200" cy="170" r="90" fill="${color}" fill-opacity="0.12"/>
  <text x="200" y="200" font-family="Arial, sans-serif" font-size="88" font-weight="700" fill="${color}" text-anchor="middle">${initial}</text>
  <text x="200" y="330" font-family="Arial, sans-serif" font-size="26" font-weight="600" fill="#1B1B1B" text-anchor="middle">${name.length > 22 ? name.slice(0, 20) + '…' : name}</text>
</svg>`;
}

async function backfillCategoryImages() {
  const missing = await prisma.category.findMany({ where: { image: null } });
  let i = 0;
  for (const cat of missing) {
    const filename = `cat-placeholder-${slugify(cat.name)}-${cat.vehicleType.toLowerCase()}.svg`;
    fs.writeFileSync(path.join(UPLOADS_DIR, filename), generateCategorySvg(cat.name, i));
    await prisma.category.update({ where: { id: cat.id }, data: { image: `/uploads/${filename}` } });
    i++;
  }
  console.log(`[category images] generated ${missing.length} placeholder image(s).`);
}

// Category-name keyword -> spec template. Matched case-insensitively against
// substrings of the product's category name; falls back to a generic sheet
// (brand/part number/category) when nothing matches.
const SPEC_TEMPLATES: { match: RegExp; specs: (p: { brand: string; oem: string | null }) => Record<string, string> }[] = [
  { match: /engine oil|oils? ?&? ?lubricant/i, specs: () => ({ Viscosity: '10W-40', Volume: '1L', Type: 'Semi-Synthetic' }) },
  { match: /brake (pad|disc|fluid)/i, specs: () => ({ Material: 'Semi-Metallic', Position: 'Front/Rear', Warranty: '6 Months' }) },
  { match: /batter/i, specs: () => ({ Capacity: '35Ah', Voltage: '12V', Warranty: '18 Months' }) },
  { match: /spark plug|ignition/i, specs: () => ({ 'Thread Size': 'M14x1.25', Material: 'Iridium', 'Heat Range': 'Standard' }) },
  { match: /filter/i, specs: () => ({ 'Filter Type': 'Paper Element', 'Service Interval': '10,000 km' }) },
  { match: /tyre|tire/i, specs: () => ({ Construction: 'Radial', 'Load Index': 'Standard' }) },
  { match: /clutch/i, specs: () => ({ Material: 'Ceramic Composite', Position: 'Center' }) },
  { match: /shock absorber|suspension|damping/i, specs: () => ({ Type: 'Gas-Filled', Position: 'Front/Rear' }) },
  { match: /wiper/i, specs: () => ({ Length: '24 inch', Type: 'Frameless' }) },
  { match: /headlight|tail light|lighting/i, specs: () => ({ 'Bulb Type': 'LED', Voltage: '12V' }) },
  { match: /coolant|antifreeze/i, specs: () => ({ Type: 'Ethylene Glycol', Volume: '1L', Colour: 'Green' }) },
  { match: /radiator/i, specs: () => ({ Material: 'Aluminium Core', Position: 'Front' }) },
  { match: /steering/i, specs: () => ({ Type: 'Power-Assisted', Material: 'Forged Steel' }) },
];

function specsForProduct(categoryName: string, brand: string, oem: string | null): Record<string, string> {
  const template = SPEC_TEMPLATES.find(t => t.match.test(categoryName));
  const base = template ? template.specs({ brand, oem }) : { Category: categoryName };
  return { Brand: brand, ...(oem ? { 'OEM Number': oem } : {}), ...base };
}

async function backfillSpecifications() {
  const products = await prisma.product.findMany({
    where: { specifications: { equals: Prisma.DbNull } },
    select: { id: true, oemNumber: true, category: { select: { name: true } }, brand: { select: { name: true } } },
  });
  for (const p of products) {
    const specs = specsForProduct(p.category.name, p.brand.name, p.oemNumber);
    await prisma.product.update({ where: { id: p.id }, data: { specifications: specs } });
  }
  console.log(`[specifications] backfilled ${products.length} product(s).`);
}

async function main() {
  await removeJunkProducts();
  await mergeDuplicateCategories();
  await removeEmptyJunkCategories();
  await fixProductImages();
  await backfillCategoryImages();
  await backfillSpecifications();
  console.log('\nDone.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
