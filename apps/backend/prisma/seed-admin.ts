import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';
import firebaseAdmin from '../src/config/firebase';

const prisma = new PrismaClient();

// Admin credentials now live only in Firebase Auth -- Postgres no longer
// stores a password for this row at all (see the Firebase auth migration).
// SEED_ADMIN_PASSWORD must be set explicitly per environment; there is no
// hardcoded fallback, since that was a committed plaintext credential.
async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@mechbazar.com';
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) {
    throw new Error(
      'SEED_ADMIN_PASSWORD env var is required to seed an admin account (set it in .env -- see .env.example).'
    );
  }

  const adminUser = await prisma.user.upsert({
    where: { email },
    update: {
      role: Role.ADMIN,
    },
    create: {
      email,
      phone: '0000000000',
      name: 'Admin User',
      role: Role.ADMIN,
    },
  });

  let firebaseUid = adminUser.firebaseUid;
  if (!firebaseUid) {
    try {
      const firebaseUser = await firebaseAdmin.auth().createUser({
        uid: adminUser.id,
        email,
        password,
        emailVerified: true, // seed account -- not a real migrated user, pre-verify it
      });
      firebaseUid = firebaseUser.uid;
    } catch (err: any) {
      if (err?.code === 'auth/uid-already-exists' || err?.code === 'auth/email-already-exists') {
        const existing = await firebaseAdmin.auth().getUserByEmail(email);
        firebaseUid = existing.uid;
      } else {
        throw err;
      }
    }
    await prisma.user.update({ where: { id: adminUser.id }, data: { firebaseUid } });
  }

  console.log(`Admin user ready: ${email} (firebaseUid=${firebaseUid}). Password is set only in Firebase, not stored in Postgres.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
