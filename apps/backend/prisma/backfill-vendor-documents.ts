// One-time migration of VendorDocument rows still on the old public
// Firebase Storage URL (VendorDocument.url) into the private
// Postgres-bytes storage every other KYC document type (RiderDocument,
// TechnicianDocument) already uses. Downloads each document's current bytes
// from its public url, then writes fileData/mimeType/filePath -- the url
// column itself is left untouched (getVendorDocumentFile falls back to it
// for any row this hasn't reached yet, so this is safe to run incrementally
// and safe to re-run: rows with fileData already set are skipped).
//
// Once every environment's rows have been backfilled (this script's output
// reports 0 remaining), the `url` column can be dropped in a follow-up
// migration -- not done automatically here, since there's no way to confirm
// that from outside a live run against each environment's real database.
//
// Run with:      npx tsx prisma/backfill-vendor-documents.ts            (dry run, default)
// Then commit:   npx tsx prisma/backfill-vendor-documents.ts --commit
import prisma from '../src/config/prisma';

const commit = process.argv.includes('--commit');

const EXTENSION_BY_MIMETYPE: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

async function main() {
  console.log(`VendorDocument url -> fileData backfill -- ${commit ? 'COMMIT mode (writing changes)' : 'DRY RUN (pass --commit to apply)'}\n`);

  const rows = await prisma.vendorDocument.findMany({
    where: { fileData: null, url: { not: null } },
    select: { id: true, type: true, url: true },
  });
  console.log(`${rows.length} row(s) with a url but no fileData yet.\n`);

  let migrated = 0;
  let failed = 0;

  for (const row of rows) {
    if (!commit) {
      console.log(`  [dry-run] would fetch ${row.url} for VendorDocument ${row.id} (${row.type})`);
      continue;
    }
    try {
      const response = await fetch(row.url!);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const mimeType = response.headers.get('content-type') || 'application/octet-stream';
      const buffer = Buffer.from(await response.arrayBuffer());
      const ext = EXTENSION_BY_MIMETYPE[mimeType] || '';

      await prisma.vendorDocument.update({
        where: { id: row.id },
        data: {
          fileData: buffer,
          mimeType,
          filePath: `${row.type.toLowerCase()}${ext}`,
        },
      });
      migrated++;
      console.log(`  migrated VendorDocument ${row.id} (${row.type}, ${buffer.length} bytes)`);
    } catch (err: any) {
      failed++;
      console.error(`  FAILED VendorDocument ${row.id} (${row.type}): ${err.message} -- url left in place, will retry next run`);
    }
  }

  if (!commit) {
    console.log('\nThis was a dry run -- no changes were written. Re-run with --commit to apply.');
  } else {
    console.log(`\nDone: ${migrated} migrated, ${failed} failed (failed rows keep their url and can be retried by re-running this script).`);
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
