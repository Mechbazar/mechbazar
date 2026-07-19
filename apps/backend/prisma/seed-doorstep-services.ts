import 'dotenv/config';
import { PrismaClient, VehicleType } from '@prisma/client';

const prisma = new PrismaClient();

interface SeedService {
  name: string;
  icon: string;
  description: string;
  price: number;
  discountPrice: number | null;
  estimatedMinutes: number;
  includedServices: string[];
  isPopular: boolean;
  isRecommended: boolean;
  isEmergency: boolean;
  isCategoryEmergency: boolean;
}

const CAR_SERVICES: SeedService[] = [
  { name: 'Car Wash & Foam Wash', icon: '🚗', description: 'Doorstep exterior foam wash with a gentle hand-dry finish.', price: 399, discountPrice: 349, estimatedMinutes: 45, includedServices: ['Foam wash', 'Wheel & tyre cleaning', 'Hand dry'], isPopular: true, isRecommended: false, isEmergency: false, isCategoryEmergency: false },
  { name: 'Interior Deep Cleaning', icon: '🧽', description: 'Vacuuming, dashboard polish and seat cleaning for a fresh cabin.', price: 899, discountPrice: null, estimatedMinutes: 90, includedServices: ['Vacuuming', 'Dashboard & console cleaning', 'Seat shampoo'], isPopular: false, isRecommended: false, isEmergency: false, isCategoryEmergency: false },
  { name: 'Doorstep Car Detailing', icon: '✨', description: 'Premium wash, polish and interior detailing package.', price: 2499, discountPrice: 2199, estimatedMinutes: 180, includedServices: ['Exterior wash & polish', 'Interior detailing', 'Tyre dressing'], isPopular: true, isRecommended: true, isEmergency: false, isCategoryEmergency: false },
  { name: 'AC Service & Gas Top-up', icon: '❄️', description: 'AC performance check with gas top-up for effective cooling.', price: 1499, discountPrice: 1299, estimatedMinutes: 60, includedServices: ['AC performance check', 'Gas top-up', 'Vent cleaning'], isPopular: true, isRecommended: true, isEmergency: false, isCategoryEmergency: false },
  { name: 'AC Gas Refilling', icon: '🧊', description: 'Complete AC gas refill for cars with weak or no cooling.', price: 2199, discountPrice: null, estimatedMinutes: 45, includedServices: ['Gas refill', 'Leak check'], isPopular: false, isRecommended: false, isEmergency: false, isCategoryEmergency: false },
  { name: 'Engine Oil Change', icon: '🛢️', description: 'Full synthetic/mineral oil change with filter check at your doorstep.', price: 799, discountPrice: 699, estimatedMinutes: 30, includedServices: ['Engine oil replacement', 'Oil filter check', 'Engine flush inspection'], isPopular: true, isRecommended: true, isEmergency: false, isCategoryEmergency: false },
  { name: 'Oil Filter Replacement', icon: '🔧', description: 'Oil filter replacement to keep your engine oil clean.', price: 349, discountPrice: null, estimatedMinutes: 20, includedServices: ['Oil filter replacement'], isPopular: false, isRecommended: false, isEmergency: false, isCategoryEmergency: false },
  { name: 'Battery Replacement', icon: '🔋', description: 'Doorstep battery testing and replacement with a new unit.', price: 4999, discountPrice: 4599, estimatedMinutes: 30, includedServices: ['Battery health check', 'Old battery disposal', 'New battery fitment'], isPopular: true, isRecommended: false, isEmergency: true, isCategoryEmergency: false },
  { name: 'Battery Jump Start', icon: '⚡', description: 'Emergency jump-start service for a dead battery.', price: 299, discountPrice: null, estimatedMinutes: 20, includedServices: ['Jump start', 'Battery health check'], isPopular: false, isRecommended: false, isEmergency: true, isCategoryEmergency: false },
  { name: 'Brake Pad Replacement (Front)', icon: '🛑', description: 'Front brake pad replacement for safer, smoother braking.', price: 1899, discountPrice: 1699, estimatedMinutes: 60, includedServices: ['Front brake pad replacement', 'Brake inspection'], isPopular: true, isRecommended: false, isEmergency: false, isCategoryEmergency: false },
  { name: 'Brake Pad Replacement (Rear)', icon: '🛑', description: 'Rear brake pad replacement for safer, smoother braking.', price: 1699, discountPrice: null, estimatedMinutes: 60, includedServices: ['Rear brake pad replacement', 'Brake inspection'], isPopular: false, isRecommended: false, isEmergency: false, isCategoryEmergency: false },
  { name: 'Brake Fluid Change', icon: '🧴', description: 'Complete brake fluid flush and replacement.', price: 599, discountPrice: null, estimatedMinutes: 30, includedServices: ['Brake fluid flush & top-up'], isPopular: false, isRecommended: false, isEmergency: false, isCategoryEmergency: false },
  { name: 'Tyre Replacement', icon: '🛞', description: 'New tyre fitment with balancing at your doorstep.', price: 3499, discountPrice: 3199, estimatedMinutes: 40, includedServices: ['Tyre fitment', 'Wheel balancing'], isPopular: false, isRecommended: true, isEmergency: false, isCategoryEmergency: false },
  { name: 'Wheel Alignment & Balancing', icon: '⚙️', description: 'Precision wheel alignment and balancing for a smoother ride.', price: 899, discountPrice: 799, estimatedMinutes: 45, includedServices: ['4-wheel alignment', 'Wheel balancing'], isPopular: true, isRecommended: true, isEmergency: false, isCategoryEmergency: false },
  { name: 'Tyre Puncture Repair', icon: '🔩', description: 'Quick puncture repair to get you back on the road.', price: 199, discountPrice: null, estimatedMinutes: 20, includedServices: ['Puncture repair', 'Air top-up'], isPopular: false, isRecommended: false, isEmergency: true, isCategoryEmergency: false },
  { name: 'Flat Tyre Roadside Assistance', icon: '🚧', description: 'On-the-spot flat tyre change assistance.', price: 349, discountPrice: null, estimatedMinutes: 30, includedServices: ['Spare tyre fitment', 'Roadside assistance'], isPopular: false, isRecommended: false, isEmergency: true, isCategoryEmergency: false },
  { name: 'Car Denting & Painting (Single Panel)', icon: '🎨', description: 'Denting and painting for a single body panel.', price: 3999, discountPrice: 3499, estimatedMinutes: 240, includedServices: ['Dent removal', 'Panel painting', 'Polishing'], isPopular: false, isRecommended: false, isEmergency: false, isCategoryEmergency: false },
  { name: 'Full Car Service (Basic)', icon: '🧰', description: 'Essential multi-point car service package.', price: 1999, discountPrice: 1799, estimatedMinutes: 120, includedServices: ['Oil change', 'Filter check', 'General inspection'], isPopular: true, isRecommended: true, isEmergency: false, isCategoryEmergency: false },
  { name: 'Full Car Service (Comprehensive)', icon: '🧰', description: 'Complete multi-point service covering engine, brakes and more.', price: 4499, discountPrice: 3999, estimatedMinutes: 180, includedServices: ['Oil & filter change', 'Brake check', 'AC check', 'Battery check'], isPopular: true, isRecommended: false, isEmergency: false, isCategoryEmergency: false },
  { name: 'Wiper Blade Replacement', icon: '🌧️', description: 'New wiper blades fitted for clear visibility in rain.', price: 349, discountPrice: null, estimatedMinutes: 15, includedServices: ['Wiper blade replacement'], isPopular: false, isRecommended: false, isEmergency: false, isCategoryEmergency: false },
  { name: 'Headlight/Bulb Replacement', icon: '💡', description: 'Headlight or indicator bulb replacement.', price: 299, discountPrice: null, estimatedMinutes: 20, includedServices: ['Bulb replacement', 'Alignment check'], isPopular: false, isRecommended: false, isEmergency: false, isCategoryEmergency: false },
  { name: 'Car AC Filter Replacement', icon: '🌬️', description: 'Cabin AC filter replacement for cleaner airflow.', price: 449, discountPrice: null, estimatedMinutes: 20, includedServices: ['AC filter replacement'], isPopular: false, isRecommended: false, isEmergency: false, isCategoryEmergency: false },
  { name: 'Clutch Plate Replacement', icon: '⚙️', description: 'Clutch plate replacement for smoother gear shifts.', price: 4999, discountPrice: null, estimatedMinutes: 150, includedServices: ['Clutch plate replacement', 'Clutch adjustment'], isPopular: false, isRecommended: false, isEmergency: false, isCategoryEmergency: false },
  { name: 'Radiator Coolant Top-up/Flush', icon: '🌡️', description: 'Coolant top-up or full radiator flush to prevent overheating.', price: 699, discountPrice: 599, estimatedMinutes: 30, includedServices: ['Coolant top-up/flush', 'Radiator inspection'], isPopular: false, isRecommended: false, isEmergency: false, isCategoryEmergency: false },
  { name: 'Emergency Breakdown Assistance', icon: '🚨', description: 'Round-the-clock roadside breakdown assistance.', price: 499, discountPrice: null, estimatedMinutes: 45, includedServices: ['On-site diagnosis', 'Basic repair or tow arrangement'], isPopular: true, isRecommended: false, isEmergency: true, isCategoryEmergency: true },
];

