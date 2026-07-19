import { PrismaClient, Role } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// Ensure uploads dir exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

async function downloadImage(url: string | null | undefined, prefix: string): Promise<string | null> {
  if (!url) return null;
  try {
    const parsedUrl = new URL(url);
    const filename = path.basename(parsedUrl.pathname);
    // Add prefix to avoid collisions
    const uniqueFilename = `${prefix}_${Date.now()}_${filename}`;
    const dest = path.join(UPLOADS_DIR, uniqueFilename);

    console.log(`Downloading ${url} -> ${uniqueFilename}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      console.warn(`Failed to download image: ${response.statusText}`);
      return null;
    }

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(dest, Buffer.from(buffer));
    
    // Return relative URL for serving from backend
    return `/uploads/${uniqueFilename}`;
  } catch (error) {
    console.error(`Error downloading image ${url}:`, error);
    return null;
  }
}

async function main() {
  console.log('Fetching live categories from mechbazar.com...');
  const catRes = await fetch('https://mechbazar.com/wp-json/wc/store/products/categories?per_page=100');
  const liveCategories = await catRes.json();
  
  console.log(`Found ${liveCategories.length} live categories. Syncing...`);
  
  // Create a map to store imported category IDs
  const categoryMap = new Map<number, string>();
  
  for (const cat of liveCategories) {
    // Download category image
    const localImagePath = await downloadImage(cat.image?.src, 'cat');

    // 1. CAR Category
    const existingCar = await prisma.category.findFirst({ where: { name: cat.name, vehicleType: 'CAR' } });
    let dbCarCat;
    if (existingCar) {
      dbCarCat = await prisma.category.update({
        where: { id: existingCar.id },
        data: { 
          image: localImagePath, 
          icon: localImagePath,
          status: 'Active'
        }
      });
    } else {
      dbCarCat = await prisma.category.create({
        data: {
          name: cat.name,
          image: localImagePath,
          icon: localImagePath,
          vehicleType: 'CAR',
          status: 'Active'
        }
      });
    }
    categoryMap.set(cat.id, dbCarCat.id);
  }

  // Ensure fallback vendor and brand
  const user = await prisma.user.upsert({
    where: { phone: '9999999999' },
    update: {},
    create: { phone: '9999999999', name: 'Fallback Vendor', role: Role.VENDOR }
  });
  
  const vendor = await prisma.vendor.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id, storeName: 'MechBazar Live Data' }
  });
  
  const brand = await prisma.brand.upsert({
    where: { name: 'Generic Brand' },
    update: {},
    create: { name: 'Generic Brand' }
  });

  console.log('Fetching live products...');
  
  let page = 1;
  const perPage = 100;
  const maxPages = 5; // Syncing up to 500 products
  let totalImported = 0;
  
  while (page <= maxPages) {
    console.log(`Fetching page ${page}...`);
    const prodRes = await fetch(`https://mechbazar.com/wp-json/wc/store/products?per_page=${perPage}&page=${page}`);
    if (!prodRes.ok) break;
    const liveProducts = await prodRes.json();
    if (!liveProducts || liveProducts.length === 0) break;
    
    for (const p of liveProducts) {
      // Find category
      let categoryId = categoryMap.values().next().value; // Fallback to first category
      if (p.categories && p.categories.length > 0) {
        const liveCatId = p.categories[0].id;
        if (categoryMap.has(liveCatId)) {
          categoryId = categoryMap.get(liveCatId);
        }
      }
      
      const images = p.images ? await Promise.all(p.images.map((img: any) => downloadImage(img.src, 'prod'))) : [];
      const validImages = images.filter(img => img !== null) as string[];
      
      const minorUnit = p.prices?.currency_minor_unit || 2;
      const divisor = Math.pow(10, minorUnit);
      
      const price = parseFloat(p.prices?.price || '0') / divisor;
      const regularPrice = parseFloat(p.prices?.regular_price || p.prices?.price || '0') / divisor;
      
      // We don't have a unique constraint on product name, so we just check if it exists by name and vendor
      const existingProduct = await prisma.product.findFirst({
        where: { name: p.name, vendorId: vendor.id }
      });
      
      const description = (p.short_description || p.description || 'Live product').replace(/(<([^>]+)>)/gi, ""); // strip HTML
      
      if (!existingProduct) {
        await prisma.product.create({
          data: {
            vendorId: vendor.id,
            categoryId: categoryId,
            brandId: brand.id,
            name: p.name,
            description: description,
            price: price,
            mrp: regularPrice,
            stock: p.is_in_stock ? 100 : 0,
            images: validImages
          }
        });
        totalImported++;
      } else {
        // Update images and price
        await prisma.product.update({
          where: { id: existingProduct.id },
          data: {
            images: validImages,
            price: price,
            mrp: regularPrice,
            description: description
          }
        });
      }
    }
    
    page++;
  }
  
  console.log(`Live sync complete! Imported/Updated ${totalImported} products.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
