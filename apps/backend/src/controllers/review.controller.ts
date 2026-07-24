import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middlewares/auth';

// Recomputes and persists Product.avgRating/reviewCount from its Review rows.
// Called after every create/update/delete so GET /products can sort/filter
// by rating directly in SQL instead of averaging every product's reviews in
// Node on every list request.
export const recomputeProductRating = async (productId: string) => {
  const agg = await prisma.review.aggregate({
    where: { productId },
    _avg: { rating: true },
    _count: { rating: true },
  });
  await prisma.product.update({
    where: { id: productId },
    data: {
      avgRating: agg._count.rating > 0 ? Math.round((agg._avg.rating || 0) * 10) / 10 : 0,
      reviewCount: agg._count.rating,
    },
  });
};

// Backs the homepage testimonials section -- real 5-star reviews with a
// comment, most recent first, instead of the fabricated illustrative quotes
// that used to live there (Testimonials.tsx previously hardcoded 3 quotes
// attributed to fake names/cities with a code comment admitting they were
// placeholders, since no reviews API existed yet).
export const getFeaturedReviews = async (req: Request, res: Response) => {
  try {
    const reviews = await prisma.review.findMany({
      where: { rating: 5, comment: { not: null } },
      include: { user: { select: { name: true } }, product: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 6,
    });
    res.json(reviews.map(r => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      userName: r.user.name,
      productName: r.product.name,
    })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch featured reviews' });
  }
};

export const getProductReviews = async (req: Request, res: Response) => {
  try {
    const productId = String(req.params.productId);
    const reviews = await prisma.review.findMany({
      where: { productId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    // "Verified Purchase" badge -- true if the reviewer has at least one
    // OrderItem for this product, checked in one batch query rather than
    // N+1 per review.
    const userIds = Array.from(new Set(reviews.map(r => r.userId)));
    const purchasers = await prisma.orderItem.findMany({
      where: { productId, order: { userId: { in: userIds } } },
      select: { order: { select: { userId: true } } },
    });
    const purchaserIds = new Set(purchasers.map(p => p.order.userId));

    res.json(reviews.map(r => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      userName: r.user.name,
      verifiedPurchase: purchaserIds.has(r.userId),
    })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
};

export const createProductReview = async (req: AuthRequest, res: Response) => {
  try {
    const productId = String(req.params.productId);
    const { rating, comment } = req.body;
    const userId = req.user!.userId;

    const ratingNum = Number(rating);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      res.status(400).json({ error: 'Rating must be an integer between 1 and 5.' });
      return;
    }

    const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const existing = await prisma.review.findUnique({ where: { userId_productId: { userId, productId } } });
    const review = existing
      ? await prisma.review.update({
          where: { id: existing.id },
          data: { rating: ratingNum, comment: comment ? String(comment).slice(0, 2000) : null },
        })
      : await prisma.review.create({
          data: { userId, productId, rating: ratingNum, comment: comment ? String(comment).slice(0, 2000) : null },
        });

    await recomputeProductRating(productId);
    res.status(existing ? 200 : 201).json(review);
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit review' });
  }
};

export const deleteProductReview = async (req: AuthRequest, res: Response) => {
  try {
    const productId = String(req.params.productId);
    const userId = req.user!.userId;

    const existing = await prisma.review.findUnique({ where: { userId_productId: { userId, productId } } });
    if (!existing) {
      res.status(404).json({ error: 'Review not found' });
      return;
    }

    await prisma.review.delete({ where: { id: existing.id } });
    await recomputeProductRating(productId);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete review' });
  }
};
