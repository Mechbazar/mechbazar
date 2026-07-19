import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function checkAdmin() {
  const adminUser = await prisma.user.findUnique({
    where: { email: 'admin@mechbazar.com' }
  });
  console.log('Admin user found:', !!adminUser);
  if (adminUser) {
    console.log('Has password:', !!adminUser.password);
    if (adminUser.password) {
      const match1 = await bcrypt.compare('password', adminUser.password);
      const match2 = await bcrypt.compare('........', adminUser.password); // User has 8 dots in screenshot
      console.log('Matches "password":', match1);
      console.log('Matches "........":', match2);
      console.log('Hashed password:', adminUser.password);
    }
  }
}

checkAdmin()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
