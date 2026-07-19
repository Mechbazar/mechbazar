import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
  console.log('=== Database Verification Results ===');
  
  const tables = [
    { name: 'User', count: () => prisma.user.count() },
    { name: 'Vendor', count: () => prisma.vendor.count() },
    { name: 'Category', count: () => prisma.category.count() },
    { name: 'Brand', count: () => prisma.brand.count() },
    { name: 'Product', count: () => prisma.product.count() },
    { name: 'Manufacturer', count: () => prisma.manufacturer.count() },
    { name: 'Model', count: () => prisma.model.count() },
    { name: 'Variant', count: () => prisma.variant.count() },
    { name: 'ServiceCategory', count: () => prisma.serviceCategory.count() },
    { name: 'ServicePackage', count: () => prisma.servicePackage.count() },
    { name: 'TimeSlot', count: () => prisma.timeSlot.count() },
    { name: 'Warehouse', count: () => prisma.warehouse.count() },
    { name: 'Inventory', count: () => prisma.inventory.count() },
    { name: 'Order', count: () => prisma.order.count() },
    { name: 'ServiceBooking', count: () => prisma.serviceBooking.count() },
    { name: 'Coupon', count: () => prisma.coupon.count() },
  ];

  for (const t of tables) {
    try {
      const c = await t.count();
      console.log(`Table: ${t.name} -> ${c} records`);
    } catch (err: any) {
      console.error(`Error reading ${t.name}:`, err.message);
    }
  }

  const timeSlots = await prisma.timeSlot.findMany();
  console.log(`Time slots configured:`, timeSlots.map(s => s.label));

  if (timeSlots.length < 5) {
    console.log('Fewer than 5 time slots found. Seeding default time slots...');
    const defaultSlots = [
      { label: '09:00 AM - 11:00 AM', startTime: '09:00', endTime: '11:00' },
      { label: '11:00 AM - 01:00 PM', startTime: '11:00', endTime: '13:00' },
      { label: '01:00 PM - 03:00 PM', startTime: '13:00', endTime: '15:00' },
      { label: '03:00 PM - 05:00 PM', startTime: '15:00', endTime: '17:00' },
      { label: '05:00 PM - 07:00 PM', startTime: '17:00', endTime: '19:00' },
    ];
    for (const slot of defaultSlots) {
      const existing = await prisma.timeSlot.findFirst({ where: { label: slot.label } });
      if (!existing) {
        await prisma.timeSlot.create({ data: slot });
      }
    }
    console.log('Default time slots verification/seeding completed.');
  }
}

verify()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
