import Stripe from 'stripe';
import { PlanType } from '@prisma/client';
import { prisma } from '../db/client.js';
import { applyNewProjectTemplates, upgradeProjectPlanType, applyRecurringTemplates } from './templateService.js';
import { sendNewSubscriptionEmail, sendSubscriptionCanceledEmail } from './email.js';

// Build Price ID to Plan Type mapping from environment variables
// Configure these in your deployment environment:
//   STRIPE_PRICE_LVL1_BASIC=price_xxx
//   STRIPE_PRICE_LVL1_ADVANCED=price_xxx
//   STRIPE_PRICE_LVL2_BASIC=price_xxx
//   STRIPE_PRICE_LVL2_ADVANCED=price_xxx
//   STRIPE_PRICE_HOSTING_PLUS=price_xxx (optional)
//   STRIPE_PRICE_HOSTING_UNLIMITED=price_xxx (optional)
function buildPriceToPlanMap(): Record<string, PlanType> {
  const mapping: Record<string, PlanType> = {};

  const priceVars: { envVar: string; planType: PlanType }[] = [
    { envVar: 'STRIPE_PRICE_PACKAGE_ONE', planType: 'package_one' },
    { envVar: 'STRIPE_PRICE_PACKAGE_TWO', planType: 'package_two' },
    { envVar: 'STRIPE_PRICE_PACKAGE_THREE', planType: 'package_three' },
    { envVar: 'STRIPE_PRICE_PACKAGE_FOUR', planType: 'package_four' },
    { envVar: 'STRIPE_PRICE_FACEBOOK_ADS', planType: 'facebook_ads_addon' },
    { envVar: 'STRIPE_PRICE_CUSTOM_WEBSITE', planType: 'custom_website_addon' },
  ];

  for (const { envVar, planType } of priceVars) {
    const priceId = process.env[envVar];
    if (priceId) {
      mapping[priceId] = planType;
    }
  }

  return mapping;
}

const PRICE_TO_PLAN = buildPriceToPlanMap();

export async function handleStripeWebhook(event: Stripe.Event) {
  switch (event.type) {
    case 'customer.subscription.created':
      await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
      break;
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;
    case 'invoice.paid':
      await handleInvoicePaid(event.data.object as Stripe.Invoice);
      break;
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const stripe = new Stripe(process.env.STRIPE_API_KEY || '');

  // Get customer details
  const customer = await stripe.customers.retrieve(subscription.customer as string) as Stripe.Customer;

  // Determine plan type from price ID
  const priceId = subscription.items.data[0]?.price.id;
  const planType = PRICE_TO_PLAN[priceId];

  if (!planType) {
    console.log(`Unknown price ID: ${priceId}, skipping task generation`);
    return;
  }

  // Find or create client
  let client = await prisma.client.findUnique({
    where: { stripeCustomerId: subscription.customer as string }
  });

  if (!client) {
    client = await prisma.client.create({
      data: {
        name: customer.name || customer.email || 'Unknown Client',
        email: customer.email || undefined,
        phone: customer.phone || undefined,
        stripeCustomerId: subscription.customer as string
      }
    });
  }

  // Create project for this subscription
  const project = await prisma.project.create({
    data: {
      clientId: client.id,
      name: client.name,
      planType: planType as any,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: 'active',
      billingDate: new Date(subscription.current_period_end * 1000)
    }
  });

  // Generate onboarding tasks from TemplateSets
  const { totalTasksCreated, templateSetsApplied } = await applyNewProjectTemplates(project.id, planType);

  // Get created tasks for email notification
  const tasks = await prisma.task.findMany({
    where: { projectId: project.id }
  });

  // Send notification email to admin
  await sendNewSubscriptionEmail(client, project, tasks);

  console.log(`Created project ${project.id} with ${totalTasksCreated} tasks from ${templateSetsApplied} template sets for subscription ${subscription.id}`);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const project = await prisma.project.findUnique({
    where: { stripeSubscriptionId: subscription.id },
    include: { client: true }
  });

  if (!project) {
    console.log(`Project not found for subscription ${subscription.id}`);
    return;
  }

  // Check if plan type changed (upgrade/downgrade)
  const priceId = subscription.items.data[0]?.price.id;
  const newPlanType = PRICE_TO_PLAN[priceId];
  const oldPlanType = project.planType;
  const planChanged = newPlanType && newPlanType !== oldPlanType;

  // Update project with new billing date and plan
  await prisma.project.update({
    where: { id: project.id },
    data: {
      billingDate: new Date(subscription.current_period_end * 1000),
      subscriptionStatus: subscription.status === 'active' ? 'active' :
                          subscription.status === 'past_due' ? 'past_due' : 'canceled',
      ...(planChanged && { planType: newPlanType as any })
    }
  });

  // If plan changed, handle upgrade/downgrade logic
  if (planChanged && newPlanType) {
    console.log(`Plan changed from ${oldPlanType} to ${newPlanType} for project ${project.id}`);

    // upgradeProjectPlanType handles deduplication - only applies templates not already applied
    const result = await upgradeProjectPlanType(project.id, newPlanType);
    console.log(`Upgrade: created ${result.tasksCreated} new tasks, skipped ${result.skippedDuplicates} duplicates`);
  }

  console.log(`Updated project ${project.id} billing date${planChanged ? ` and plan type to ${newPlanType}` : ''}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const project = await prisma.project.findUnique({
    where: { stripeSubscriptionId: subscription.id },
    include: { client: true }
  });

  if (!project) {
    console.log(`Project not found for subscription ${subscription.id}`);
    return;
  }

  // Mark as canceled but keep all tasks intact
  await prisma.project.update({
    where: { id: project.id },
    data: { subscriptionStatus: 'canceled' }
  });

  // Send notification to admin
  await sendSubscriptionCanceledEmail(project.client, project);

  console.log(`Marked project ${project.id} as canceled (tasks preserved)`);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  // Only process subscription invoices (not one-time payments)
  if (!invoice.subscription) {
    return;
  }

  // Skip the first invoice (already handled by subscription.created)
  if (invoice.billing_reason === 'subscription_create') {
    return;
  }

  const project = await prisma.project.findUnique({
    where: { stripeSubscriptionId: invoice.subscription as string }
  });

  if (!project || !project.planType) {
    console.log(`Project not found or no plan type for subscription ${invoice.subscription}`);
    return;
  }

  // Update billing date
  const stripe = new Stripe(process.env.STRIPE_API_KEY || '');
  const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);

  await prisma.project.update({
    where: { id: project.id },
    data: {
      billingDate: new Date(subscription.current_period_end * 1000)
    }
  });

  // Generate recurring tasks for this billing cycle from TemplateSets with 'schedule' trigger
  const { totalTasksCreated, templateSetsApplied } = await applyRecurringTemplates(project.id, project.planType);

  console.log(`Generated ${totalTasksCreated} recurring tasks from ${templateSetsApplied} template sets for project ${project.id}`);
}