const BIKE_SERVICES: SeedService[] = [
  { name: 'Bike Wash', icon: '🏍️', description: 'Doorstep foam wash and dry for your bike.', price: 149, discountPrice: 129, estimatedMinutes: 20, includedServices: ['Foam wash', 'Hand dry'], isPopular: true, isRecommended: false, isEmergency: false, isCategoryEmergency: false },
  { name: 'Chain Lubrication & Adjustment', icon: '⛓️', description: 'Chain cleaning, lubrication and tension adjustment.', price: 199, discountPrice: null, estimatedMinutes: 20, includedServices: ['Chain cleaning', 'Lubrication', 'Tension adjustment'], isPopular: true, isRecommended: false, isEmergency: false, isCategoryEmergency: false },
  { name: 'Full Bike Service (Basic)', icon: '🧰', description: 'Essential multi-point bike service package.', price: 599, discountPrice: 499, estimatedMinutes: 60, includedServices: ['Oil change', 'Chain check', 'General inspection'], isPopular: true, isRecommended: true, isEmergency: false, isCategoryEmergency: false },
  { name: 'Full Bike Service (Comprehensive)', icon: '🧰', description: 'Complete multi-point service covering engine, brakes and more.', price: 1299, discountPrice: 1099, estimatedMinutes: 90, includedServices: ['Oil & filter change', 'Brake check', 'Chain & sprocket check'], isPopular: true, isRecommended: true, isEmergency: false, isCategoryEmergency: false },
  { name: 'Engine Oil Change', icon: '🛢️', description: 'Full synthetic/mineral engine oil change at your doorstep.', price: 349, discountPrice: 299, estimatedMinutes: 20, includedServices: ['Engine oil replacement', 'Oil filter check'], isPopular: true, isRecommended: true, isEmergency: false, isCategoryEmergency: false },
  { name: 'Spark Plug Replacement', icon: '🔥', description: 'New spark plug fitted for smoother starts and better mileage.', price: 249, discountPrice: null, estimatedMinutes: 15, includedServices: ['Spark plug replacement'], isPopular: false, isRecommended: false, isEmergency: false, isCategoryEmergency: false },
  { name: 'Puncture Repair', icon: '🔩', description: 'Quick tyre puncture repair to get you moving again.', price: 99, discountPrice: null, estimatedMinutes: 15, includedServices: ['Puncture repair', 'Air top-up'], isPopular: false, isRecommended: false, isEmergency: true, isCategoryEmergency: false },
  { name: 'Tyre Replacement', icon: '🛞', description: 'New tyre fitment for your bike.', price: 1499, discountPrice: 1349, estimatedMinutes: 30, includedServices: ['Tyre fitment', 'Wheel check'], isPopular: false, isRecommended: true, isEmergency: false, isCategoryEmergency: false },
  { name: 'Brake Pad Replacement', icon: '🛑', description: 'Brake pad replacement for safer, sharper braking.', price: 499, discountPrice: 449, estimatedMinutes: 30, includedServices: ['Brake pad replacement', 'Brake inspection'], isPopular: true, isRecommended: false, isEmergency: false, isCategoryEmergency: false },
  { name: 'Battery Replacement', icon: '🔋', description: 'Doorstep battery testing and replacement with a new unit.', price: 1999, discountPrice: 1799, estimatedMinutes: 20, includedServices: ['Battery health check', 'New battery fitment'], isPopular: false, isRecommended: false, isEmergency: true, isCategoryEmergency: false },
  { name: 'Battery Jump Start', icon: '⚡', description: 'Emergency jump-start service for a dead battery.', price: 149, discountPrice: null, estimatedMinutes: 15, includedServices: ['Jump start', 'Battery health check'], isPopular: false, isRecommended: false, isEmergency: true, isCategoryEmergency: false },
  { name: 'Wheel Alignment/Truing', icon: '⚙️', description: 'Wheel truing and alignment for a smoother, safer ride.', price: 299, discountPrice: null, estimatedMinutes: 30, includedServices: ['Wheel truing', 'Spoke tension check'], isPopular: false, isRecommended: false, isEmergency: false, isCategoryEmergency: false },
  { name: 'Carburetor/Fuel Injector Cleaning', icon: '🧪', description: 'Cleaning for better fuel efficiency and smoother idling.', price: 449, discountPrice: 399, estimatedMinutes: 30, includedServices: ['Carburetor/injector cleaning', 'Idle tuning'], isPopular: false, isRecommended: false, isEmergency: false, isCategoryEmergency: false },
  { name: 'Clutch Cable Replacement', icon: '⚙️', description: 'Clutch cable replacement for smoother gear shifts.', price: 299, discountPrice: null, estimatedMinutes: 20, includedServices: ['Clutch cable replacement', 'Adjustment'], isPopular: false, isRecommended: false, isEmergency: false, isCategoryEmergency: false },
  { name: 'Headlight/Bulb Replacement', icon: '💡', description: 'Headlight or indicator bulb replacement.', price: 199, discountPrice: null, estimatedMinutes: 15, includedServices: ['Bulb replacement'], isPopular: false, isRecommended: false, isEmergency: false, isCategoryEmergency: false },
  { name: 'Doorstep Bike Detailing', icon: '✨', description: 'Premium wash and polish package for your bike.', price: 799, discountPrice: 699, estimatedMinutes: 60, includedServices: ['Foam wash', 'Polish', 'Chrome cleaning'], isPopular: false, isRecommended: false, isEmergency: false, isCategoryEmergency: false },
  { name: 'Emergency Breakdown Assistance', icon: '🚨', description: 'Round-the-clock roadside breakdown assistance.', price: 349, discountPrice: null, estimatedMinutes: 30, includedServices: ['On-site diagnosis', 'Basic repair or tow arrangement'], isPopular: true, isRecommended: false, isEmergency: true, isCategoryEmergency: true },
];

