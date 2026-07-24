// Seeds demo reviews across the imported catalog so rating/review UI (star
// badges, sort-by-rating, filter-by-rating, the Reviews tab on
// ProductDetailsScreen) has real data to show instead of every product
// reading "New". Local/dev seed data only -- attributed to the existing
// CUSTOMER accounts already in this dev DB (mostly QA/E2E test users), not
// fabricated named "real people". Re-running this is idempotent: it uses
// createProductReview's same upsert-by-[userId,productId] semantics, so a
// second run just updates the same rows rather than doubling them.
//
// Run with: npx tsx prisma/seed-product-reviews.ts
import prisma from '../src/config/prisma';
import { recomputeProductRating } from '../src/controllers/review.controller';

const COMMENTS: Record<number, string[]> = {
  5: [
    'Exactly as described, fit perfectly on the first try. Fast delivery too.',
    'Great quality for the price. Would order again.',
    'Genuine part, matched my OEM number exactly. No issues after installation.',
    'Excellent build quality, noticeably better than the local spare I had before.',
  ],
  4: [
    'Good product overall, packaging could be sturdier but the part itself works well.',
    'Does the job well. Took a couple of days longer to arrive than expected.',
    'Solid quality, installed without any issues. Minor scuff on arrival but nothing serious.',
  ],
  3: [
    'Works fine but fitment was slightly tighter than expected for my model.',
    'Average quality, gets the job done for the price.',
  ],
  2: [
    'Not as durable as I hoped, started showing wear within a few weeks.',
  ],
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Weighted toward positive ratings, like most functioning marketplaces.
function weightedRating(): number {
  const r = Math.random();
  if (r < 0.45) return 5;
  if (r < 0.75) return 4;
  if (r < 0.92) return 3;
  return 2;
}

async function main() {
  const customers = await prisma.user.findMany({ where: { role: 'CUSTOMER' }, select: { id: true } });
  const products = await prisma.product.findMany({ where: { status: 'APPROVED' }, select: { id: true } });

  if (customers.length === 0 || products.length === 0) {
    console.log('No customers or products found -- nothing to seed.');
    return;
  }

  // ~65% of the catalog gets reviews (leaves a realistic slice of products
  // genuinely un-reviewed, same as any real storefront), 1-4 reviews each.
  const targetProducts = products.filter(() => Math.random() < 0.65);
  let created = 0;

  for (const product of targetProducts) {
    const reviewerCount = Math.min(1 + Math.floor(Math.random() * 4), customers.length);
    const reviewers = [...customers].sort(() => Math.random() - 0.5).slice(0, reviewerCount);

    for (const reviewer of reviewers) {
      const rating = weightedRating();
      const comment = Math.random() < 0.85 ? pick(COMMENTS[rating] || COMMENTS[4]) : null;
      await prisma.review.upsert({
        where: { userId_productId: { userId: reviewer.id, productId: product.id } },
        update: { rating, comment },
        create: { userId: reviewer.id, productId: product.id, rating, comment },
      });
      created++;
    }
    await recomputeProductRating(product.id);
  }

  console.log(`Seeded/updated ${created} review(s) across ${targetProducts.length} product(s).`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
