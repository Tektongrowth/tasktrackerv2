import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db/client.js';
import { isAuthenticated } from '../middleware/auth.js';
import { getVapidPublicKey, isPushEnabled } from '../services/pushNotifications.js';

const router = Router();

// Get VAPID public key for client-side subscription
router.get('/vapid-public-key', (_req: Request, res: Response) => {
  if (!isPushEnabled()) {
    return res.status(503).json({ error: 'Push notifications not configured' });
  }
  res.json({ publicKey: getVapidPublicKey() });
});

// Check if push is enabled
router.get('/status', (_req: Request, res: Response) => {
  res.json({ enabled: isPushEnabled() });
});

// Subscribe to push notifications
router.post('/subscribe', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;
    const { subscription } = req.body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ error: 'Invalid subscription object' });
    }

    const { endpoint, keys } = subscription;
    const { p256dh, auth } = keys;

    if (!p256dh || !auth) {
      return res.status(400).json({ error: 'Missing encryption keys' });
    }

    // Upsert subscription (update if endpoint exists, create if not)
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: {
        userId: user.id,
        p256dh,
        auth,
        userAgent: req.headers['user-agent'] || null,
        updatedAt: new Date(),
      },
      create: {
        userId: user.id,
        endpoint,
        p256dh,
        auth,
        userAgent: req.headers['user-agent'] || null,
      },
    });

    res.json({ success: true, message: 'Subscription saved' });
  } catch (error) {
    next(error);
  }
});

// Unsubscribe from push notifications
router.post('/unsubscribe', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint required' });
    }

    await prisma.pushSubscription.deleteMany({
      where: { endpoint },
    });

    res.json({ success: true, message: 'Subscription removed' });
  } catch (error) {
    next(error);
  }
});

// Get user's subscription status
router.get('/subscriptions', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;

    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        endpoint: true,
        userAgent: true,
        createdAt: true,
      },
    });

    res.json({ subscriptions });
  } catch (error) {
    next(error);
  }
});

// Remove a specific subscription by ID
router.delete('/subscriptions/:id', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;
    const { id } = req.params;

    // Ensure user owns this subscription
    const subscription = await prisma.pushSubscription.findFirst({
      where: { id, userId: user.id },
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    await prisma.pushSubscription.delete({ where: { id } });

    res.json({ success: true, message: 'Subscription removed' });
  } catch (error) {
    next(error);
  }
});

export default router;