async function seedVehicle(services: SeedService[], vehicleType: VehicleType) {
  for (let i = 0; i < services.length; i++) {
    const s = services[i];

    const existingCategory = await prisma.serviceCategory.findFirst({ where: { name: s.name, vehicleType } });
    const category = existingCategory
      ? await prisma.serviceCategory.update({
          where: { id: existingCategory.id },
          data: { icon: s.icon, description: s.description, isEmergency: s.isCategoryEmergency, sortOrder: i, status: 'Active' },
        })
      : await prisma.serviceCategory.create({
          data: { name: s.name, icon: s.icon, description: s.description, vehicleType, isEmergency: s.isCategoryEmergency, sortOrder: i, status: 'Active' },
        });

    const packageName = `${s.name} - Standard`;
    const existingPackage = await prisma.servicePackage.findFirst({ where: { categoryId: category.id, name: packageName } });
    const packageData = {
      categoryId: category.id,
      name: packageName,
      description: s.description,
      price: s.price,
      discountPrice: s.discountPrice,
      estimatedMinutes: s.estimatedMinutes,
      includedServices: s.includedServices,
      isActive: true,
      isPopular: s.isPopular,
      isRecommended: s.isRecommended,
      isEmergency: s.isEmergency,
    };

    if (existingPackage) {
      await prisma.servicePackage.update({ where: { id: existingPackage.id }, data: packageData });
    } else {
      await prisma.servicePackage.create({ data: packageData });
    }
  }
}

