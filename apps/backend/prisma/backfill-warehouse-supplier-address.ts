// One-time copy of Warehouse/Supplier's legacy free-text `address` string
// into the new structured `addressLine1` column (see schema.prisma). Pure
// string copy, no parsing, no geocoding, no external API calls -- lossless
// and reversible (the source `address` column is never touched). Rows that
// already have addressLine1 set are skipped, so this is safe to re-run.
//
// Run with:      npx tsx prisma/backfill-warehouse-supplier-address.ts            (dry run, default)
// Then commit:   npx tsx prisma/backfill-warehouse-supplier-address.ts --commit
import prisma from '../src/config/prisma';

const commit = process.argv.includes('--commit');

async function main() {
  console.log(`Warehouse/Supplier address backfill -- ${commit ? 'COMMIT mode (writing changes)' : 'DRY RUN (pass --commit to apply)'}\n`);

  const warehouses = await prisma.warehouse.findMany({
    where: { addressLine1: null },
    select: { id: true, name: true, address: true },
  });
  console.log(`Warehouse: ${warehouses.length} row(s) with no addressLine1 yet.`);
  for (const w of warehouses) {
    if (!commit) {
      console.log(`  [dry-run] would set Warehouse ${w.id} (${w.name}) addressLine1 = ${JSON.stringify(w.address)}`);
      continue;
    }
    await prisma.warehouse.update({ where: { id: w.id }, data: { addressLine1: w.address } });
    console.log(`  updated Warehouse ${w.id} (${w.name})`);
  }

  const suppliers = await prisma.supplier.findMany({
    where: { addressLine1: null, address: { not: null } },
    select: { id: true, name: true, address: true },
  });
  console.log(`\nSupplier: ${suppliers.length} row(s) with no addressLine1 yet (and a non-null legacy address).`);
  for (const s of suppliers) {
    if (!commit) {
      console.log(`  [dry-run] would set Supplier ${s.id} (${s.name}) addressLine1 = ${JSON.stringify(s.address)}`);
      continue;
    }
    await prisma.supplier.update({ where: { id: s.id }, data: { addressLine1: s.address } });
    console.log(`  updated Supplier ${s.id} (${s.name})`);
  }

  if (!commit) {
    console.log('\nThis was a dry run -- no changes were written. Re-run with --commit to apply.');
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
