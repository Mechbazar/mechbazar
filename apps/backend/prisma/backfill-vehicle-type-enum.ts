// One-off normalization pass required before vehicleType columns can be converted
// from String? to a real Prisma enum (VehicleType { CAR BIKE }). Prisma/Postgres
// will refuse (or flag data loss on) a String -> enum column push unless every
// existing value already matches an enum member exactly, so this walks every
// row on the five affected models and coerces vehicleType to a legal value
// (case-insensitive match -> uppercased; anything else, including null/empty,
// falls back to 'CAR', matching the schema's pre-existing @default("CAR")).
//
// Run with:  npx tsx prisma/backfill-vehicle-type-enum.ts
import prisma from '../src/config/prisma';

const VALID = ['CAR', 'BIKE'];

async function normalizeModel(modelName: 'category' | 'brand' | 'product' | 'banner' | 'offer') {
  const rows = await (prisma[modelName] as any).findMany({ select: { id: true, vehicleType: true } });
  let changed = 0;

  for (const row of rows) {
    const raw = row.vehicleType;
    const upper = String(raw ?? '').toUpperCase();
    const normalized = VALID.includes(upper) ? upper : 'CAR';

    if (raw !== normalized) {
      await (prisma[modelName] as any).update({
        where: { id: row.id },
        data: { vehicleType: normalized },
      });
      console.log(`  ${modelName} ${row.id}: ${JSON.stringify(raw)} -> ${normalized}`);
      changed++;
    }
  }

  console.log(`${modelName}: ${rows.length} row(s) checked, ${changed} normalized.`);
  return changed;
}

async function main() {
  console.log('Normalizing vehicleType columns before enum migration...\n');

  let total = 0;
  total += await normalizeModel('category');
  total += await normalizeModel('brand');
  total += await normalizeModel('product');
  total += await normalizeModel('banner');
  total += await normalizeModel('offer');

  console.log(`\nDone. ${total} row(s) normalized across all models.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
