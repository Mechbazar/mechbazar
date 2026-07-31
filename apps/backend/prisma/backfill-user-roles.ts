// One-time backfill for the new User.roles array (see schema.prisma).
// Every existing row's `roles` defaults to Prisma's `[CUSTOMER]` at the
// migration level regardless of what `role` actually says -- this script
// corrects that by copying each row's own legacy `role` into `roles` so no
// existing Vendor/Rider/Mechanic/staff account loses access to anything it
// could already do. Idempotent: only touches rows where `roles` doesn't
// already contain `role`, so it's safe to re-run.
//
// Run with:      npx tsx prisma/backfill-user-roles.ts            (dry run, default)
// Then commit:   npx tsx prisma/backfill-user-roles.ts --commit
import prisma from '../src/config/prisma';

const commit = process.argv.includes('--commit');

async function main() {
  console.log(`User.roles backfill -- ${commit ? 'COMMIT mode (writing changes)' : 'DRY RUN (pass --commit to apply)'}\n`);

  const users = await prisma.user.findMany({
    select: { id: true, phone: true, role: true, roles: true },
  });

  const needsFix = users.filter((u) => !u.roles.includes(u.role));
  console.log(`${users.length} total user(s); ${needsFix.length} row(s) missing their own role in \`roles\`.`);

  for (const u of needsFix) {
    const merged = Array.from(new Set([...u.roles, u.role]));
    if (!commit) {
      console.log(`  [dry-run] would set User ${u.id} (${u.phone}) roles ${JSON.stringify(u.roles)} -> ${JSON.stringify(merged)}`);
      continue;
    }
    await prisma.user.update({ where: { id: u.id }, data: { roles: merged } });
    console.log(`  updated User ${u.id} (${u.phone}) -> roles ${JSON.stringify(merged)}`);
  }

  if (!commit) {
    console.log('\nThis was a dry run -- no changes were written. Re-run with --commit to apply.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
