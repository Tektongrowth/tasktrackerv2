# Stripe Configuration Guide

This guide walks you through setting up Stripe for subscription management and automatic task assignment in TaskTracker Pro.

---

## Overview

TaskTracker Pro uses Stripe for:
- Client subscription management
- **Automatic task generation** based on subscription plans
- Webhook notifications for payment events
- Plan upgrades/downgrades handling

---

## Step 1: Access Stripe Dashboard

1. Go to [dashboard.stripe.com](https://dashboard.stripe.com)
2. Sign in or create an account
3. Complete account verification if prompted

---

## Step 2: Get API Keys

### For Testing (Recommended First)

1. Make sure **Test mode** is enabled (toggle in the top right)
2. Go to **Developers** → **API keys**
3. Copy the following:
   - **Publishable key:** `pk_test_...`
   - **Secret key:** Click "Reveal" and copy `sk_test_...`

### For Production (When Ready)

1. Toggle to **Live mode**
2. Complete account verification
3. Copy the live keys:
   - **Publishable key:** `pk_live_...`
   - **Secret key:** `sk_live_...`

---

## Step 3: Create Subscription Products

Create products for each plan/service tier you want to offer. TaskTracker Pro supports up to 6 plan types that you can customize for your business.

### Create Products for Each Plan

1. Go to **Products** → **Add product**
2. Create a product for each service tier you offer (e.g., Basic, Pro, Enterprise)
3. For each product, add a recurring price:
   - **Pricing model:** Recurring
   - **Amount:** Your monthly price
   - **Billing period:** Monthly

4. **Important:** Copy each **Price ID** (starts with `price_`)

### Available Plan Type Slots

TaskTracker Pro has 6 configurable plan type slots. You can use as many or as few as your business needs:

| Environment Variable | Use For |
|---------------------|---------|
| `STRIPE_PRICE_LVL1_BASIC` | Your entry-level plan |
| `STRIPE_PRICE_LVL1_ADVANCED` | Your mid-tier plan |
| `STRIPE_PRICE_LVL2_BASIC` | Your professional plan |
| `STRIPE_PRICE_LVL2_ADVANCED` | Your premium plan |
| `STRIPE_PRICE_HOSTING_PLUS` | Additional service tier (optional) |
| `STRIPE_PRICE_HOSTING_UNLIMITED` | Additional service tier (optional) |

You only need to configure the plan types you actually use. Unconfigured plans will simply be ignored.

---

## Step 4: Set Up Webhooks

Webhooks notify your app when subscriptions change.

### Create Webhook Endpoint

1. Go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Configure:
   - **Endpoint URL:** `https://your-app.up.railway.app/webhooks/stripe`
   - **Description:** "TaskTracker Pro webhook"
   - **Events to send:** Select the following:
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.paid`

4. Click **Add endpoint**

### Get Webhook Secret

1. Click on the webhook you just created
2. Find **Signing secret**
3. Click **Reveal** and copy: `whsec_...`

---

## Step 5: Add Environment Variables to Railway

Go to your Railway project and add these environment variables:

### Required Variables

```env
STRIPE_API_KEY=sk_test_... (or sk_live_... for production)
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Price-to-Plan Mapping (Required for Auto Task Assignment)

Map your Stripe price IDs to plan types. When a customer subscribes to a price, the corresponding plan's task templates are automatically generated.

Add a variable for each plan type you use, with the Price ID from Step 3:

```env
STRIPE_PRICE_LVL1_BASIC=price_xxxxxxxxxxxxx
STRIPE_PRICE_LVL1_ADVANCED=price_xxxxxxxxxxxxx
STRIPE_PRICE_LVL2_BASIC=price_xxxxxxxxxxxxx
STRIPE_PRICE_LVL2_ADVANCED=price_xxxxxxxxxxxxx
STRIPE_PRICE_HOSTING_PLUS=price_xxxxxxxxxxxxx
STRIPE_PRICE_HOSTING_UNLIMITED=price_xxxxxxxxxxxxx
```

**Note:** Only add variables for plans you actually use. If you only have 2 tiers, you only need 2 variables configured.

**Redeploy after adding the variables.**

---

## Step 6: Verify Configuration in Settings

After deploying:

1. Log into TaskTracker Pro as admin
2. Go to **Settings** → **Stripe** tab
3. You'll see:
   - Webhook URL (copy this if you haven't set up webhooks yet)
   - Price mapping status showing which plans are configured
   - A "Test Stripe Connection" button

The price mapping display shows green checkmarks for configured plans and amber warnings for missing ones.

---

## Step 7: Test the Integration

### Test Webhook Connection

1. In Stripe Dashboard, go to **Developers** → **Webhooks**
2. Click on your endpoint
3. Click **Send test webhook**
4. Select `customer.subscription.created`
5. Click **Send test webhook**
6. Check your Railway logs for webhook receipt

### Test with a Real Subscription

1. Create a test customer in Stripe
2. Subscribe them to one of your products
3. In TaskTracker Pro, check:
   - New client created automatically
   - New project created with correct plan type
   - Onboarding tasks generated from templates

### Test Cards

Use these test card numbers:

| Card Number | Result |
|-------------|--------|
| 4242 4242 4242 4242 | Success |
| 4000 0000 0000 0002 | Decline |
| 4000 0000 0000 3220 | 3D Secure |

Use any future date for expiry and any 3 digits for CVC.

---

## How Automatic Task Assignment Works

| Stripe Event | What Happens in TaskTracker |
|--------------|----------------------------|
| `customer.subscription.created` | Creates client, project, and generates **onboarding** tasks |
| `customer.subscription.updated` | Updates plan type, handles upgrades/downgrades |
| `customer.subscription.deleted` | Marks project as cancelled (tasks preserved) |
| `invoice.paid` | Generates **recurring** monthly tasks |

### Task Templates

Configure task templates in TaskTracker Pro:
- **Onboarding templates** - Generated once when subscription starts
- **Recurring templates** - Generated each billing cycle

Each template can be assigned to specific plan types, so LVL2 customers get additional tasks.

---

## Going Live Checklist

Before switching to live mode:

- [ ] Complete Stripe account verification
- [ ] Add bank account for payouts
- [ ] Create live webhook endpoint
- [ ] Update all environment variables for live mode
- [ ] Test with a real $1 transaction
- [ ] Verify tasks are generated correctly
- [ ] Refund the test transaction

### Switch to Live Mode

1. In Railway, update environment variables:
   ```env
   STRIPE_API_KEY=sk_live_...
   ```
2. Create a new webhook endpoint in **live mode**
3. Update `STRIPE_WEBHOOK_SECRET` with the live webhook secret
4. Update all `STRIPE_PRICE_*` variables with live price IDs
5. Redeploy

---

## Troubleshooting

### "Unknown price ID" in logs

- Verify the price ID is correct in your environment variables
- Check that you're using the right mode (test vs live price IDs)
- Confirm the plan type matches one of the configured `STRIPE_PRICE_*` vars

### "No such webhook endpoint"

- Verify the endpoint URL is exactly correct
- Check that the webhook is in the right mode (test vs live)
- Make sure your app is deployed and accessible

### "Signature verification failed"

- Double-check the webhook secret
- Ensure you're using the correct mode's secret
- The secret is specific to each endpoint

### Tasks not generating

- Check that task templates exist for the plan type
- Verify the `STRIPE_PRICE_*` environment variable is set
- Look at Railway logs for errors during webhook processing

### "Webhook timeout"

- Your server might be slow to respond
- Check Railway logs for errors
- Webhooks must respond within 30 seconds

---

## Security Best Practices

1. **Never expose secret keys** - Only use in server-side code
2. **Verify webhook signatures** - Already implemented in TaskTracker Pro
3. **Use HTTPS only** - Railway provides this automatically
4. **Monitor for fraud** - Enable Stripe Radar in dashboard

---

## Next Steps

Stripe is configured! Now set up email notifications:

**[05 - Resend Configuration](05-resend-config.md)** →
