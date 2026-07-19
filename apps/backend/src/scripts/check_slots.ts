import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const slots = await prisma.timeSlot.findMany();
  console.log('Slots in DB:', JSON.stringify(slots, null, 2));

  const bookings = await prisma.serviceBooking.findMany({
    where: { scheduledDate: { gte: new Date(new Date().setHours(0,0,0,0)) } },
    select: { id: true, scheduledDate: true, timeSlotId: true, status: true }
  });
  console.log('Bookings from today onwards:', JSON.stringify(bookings, null, 2));
}

check().finally(() => prisma.$disconnect());
