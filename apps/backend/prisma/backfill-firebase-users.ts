// One-time migration of existing Admin/Vendor accounts into Firebase
// Email/Password Auth. Every User row with an admin-family role or VENDOR
// that already has a bcrypt password gets a matching Firebase account,
// imported with that SAME password hash (via admin.auth().importUsers with
// hash.algorithm: 'BCRYPT') so nobody is locked out or forced through a mass
// password-reset email during rollout. Rows whose password isn't a
// recognizable bcrypt hash fall back to a passwordless Firebase account plus
// a manually-generated reset link, logged for the operator to send by hand.
//
// Safe to re-run: already-migrated rows (firebaseUid already set) are
// skipped by the query itself, and a duplicate-UID error from Firebase on
// the fallback path is treated as "already migrated, just backfill the DB
// column" rather than a failure.
//
// Run with:      npx tsx prisma/backfill-firebase-users.ts            (dry run, default)
// Then commit:   npx tsx prisma/backfill-firebase-users.ts --commit
import prisma from '../src/config/prisma';
import firebaseAdmin from '../src/config/firebase';
import { Role } from '@prisma/client';

const ADMIN_ROLES: Role[] = [
  Role.ADMIN,
  Role.SUPER_ADMIN,
  Role.OPERATIONS_MANAGER,
  Role.INVENTORY_MANAGER,
  Role.VENDOR_MANAGER,
  Role.FINANCE_MANAGER,
  Role.CUSTOMER_SUPPORT,
];

const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$/;
const IMPORT_BATCH_SIZE = 1000; // Firebase importUsers() hard limit per call

const commit = process.argv.includes('--commit');

type Outcome = 'imported-with-password' | 'imported-needs-reset-link' | 'skipped-already-migrated' | 'failed';

async function main() {
  console.log(`Firebase user backfill -- ${commit ? 'COMMIT mode (writing changes)' : 'DRY RUN (pass --commit to apply)'}\n`);

  const candidates = await prisma.user.findMany({
    where: {
      role: { in: [...ADMIN_ROLES, Role.VENDOR] },
      password: { not: null },
      firebaseUid: null,
      email: { not: null },
    },
    select: { id: true, email: true, name: true, password: true, role: true },
  });

  console.log(`Found ${candidates.length} candidate row(s) (role in admin-family/VENDOR, has password, no firebaseUid, has email).\n`);

  const counts: Record<Outcome, number> = {
    'imported-with-password': 0,
    'imported-needs-reset-link': 0,
    'skipped-already-migrated': 0,
    failed: 0,
  };

  const importable = candidates.filter(u => u.password && BCRYPT_HASH_PATTERN.test(u.password));
  const nonImportable = candidates.filter(u => !u.password || !BCRYPT_HASH_PATTERN.test(u.password));

  console.log(`  - ${importable.length} row(s) have a recognizable bcrypt hash -> will import with password carried over.`);
  console.log(`  - ${nonImportable.length} row(s) don't -> will get a passwordless account + reset link.\n`);

  // --- Path 1: bulk import with password hash carryover ---
  for (let i = 0; i < importable.length; i += IMPORT_BATCH_SIZE) {
    const batch = importable.slice(i, i + IMPORT_BATCH_SIZE);
    console.log(`Batch ${i / IMPORT_BATCH_SIZE + 1}: ${batch.length} user(s)`);

    if (!commit) {
      for (const u of batch) {
        console.log(`  [dry-run] would import ${u.email} (uid=${u.id}, role=${u.role})`);
        counts['imported-with-password']++;
      }
      continue;
    }

    const result = await firebaseAdmin.auth().importUsers(
      batch.map(u => ({
        uid: u.id,
        email: u.email as string,
        emailVerified: false,
        passwordHash: Buffer.from(u.password as string, 'utf8'),
        displayName: u.name ?? undefined,
      })),
      { hash: { algorithm: 'BCRYPT' } as const }
    );

    const failedIndexes = new Set(result.errors.map(e => e.index));
    for (let j = 0; j < batch.length; j++) {
      const u = batch[j];
      if (failedIndexes.has(j)) {
        const err = result.errors.find(e => e.index === j);
        console.error(`  FAILED importing ${u.email}: ${err?.error?.message}`);
        counts.failed++;
        continue;
      }
      await prisma.user.update({ where: { id: u.id }, data: { firebaseUid: u.id } });
      console.log(`  imported ${u.email} (uid=${u.id})`);
      counts['imported-with-password']++;
    }
  }

  // --- Path 2: passwordless account + reset link for non-bcrypt rows ---
  for (const u of nonImportable) {
    if (!u.email) continue; // excluded by the query already, guard for TS
    if (!commit) {
      console.log(`  [dry-run] would create passwordless account + reset link for ${u.email} (uid=${u.id})`);
      counts['imported-needs-reset-link']++;
      continue;
    }

    try {
      await firebaseAdmin.auth().createUser({ uid: u.id, email: u.email, emailVerified: false });
    } catch (err: any) {
      if (err?.code === 'auth/uid-already-exists') {
        await prisma.user.update({ where: { id: u.id }, data: { firebaseUid: u.id } });
        console.log(`  ${u.email} already exists in Firebase -- backfilled firebaseUid only.`);
        counts['skipped-already-migrated']++;
        continue;
      }
      console.error(`  FAILED creating Firebase account for ${u.email}: ${err?.message ?? err}`);
      counts.failed++;
      continue;
    }

    const resetLink = await firebaseAdmin.auth().generatePasswordResetLink(u.email);
    await prisma.user.update({ where: { id: u.id }, data: { firebaseUid: u.id } });
    console.log(`  created ${u.email} (uid=${u.id}) -- send this reset link manually:\n    ${resetLink}`);
    counts['imported-needs-reset-link']++;
  }

  console.log('\n--- Summary ---');
  console.log(`  imported with password carried over: ${counts['imported-with-password']}`);
  console.log(`  imported, needs manual reset link:    ${counts['imported-needs-reset-link']}`);
  console.log(`  already migrated (skipped):           ${counts['skipped-already-migrated']}`);
  console.log(`  failed:                                ${counts.failed}`);
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