async function seedTimeSlots() {
  const slots = [
    { label: '09:00 AM - 12:00 PM', startTime: '09:00', endTime: '12:00', sortOrder: 1 },
    { label: '12:00 PM - 03:00 PM', startTime: '12:00', endTime: '15:00', sortOrder: 2 },
    { label: '03:00 PM - 06:00 PM', startTime: '15:00', endTime: '18:00', sortOrder: 3 },
    { label: '06:00 PM - 09:00 PM', startTime: '18:00', endTime: '21:00', sortOrder: 4 },
  ];

  for (const s of slots) {
    const existing = await prisma.timeSlot.findFirst({ where: { label: s.label } });
    if (!existing) {
      await prisma.timeSlot.create({
        data: {
          label: s.label,
          startTime: s.startTime,
          endTime: s.endTime,
          sortOrder: s.sortOrder,
          maxBookingsPerSlot: 20,
          isActive: true,
        },
      });
    }
  }
  console.log('Seeded time slots.');
}

async function main() {
  await seedVehicle(CAR_SERVICES, VehicleType.CAR);
  await seedVehicle(BIKE_SERVICES, VehicleType.BIKE);
  await seedTimeSlots();
  console.log(`Seeded ${CAR_SERVICES.length} car services and ${BIKE_SERVICES.length} bike services.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
