// Production seed: populates the Vehicle Master hierarchy (Manufacturer -> Model -> Variant,
// FuelType, and concrete Vehicle rows) with the real makes/models sold in India that the
// customer app's Add to Garage screen browses. Manufacturers carry a CAR/BIKE type so the
// screen's Cars/Bikes toggle filters server-side. Idempotent: safe to re-run against a DB
// that already holds part or all of this catalog (upserts + skipDuplicates throughout).
// Run: npx tsx prisma/seed-vehicle-master.ts   (set DATABASE_URL/DIRECT_URL for prod)
import prisma from '../src/config/prisma';

const FUEL_TYPES = ['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid'];

type ModelSpec = {
  variants: string[];
  engineCc?: number;
  fuels?: string[]; // defaults to ['Petrol']
};

type BrandSpec = {
  type: 'CAR' | 'BIKE';
  // Brand name defaults to the CATALOG key; set this when the same name exists
  // for both CAR and BIKE (object keys must be unique, DB rows need not be).
  name?: string;
  models: Record<string, ModelSpec>;
};

const CATALOG: Record<string, BrandSpec> = {
  // ============ CARS ============
  'Maruti Suzuki': {
    type: 'CAR',
    models: {
      'Alto K10': { variants: ['STD', 'LXI', 'VXI', 'VXI+'], engineCc: 998, fuels: ['Petrol', 'CNG'] },
      'Swift': { variants: ['LXI', 'VXI', 'ZXI', 'ZXI+'], engineCc: 1197, fuels: ['Petrol', 'CNG'] },
      'Baleno': { variants: ['Sigma', 'Delta', 'Zeta', 'Alpha'], engineCc: 1197, fuels: ['Petrol', 'CNG'] },
      'Dzire': { variants: ['LXI', 'VXI', 'ZXI', 'ZXI+'], engineCc: 1197, fuels: ['Petrol', 'CNG'] },
      'Wagon R': { variants: ['LXI', 'VXI', 'ZXI', 'ZXI+'], engineCc: 1197, fuels: ['Petrol', 'CNG'] },
      'Celerio': { variants: ['LXI', 'VXI', 'ZXI', 'ZXI+'], engineCc: 998, fuels: ['Petrol', 'CNG'] },
      'Brezza': { variants: ['LXI', 'VXI', 'ZXI', 'ZXI+'], engineCc: 1462, fuels: ['Petrol', 'CNG'] },
      'Fronx': { variants: ['Sigma', 'Delta', 'Zeta', 'Alpha'], engineCc: 1197, fuels: ['Petrol', 'CNG'] },
      'Ertiga': { variants: ['LXI', 'VXI', 'ZXI', 'ZXI+'], engineCc: 1462, fuels: ['Petrol', 'CNG'] },
      'Grand Vitara': { variants: ['Sigma', 'Delta', 'Zeta', 'Alpha'], engineCc: 1462, fuels: ['Petrol', 'Hybrid'] },
    },
  },
  'Hyundai': {
    type: 'CAR',
    models: {
      'Grand i10 Nios': { variants: ['Era', 'Magna', 'Sportz', 'Asta'], engineCc: 1197, fuels: ['Petrol', 'CNG'] },
      'i20': { variants: ['Era', 'Magna', 'Sportz', 'Asta'], engineCc: 1197 },
      'Aura': { variants: ['E', 'S', 'SX'], engineCc: 1197, fuels: ['Petrol', 'CNG'] },
      'Exter': { variants: ['EX', 'S', 'SX', 'SX(O)'], engineCc: 1197, fuels: ['Petrol', 'CNG'] },
      'Venue': { variants: ['E', 'S', 'SX', 'SX(O)'], engineCc: 1197, fuels: ['Petrol', 'Diesel'] },
      'Creta': { variants: ['E', 'EX', 'S', 'SX', 'SX(O)'], engineCc: 1497, fuels: ['Petrol', 'Diesel'] },
      'Verna': { variants: ['EX', 'S', 'SX', 'SX(O)'], engineCc: 1497 },
      'Alcazar': { variants: ['Prestige', 'Platinum', 'Signature'], engineCc: 1482, fuels: ['Petrol', 'Diesel'] },
      'Tucson': { variants: ['Platinum', 'Signature'], engineCc: 1999, fuels: ['Petrol', 'Diesel'] },
    },
  },
  'Tata': {
    type: 'CAR',
    models: {
      'Tiago': { variants: ['XE', 'XM', 'XT', 'XZ+'], engineCc: 1199, fuels: ['Petrol', 'CNG'] },
      'Tigor': { variants: ['XE', 'XM', 'XZ', 'XZ+'], engineCc: 1199, fuels: ['Petrol', 'CNG'] },
      'Altroz': { variants: ['XE', 'XM', 'XT', 'XZ'], engineCc: 1199, fuels: ['Petrol', 'Diesel', 'CNG'] },
      'Punch': { variants: ['Pure', 'Adventure', 'Accomplished', 'Creative'], engineCc: 1199, fuels: ['Petrol', 'CNG'] },
      'Nexon': { variants: ['Smart', 'Pure', 'Creative', 'Fearless'], engineCc: 1199, fuels: ['Petrol', 'Diesel'] },
      'Nexon EV': { variants: ['Creative', 'Fearless', 'Empowered'], fuels: ['Electric'] },
      'Curvv': { variants: ['Smart', 'Pure', 'Creative', 'Accomplished'], engineCc: 1199, fuels: ['Petrol', 'Diesel'] },
      'Harrier': { variants: ['Smart', 'Pure', 'Adventure', 'Fearless'], engineCc: 1956, fuels: ['Diesel'] },
      'Safari': { variants: ['Smart', 'Pure', 'Adventure', 'Accomplished'], engineCc: 1956, fuels: ['Diesel'] },
    },
  },
  'Mahindra': {
    type: 'CAR',
    models: {
      'Bolero': { variants: ['B4', 'B6', 'B6(O)'], engineCc: 1493, fuels: ['Diesel'] },
      'Bolero Neo': { variants: ['N4', 'N8', 'N10'], engineCc: 1493, fuels: ['Diesel'] },
      'Thar': { variants: ['AX(O)', 'LX'], engineCc: 1997, fuels: ['Petrol', 'Diesel'] },
      'XUV 3XO': { variants: ['MX1', 'MX2', 'MX3', 'AX5', 'AX7'], engineCc: 1197, fuels: ['Petrol', 'Diesel'] },
      'Scorpio Classic': { variants: ['S', 'S11'], engineCc: 2184, fuels: ['Diesel'] },
      'Scorpio-N': { variants: ['Z2', 'Z4', 'Z6', 'Z8', 'Z8L'], engineCc: 1997, fuels: ['Petrol', 'Diesel'] },
      'XUV700': { variants: ['MX', 'AX3', 'AX5', 'AX7', 'AX7L'], engineCc: 1997, fuels: ['Petrol', 'Diesel'] },
    },
  },
  'Honda': {
    type: 'CAR',
    models: {
      'Amaze': { variants: ['E', 'S', 'VX', 'ZX'], engineCc: 1199 },
      'City': { variants: ['SV', 'V', 'VX', 'ZX'], engineCc: 1498, fuels: ['Petrol', 'Hybrid'] },
      'Elevate': { variants: ['SV', 'V', 'VX', 'ZX'], engineCc: 1498 },
    },
  },
  'Toyota': {
    type: 'CAR',
    models: {
      'Glanza': { variants: ['E', 'S', 'G', 'V'], engineCc: 1197, fuels: ['Petrol', 'CNG'] },
      'Urban Cruiser Hyryder': { variants: ['E', 'S', 'G', 'V'], engineCc: 1462, fuels: ['Petrol', 'Hybrid', 'CNG'] },
      'Innova Crysta': { variants: ['GX', 'VX', 'ZX'], engineCc: 2393, fuels: ['Diesel'] },
      'Innova Hycross': { variants: ['GX', 'VX', 'ZX', 'ZX(O)'], engineCc: 1987, fuels: ['Petrol', 'Hybrid'] },
      'Fortuner': { variants: ['4x2', '4x4', 'Legender'], engineCc: 2694, fuels: ['Petrol', 'Diesel'] },
      'Camry': { variants: ['Elegance'], engineCc: 2487, fuels: ['Hybrid'] },
    },
  },
  'Kia': {
    type: 'CAR',
    models: {
      'Sonet': { variants: ['HTE', 'HTK', 'HTK+', 'HTX', 'GTX+'], engineCc: 1197, fuels: ['Petrol', 'Diesel'] },
      'Seltos': { variants: ['HTE', 'HTK', 'HTX', 'GTX+', 'X-Line'], engineCc: 1497, fuels: ['Petrol', 'Diesel'] },
      'Carens': { variants: ['Premium', 'Prestige', 'Luxury', 'Luxury Plus'], engineCc: 1497, fuels: ['Petrol', 'Diesel'] },
      'Carnival': { variants: ['Premium', 'Prestige', 'Limousine'], engineCc: 2199, fuels: ['Diesel'] },
      'EV6': { variants: ['GT Line', 'GT Line AWD'], fuels: ['Electric'] },
    },
  },
  'MG': {
    type: 'CAR',
    models: {
      'Comet EV': { variants: ['Executive', 'Excite', 'Exclusive'], fuels: ['Electric'] },
      'Astor': { variants: ['Sprint', 'Shine', 'Select', 'Sharp Pro'], engineCc: 1349 },
      'Hector': { variants: ['Style', 'Shine', 'Smart Pro', 'Savvy Pro'], engineCc: 1451, fuels: ['Petrol', 'Diesel'] },
      'ZS EV': { variants: ['Executive', 'Excite Pro', 'Exclusive Plus'], fuels: ['Electric'] },
      'Gloster': { variants: ['Sharp', 'Savvy'], engineCc: 1996, fuels: ['Diesel'] },
    },
  },
  'Skoda': {
    type: 'CAR',
    models: {
      'Kushaq': { variants: ['Classic', 'Signature', 'Style', 'Monte Carlo'], engineCc: 999 },
      'Slavia': { variants: ['Classic', 'Signature', 'Style', 'Monte Carlo'], engineCc: 999 },
      'Kodiaq': { variants: ['Selection', 'Sportline', 'L&K'], engineCc: 1984 },
      'Superb': { variants: ['L&K'], engineCc: 1984 },
    },
  },
  'Volkswagen': {
    type: 'CAR',
    models: {
      'Virtus': { variants: ['Comfortline', 'Highline', 'Topline', 'GT Plus'], engineCc: 999 },
      'Taigun': { variants: ['Comfortline', 'Highline', 'Topline', 'GT Plus'], engineCc: 999 },
      'Tiguan': { variants: ['Elegance', 'R-Line'], engineCc: 1984 },
    },
  },
  'Nissan': {
    type: 'CAR',
    models: {
      'Magnite': { variants: ['XE', 'XL', 'XV', 'XV Premium'], engineCc: 999 },
    },
  },
  'Renault': {
    type: 'CAR',
    models: {
      'Kwid': { variants: ['RXE', 'RXL', 'RXT', 'Climber'], engineCc: 999 },
      'Triber': { variants: ['RXE', 'RXL', 'RXT', 'RXZ'], engineCc: 999 },
      'Kiger': { variants: ['RXE', 'RXL', 'RXT', 'RXZ'], engineCc: 999 },
    },
  },
  'BMW': {
    type: 'CAR',
    models: {
      '2 Series Gran Coupe': { variants: ['218i M Sport'], engineCc: 1499 },
      '3 Series': { variants: ['330i M Sport', '330Li M Sport'], engineCc: 1998, fuels: ['Petrol', 'Diesel'] },
      '5 Series': { variants: ['530Li M Sport'], engineCc: 1998 },
      '7 Series': { variants: ['740i M Sport'], engineCc: 2998 },
      'X1': { variants: ['sDrive18i xLine', 'sDrive18d M Sport'], engineCc: 1499, fuels: ['Petrol', 'Diesel'] },
      'X3': { variants: ['xDrive20 xLine', 'M Sport'], engineCc: 1998 },
      'X5': { variants: ['xDrive40i xLine', 'xDrive30d M Sport'], engineCc: 2998, fuels: ['Petrol', 'Diesel'] },
    },
  },
  'Mercedes-Benz': {
    type: 'CAR',
    models: {
      'A-Class Limousine': { variants: ['A 200', 'A 200d'], engineCc: 1332, fuels: ['Petrol', 'Diesel'] },
      'C-Class': { variants: ['C 200', 'C 220d', 'C 300d AMG Line'], engineCc: 1496, fuels: ['Petrol', 'Diesel'] },
      'E-Class': { variants: ['E 200', 'E 220d', 'E 450'], engineCc: 1999, fuels: ['Petrol', 'Diesel'] },
      'S-Class': { variants: ['S 350d', 'S 450'], engineCc: 2999, fuels: ['Petrol', 'Diesel'] },
      'GLA': { variants: ['GLA 200', 'GLA 220d'], engineCc: 1332, fuels: ['Petrol', 'Diesel'] },
      'GLC': { variants: ['GLC 300', 'GLC 220d'], engineCc: 1999, fuels: ['Petrol', 'Diesel'] },
      'GLE': { variants: ['GLE 300d', 'GLE 450'], engineCc: 2999, fuels: ['Petrol', 'Diesel'] },
    },
  },
  'Audi': {
    type: 'CAR',
    models: {
      'A4': { variants: ['Premium', 'Premium Plus', 'Technology'], engineCc: 1984 },
      'A6': { variants: ['Premium Plus', 'Technology'], engineCc: 1984 },
      'Q3': { variants: ['Premium Plus', 'Technology'], engineCc: 1984 },
      'Q5': { variants: ['Premium Plus', 'Technology'], engineCc: 1984 },
      'Q7': { variants: ['Premium Plus', 'Technology'], engineCc: 2995 },
    },
  },
  'Jeep': {
    type: 'CAR',
    models: {
      'Compass': { variants: ['Sport', 'Longitude', 'Limited', 'Model S'], engineCc: 1956, fuels: ['Diesel'] },
      'Meridian': { variants: ['Longitude', 'Limited', 'Overland'], engineCc: 1956, fuels: ['Diesel'] },
      'Wrangler': { variants: ['Unlimited', 'Rubicon'], engineCc: 1998 },
    },
  },
  'Volvo': {
    type: 'CAR',
    models: {
      'XC40 Recharge': { variants: ['Plus', 'Ultimate'], fuels: ['Electric'] },
      'XC60': { variants: ['B5 Plus'], engineCc: 1969, fuels: ['Petrol', 'Hybrid'] },
      'XC90': { variants: ['B6 Plus', 'B6 Ultimate'], engineCc: 1969, fuels: ['Petrol', 'Hybrid'] },
      'S90': { variants: ['B5 Plus'], engineCc: 1969 },
    },
  },
  'Lexus': {
    type: 'CAR',
    models: {
      'ES': { variants: ['300h Exquisite', '300h Luxury'], engineCc: 2487, fuels: ['Hybrid'] },
      'NX': { variants: ['350h Exquisite', '350h Overtrail'], engineCc: 2487, fuels: ['Hybrid'] },
      'RX': { variants: ['350h Luxury', '500h F Sport'], engineCc: 2487, fuels: ['Hybrid'] },
    },
  },

  // ============ BIKES ============
  'Hero': {
    type: 'BIKE',
    models: {
      'HF Deluxe': { variants: ['Kick Drum', 'Self Drum', 'Self Drum Cast'], engineCc: 97 },
      'Splendor Plus': { variants: ['Drum', 'Self Cast', 'Xtec'], engineCc: 97 },
      'Passion Plus': { variants: ['Drum', 'Xtec'], engineCc: 113 },
      'Glamour': { variants: ['Drum', 'Disc', 'Xtec'], engineCc: 124 },
      'Super Splendor': { variants: ['Drum', 'Disc', 'Xtec'], engineCc: 124 },
      'Xtreme 160R': { variants: ['Single Disc', 'Double Disc', '4V'], engineCc: 163 },
      'Xpulse 200': { variants: ['4V', '4V Pro'], engineCc: 199 },
      'Destini 125': { variants: ['LX', 'VX', 'ZX'], engineCc: 124 },
      'Pleasure Plus': { variants: ['Drum', 'Disc', 'Xtec'], engineCc: 110 },
    },
  },
  'Honda (Bikes)': {
    type: 'BIKE',
    name: 'Honda',
    models: {
      'Activa 6G': { variants: ['STD', 'DLX', 'Smart'], engineCc: 109 },
      'Activa 125': { variants: ['Drum', 'Disc', 'Smart'], engineCc: 124 },
      'Dio': { variants: ['STD', 'DLX', 'Smart'], engineCc: 109 },
      'Shine': { variants: ['Drum', 'Disc'], engineCc: 124 },
      'SP 125': { variants: ['Drum', 'Disc'], engineCc: 124 },
      'Unicorn': { variants: ['STD'], engineCc: 162 },
      'Hornet 2.0': { variants: ['STD'], engineCc: 184 },
      'CB350': { variants: ['DLX', 'DLX Pro'], engineCc: 348 },
    },
  },
  'TVS': {
    type: 'BIKE',
    models: {
      'XL100': { variants: ['Heavy Duty', 'Comfort', 'i-Touchstart'], engineCc: 99 },
      'Jupiter': { variants: ['Drum', 'Disc', 'SmartXonnect'], engineCc: 109 },
      'Jupiter 125': { variants: ['Drum', 'Disc', 'SmartXonnect'], engineCc: 124 },
      'Ntorq 125': { variants: ['Drum', 'Disc', 'Race XP'], engineCc: 124 },
      'Raider 125': { variants: ['Drum', 'Disc', 'SmartXonnect'], engineCc: 124 },
      'Apache RTR 160': { variants: ['2V', '4V', '4V Special Edition'], engineCc: 159 },
      'Apache RTR 200 4V': { variants: ['Single Channel ABS', 'Dual Channel ABS'], engineCc: 197 },
      'Apache RR 310': { variants: ['STD', 'BTO'], engineCc: 312 },
      'iQube': { variants: ['STD', 'S', 'ST'], fuels: ['Electric'] },
    },
  },
  'Bajaj': {
    type: 'BIKE',
    models: {
      'Platina 110': { variants: ['Drum', 'ES', 'ABS'], engineCc: 115 },
      'CT 110X': { variants: ['STD'], engineCc: 115 },
      'Pulsar 125': { variants: ['Neon', 'Split Seat'], engineCc: 124 },
      'Pulsar 150': { variants: ['Single Disc', 'Twin Disc'], engineCc: 149 },
      'Pulsar N160': { variants: ['Single Channel ABS', 'Dual Channel ABS'], engineCc: 164 },
      'Pulsar NS200': { variants: ['STD'], engineCc: 199 },
      'Avenger Street 160': { variants: ['STD'], engineCc: 160 },
      'Dominar 400': { variants: ['STD'], engineCc: 373 },
      'Chetak': { variants: ['Urbane', 'Premium'], fuels: ['Electric'] },
    },
  },
  'Royal Enfield': {
    type: 'BIKE',
    models: {
      'Hunter 350': { variants: ['Retro', 'Metro', 'Metro Rebel'], engineCc: 349 },
      'Bullet 350': { variants: ['Military', 'Standard', 'Black Gold'], engineCc: 349 },
      'Classic 350': { variants: ['Redditch', 'Halcyon', 'Signals', 'Dark', 'Chrome'], engineCc: 349 },
      'Meteor 350': { variants: ['Fireball', 'Stellar', 'Supernova'], engineCc: 349 },
      'Himalayan 450': { variants: ['Base', 'Pass', 'Summit'], engineCc: 452 },
      'Scram 411': { variants: ['Graphite', 'White Flame'], engineCc: 411 },
      'Interceptor 650': { variants: ['Standard', 'Custom', 'Chrome'], engineCc: 648 },
      'Continental GT 650': { variants: ['Standard', 'Chrome'], engineCc: 648 },
    },
  },
  'Yamaha': {
    type: 'BIKE',
    models: {
      'RayZR 125': { variants: ['Drum', 'Disc', 'Street Rally'], engineCc: 125 },
      'Fascino 125': { variants: ['Drum', 'Disc', 'S'], engineCc: 125 },
      'FZ-S FI': { variants: ['V3', 'V4', 'DLX'], engineCc: 149 },
      'MT-15': { variants: ['V2', 'V2 DLX'], engineCc: 155 },
      'R15': { variants: ['V4', 'M'], engineCc: 155 },
      'Aerox 155': { variants: ['STD', 'S'], engineCc: 155 },
    },
  },
  'KTM': {
    type: 'BIKE',
    models: {
      'Duke 200': { variants: ['STD'], engineCc: 199 },
      'Duke 250': { variants: ['STD'], engineCc: 249 },
      'Duke 390': { variants: ['STD'], engineCc: 399 },
      'RC 200': { variants: ['STD'], engineCc: 199 },
      'RC 390': { variants: ['STD'], engineCc: 373 },
      '390 Adventure': { variants: ['STD', 'X'], engineCc: 373 },
    },
  },
  'Suzuki': {
    type: 'BIKE',
    models: {
      'Access 125': { variants: ['Drum', 'Disc', 'Ride Connect'], engineCc: 124 },
      'Burgman Street': { variants: ['STD', 'EX'], engineCc: 124 },
      'Avenis': { variants: ['STD', 'Ride Connect'], engineCc: 124 },
      'Gixxer': { variants: ['STD', 'SF'], engineCc: 155 },
      'Gixxer 250': { variants: ['STD', 'SF 250'], engineCc: 249 },
      'V-Strom SX': { variants: ['STD'], engineCc: 249 },
    },
  },
  'Kawasaki': {
    type: 'BIKE',
    models: {
      'Ninja 300': { variants: ['STD'], engineCc: 296 },
      'Ninja 500': { variants: ['STD'], engineCc: 451 },
      'Z650': { variants: ['STD'], engineCc: 649 },
      'Versys 650': { variants: ['STD'], engineCc: 649 },
      'Ninja ZX-6R': { variants: ['STD'], engineCc: 636 },
      'Ninja ZX-10R': { variants: ['STD'], engineCc: 998 },
    },
  },
  'Ducati': {
    type: 'BIKE',
    models: {
      'Scrambler Icon': { variants: ['STD'], engineCc: 803 },
      'Monster': { variants: ['STD', 'Plus'], engineCc: 937 },
      'Panigale V2': { variants: ['STD'], engineCc: 955 },
      'Multistrada V4': { variants: ['STD', 'S'], engineCc: 1158 },
      'Diavel V4': { variants: ['STD'], engineCc: 1158 },
    },
  },
  'Triumph': {
    type: 'BIKE',
    models: {
      'Speed 400': { variants: ['STD'], engineCc: 398 },
      'Scrambler 400 X': { variants: ['STD'], engineCc: 398 },
      'Trident 660': { variants: ['STD'], engineCc: 660 },
      'Street Triple': { variants: ['R', 'RS'], engineCc: 765 },
      'Tiger 900': { variants: ['GT', 'Rally Pro'], engineCc: 888 },
    },
  },
  'Harley-Davidson': {
    type: 'BIKE',
    models: {
      'X440': { variants: ['Denim', 'Vivid', 'S'], engineCc: 440 },
      'Nightster': { variants: ['STD', 'Special'], engineCc: 975 },
      'Sportster S': { variants: ['STD'], engineCc: 1252 },
      'Pan America 1250': { variants: ['Special'], engineCc: 1252 },
      'Fat Boy 114': { variants: ['STD'], engineCc: 1868 },
    },
  },
  'BMW Motorrad': {
    type: 'BIKE',
    models: {
      'G 310 R': { variants: ['STD'], engineCc: 313 },
      'G 310 GS': { variants: ['STD'], engineCc: 313 },
      'G 310 RR': { variants: ['STD', 'Style Sport'], engineCc: 313 },
      'F 900 R': { variants: ['STD'], engineCc: 895 },
      'S 1000 RR': { variants: ['STD', 'Pro M Sport'], engineCc: 999 },
      'R 1250 GS': { variants: ['STD', 'Adventure'], engineCc: 1254 },
    },
  },
};

