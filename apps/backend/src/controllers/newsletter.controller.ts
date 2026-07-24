import { Request, Response } from 'express';
import prisma from '../config/prisma';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const subscribeNewsletter = async (req: Request, res: Response): Promise<void> => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }

    const existing = await prisma.newsletterSubscriber.findUnique({ where: { email } });
    if (existing) {
      res.status(200).json({ message: 'You are already subscribed.', alreadySubscribed: true });
      return;
    }

    await prisma.newsletterSubscriber.create({ data: { email } });
    res.status(201).json({ message: 'Subscribed successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to subscribe. Please try again.' });
  }
};
