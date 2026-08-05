import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Ensures the singleton PlatformCommissionSettings row exists with the
// brief's suggested defaults (10% product / 20% service). Idempotent: if the
// row already exists (e.g. an admin already edited it via the Commission &
// Payout Settings page), this does nothing -- it must never clobber a live
// admin-set value.
async function main() {
  const existing = await prisma.platformCommissionSettings.findUnique({ where: { id: 'GLOBAL' } });
  if (existing) {
    console.log('PlatformCommissionSettings already exists -- leaving it untouched.');
    return;
  }

  await prisma.platformCommissionSettings.create({
    data: {
      id: 'GLOBAL',
      defaultProductCommissionPct: 10,
      defaultServiceCommissionPct: 20,
    },
  });

  console.log('Seeded PlatformCommissionSettings defaults (10% product / 20% service).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
