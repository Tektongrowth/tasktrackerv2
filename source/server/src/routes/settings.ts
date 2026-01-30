import { Router, Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import { prisma } from '../db/client.js';
import { isAuthenticated, isAdmin } from '../middleware/auth.js';

const router = Router();

// Get settings
router.get('/', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    let settings = await prisma.settings.findFirst();

    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          emailNotifications: true,
          notificationSettings: {
            taskAssigned: true,
            taskDueSoon: true,
            taskOverdue: true,
            newSubscription: true,
            subscriptionCanceled: true,
            contractorInvited: true
          }
        }
      });
    }

    // Don't send sensitive keys to frontend
    res.json({
      id: settings.id,
      emailNotifications: settings.emailNotifications,
      notificationSettings: settings.notificationSettings,
      hasStripeWebhookSecret: !!settings.stripeWebhookSecret
    });
  } catch (error) {
    next(error);
  }
});

// Update settings
router.patch('/', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { emailNotifications, notificationSettings, stripeWebhookSecret } = req.body;

    let settings = await prisma.settings.findFirst();

    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          emailNotifications: emailNotifications ?? true,
          notificationSettings: notificationSettings || {},
          stripeWebhookSecret
        }
      });
    } else {
      settings = await prisma.settings.update({
        where: { id: settings.id },
        data: {
          ...(typeof emailNotifications === 'boolean' && { emailNotifications }),
          ...(notificationSettings && { notificationSettings }),
          ...(stripeWebhookSecret && { stripeWebhookSecret })
        }
      });
    }

    res.json({
      id: settings.id,
      emailNotifications: settings.emailNotifications,
      notificationSettings: settings.notificationSettings,
      hasStripeWebhookSecret: !!settings.stripeWebhookSecret
    });
  } catch (error) {
    next(error);
  }
});

// Test Stripe connection
router.post('/test-stripe', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stripe = new Stripe(process.env.STRIPE_API_KEY || '');

    // Try to list customers to verify connection
    await stripe.customers.list({ limit: 1 });

    res.json({ success: true, message: 'Stripe connection successful' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Get webhook URL info
router.get('/webhook-url', isAuthenticated, isAdmin, async (req: Request, res: Response) => {
  const appUrl = process.env.APP_URL || 'http://localhost:3001';
  res.json({
    url: `${appUrl}/webhooks/stripe`,
    events: [
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'invoice.paid'
    ]
  });
});

// Get Stripe price mappings
router.get('/stripe-prices', isAuthenticated, isAdmin, async (req: Request, res: Response) => {
  const priceMappings = [
    { envVar: 'STRIPE_PRICE_PACKAGE_ONE', planType: 'package_one', label: 'Package 1' },
    { envVar: 'STRIPE_PRICE_PACKAGE_TWO', planType: 'package_two', label: 'Package 2' },
    { envVar: 'STRIPE_PRICE_PACKAGE_THREE', planType: 'package_three', label: 'Package 3' },
    { envVar: 'STRIPE_PRICE_PACKAGE_FOUR', planType: 'package_four', label: 'Package 4' },
    { envVar: 'STRIPE_PRICE_FACEBOOK_ADS', planType: 'facebook_ads_addon', label: 'Facebook Ads Add-on' },
    { envVar: 'STRIPE_PRICE_CUSTOM_WEBSITE', planType: 'custom_website_addon', label: 'Custom Website Add-on' },
  ];

  const configured = priceMappings.map(({ envVar, planType, label }) => ({
    envVar,
    planType,
    label,
    priceId: process.env[envVar] || null,
    isConfigured: !!process.env[envVar]
  }));

  const configuredCount = configured.filter(p => p.isConfigured).length;

  res.json({
    prices: configured,
    summary: {
      total: priceMappings.length,
      configured: configuredCount,
      missing: priceMappings.length - configuredCount
    }
  });
});

export default router;