// Concrete Vehicle rows (used by /api/vehicles/find for part compatibility): one row per
// model x year x fuel, first variant only, to keep the combinatorial size sane.
const VEHICLE_YEARS = [2021, 2022, 2023, 2024, 2025];

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

  for (const [catalogKey, { type, name, models }] of Object.entries(CATALOG)) {
    const manufacturerName = name || catalogKey;
    const manufacturer = await prisma.manufacturer.upsert({
      where: { name_type: { name: manufacturerName, type } },
      update: { type },
      create: { name: manufacturerName, type },
    });
    manufacturerCount++;

    for (const [modelName, spec] of Object.entries(models)) {
      let model = await prisma.model.findFirst({
        where: { manufacturerId: manufacturer.id, name: modelName },
      });
      if (!model) {
        model = await prisma.model.create({
          data: { manufacturerId: manufacturer.id, name: modelName },
        });
        modelCount++;
      }

      const existingVariants = await prisma.variant.findMany({ where: { modelId: model.id } });
      const missingVariants = spec.variants.filter(
        (v) => !existingVariants.some((e) => e.name === v)
      );
      if (missingVariants.length > 0) {
        await prisma.variant.createMany({
          data: missingVariants.map((name) => ({ modelId: model.id, name })),
        });
        variantCount += missingVariants.length;
      }

      const firstVariant =
        existingVariants.find((v) => v.name === spec.variants[0]) ||
        (await prisma.variant.findFirst({ where: { modelId: model.id, name: spec.variants[0] } }));

      const fuels = spec.fuels || ['Petrol'];
      const vehicleRows = [];
      for (const fuel of fuels) {
        for (const year of VEHICLE_YEARS) {
          vehicleRows.push({
            manufacturerId: manufacturer.id,
            modelId: model.id,
            variantId: firstVariant?.id || null,
            fuelTypeId: fuelTypeRecords[fuel].id,
            year,
            engineCc: fuel === 'Electric' ? null : spec.engineCc ?? null,
          });
        }
      }
      const created = await prisma.vehicle.createMany({ data: vehicleRows, skipDuplicates: true });
      vehicleCount += created.count;
    }
  }

  const totals = await prisma.$transaction([
    prisma.manufacturer.count({ where: { type: 'CAR' } }),
    prisma.manufacturer.count({ where: { type: 'BIKE' } }),
    prisma.model.count(),
    prisma.variant.count(),
    prisma.fuelType.count(),
    prisma.vehicle.count(),
  ]);

  console.log('--- Vehicle Master seed summary ---');
  console.log(`Manufacturers processed this run: ${manufacturerCount}`);
  console.log(`Models created this run: ${modelCount}`);
  console.log(`Variants created this run: ${variantCount}`);
  console.log(`Vehicle rows created this run: ${vehicleCount}`);
  console.log(
    `DB totals -> CAR brands: ${totals[0]}, BIKE brands: ${totals[1]}, models: ${totals[2]}, variants: ${totals[3]}, fuel types: ${totals[4]}, vehicles: ${totals[5]}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
