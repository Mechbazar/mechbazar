// One-time seed: populates the Vehicle Master hierarchy (Manufacturer -> Model -> Variant,
// FuelType, and a handful of concrete Vehicle rows) with real, well-known makes/models sold
// in India. This data genuinely did not exist anywhere in the database before this script —
// there is no other seed source and no admin "create" endpoint for it (admin's Vehicle Master
// page is mock UI only). Written to unblock testing the customer app's My Garage feature.
import prisma from '../src/config/prisma';

const FUEL_TYPES = ['Petrol', 'Diesel', 'CNG', 'Electric'];

const MANUFACTURERS: Record<string, { models: Record<string, string[]> }> = {
  'Maruti Suzuki': {
    models: {
      'Swift': ['LXI', 'VXI', 'ZXI'],
      'Baleno': ['Sigma', 'Delta', 'Zeta'],
      'Dzire': ['LXI', 'VXI'],
      'Alto': ['STD', 'LXI'],
    },
  },
  'Hyundai': {
    models: {
      'i20': ['Magna', 'Sportz', 'Asta'],
      'Creta': ['E', 'EX', 'SX'],
      'Verna': ['S', 'SX'],
    },
  },
  'Honda': {
    models: {
      'City': ['V', 'VX', 'ZX'],
      'Amaze': ['E', 'S'],
    },
  },
  'Tata Motors': {
    models: {
      'Nexon': ['XE', 'XM', 'XZ'],
      'Punch': ['Pure', 'Adventure'],
    },
  },
  'Hero MotoCorp': {
    models: {
      'Splendor Plus': ['Drum', 'Self Start'],
      'HF Deluxe': ['Kick Start', 'Self Start'],
    },
  },
  'TVS': {
    models: {
      'Jupiter': ['Standard', 'ZX'],
      'Apache RTR 160': ['Single Channel ABS', 'Dual Channel ABS'],
    },
  },
  'Bajaj': {
    models: {
      'Pulsar 150': ['Single Disc', 'Dual Disc'],
      'Platina 110': ['Drum', 'ES'],
    },
  },
};

async function main() {
  const fuelTypeRecords: Record<string, { id: string }> = {};
  for (const name of FUEL_TYPES) {
    fuelTypeRecords[name] = await prisma.fuelType.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  let manufacturerCount = 0;
  let modelCount = 0;
  let variantCount = 0;
  let vehicleCount = 0;

  for (const [manufacturerName, { models }] of Object.entries(MANUFACTURERS)) {
    const manufacturer = await prisma.manufacturer.upsert({
      where: { name: manufacturerName },
      update: {},
      create: { name: manufacturerName },
    });
    manufacturerCount++;

    for (const [modelName, variantNames] of Object.entries(models)) {
      let model = await prisma.model.findFirst({
        where: { manufacturerId: manufacturer.id, name: modelName },
      });
      if (!model) {
        model = await prisma.model.create({
          data: { manufacturerId: manufacturer.id, name: modelName },
        });
        modelCount++;
      }

      const variantRecords: { id: string; name: string }[] = [];
      for (const variantName of variantNames) {
        let variant = await prisma.variant.findFirst({
          where: { modelId: model.id, name: variantName },
        });
        if (!variant) {
          variant = await prisma.variant.create({
            data: { modelId: model.id, name: variantName },
          });
          variantCount++;
        }
        variantRecords.push(variant);
      }

      // Concrete Vehicle rows so /api/vehicles/find can resolve real compatibility matches.
      // Two model years, petrol fuel, first variant only -- enough to make the flow testable
      // without exploding the combinatorial seed size.
      for (const year of [2022, 2023]) {
        const existing = await prisma.vehicle.findFirst({
          where: {
            manufacturerId: manufacturer.id,
            modelId: model.id,
            variantId: variantRecords[0]?.id || null,
            fuelTypeId: fuelTypeRecords['Petrol'].id,
            year,
          },
        });
        if (!existing) {
          await prisma.vehicle.create({
            data: {
              manufacturerId: manufacturer.id,
              modelId: model.id,
              variantId: variantRecords[0]?.id || null,
              fuelTypeId: fuelTypeRecords['Petrol'].id,
              year,
            },
          });
          vehicleCount++;
        }
      }
    }
  }

  console.log('--- Vehicle Master seed summary ---');
  console.log(`Manufacturers: ${manufacturerCount}`);
  console.log(`Models created: ${modelCount}`);
  console.log(`Variants created: ${variantCount}`);
  console.log(`Fuel types: ${FUEL_TYPES.length}`);
  console.log(`Vehicle rows created: ${vehicleCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
