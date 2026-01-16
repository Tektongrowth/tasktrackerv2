import { Router, Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import { handleStripeWebhook } from '../services/stripe.js';

const router = Router();

router.post('/stripe', async (req: Request, res: Response, next: NextFunction) => {
  const stripe = new Stripe(process.env.STRIPE_API_KEY || '');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  let event: Stripe.Event;

  try {
    // SECURITY: Require webhook signature verification in production
    if (isProduction && !webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET is required in production');
      return res.status(500).json({ error: 'Webhook configuration error' });
    }

    if (webhookSecret) {
      const signature = req.headers['stripe-signature'] as string;
      if (!signature) {
        return res.status(400).json({ error: 'Missing stripe-signature header' });
      }
      event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
    } else {
      // Only allow unsigned webhooks in development
      console.warn('WARNING: Processing unsigned webhook - development only');
      event = req.body as Stripe.Event;
    }

    await handleStripeWebhook(event);

    res.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error.message);
    res.status(400).json({ error: `Webhook Error: ${error.message}` });
  }
});

export default router;
