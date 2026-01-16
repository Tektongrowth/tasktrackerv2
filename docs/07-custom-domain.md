# Custom Domain Configuration

This guide walks you through adding a custom domain to your TaskTracker Pro deployment.

---

## Overview

By default, Railway provides a URL like `your-app.up.railway.app`. You can add a custom domain for a more professional appearance.

---

## Prerequisites

- A registered domain name
- Access to your domain's DNS settings
- TaskTracker Pro deployed to Railway

---

## Step 1: Add Domain in Railway

1. Go to your Railway project
2. Click on your server service
3. Go to **Settings** tab
4. Find **Domains** section
5. Click **Add Domain**
6. Enter your domain (e.g., `app.yourdomain.com` or `tasks.yourdomain.com`)
7. Click **Add**

Railway will show you the CNAME record needed.

---

## Step 2: Configure DNS

### For Subdomain (Recommended)

Add a CNAME record at your domain registrar:

| Type | Name | Value |
|------|------|-------|
| CNAME | `app` | `your-app.up.railway.app` |

Examples:
- `app.yourdomain.com` → CNAME to Railway URL
- `tasks.yourdomain.com` → CNAME to Railway URL

### For Root Domain

Root domains require an A record. Railway provides the IP:

| Type | Name | Value |
|------|------|-------|
| A | `@` | `[IP from Railway]` |

**Note:** Some registrars support CNAME flattening for root domains.

---

## Step 3: Wait for DNS Propagation

- DNS changes can take 1-48 hours to propagate
- Railway will show a checkmark when verified
- Use [whatsmydns.net](https://www.whatsmydns.net) to check propagation

---

## Step 4: Update Environment Variables

After domain is verified, update your Railway environment variables:

```env
APP_URL=https://app.yourdomain.com
CLIENT_URL=https://app.yourdomain.com
```

---

## Step 5: Update Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to **APIs & Services** → **Credentials**
3. Click on your OAuth 2.0 Client ID
4. Add new authorized origins:
   ```
   https://app.yourdomain.com
   ```
5. Add new authorized redirect URIs:
   ```
   https://app.yourdomain.com/auth/google/callback
   ```
6. Click **Save**

---

## Step 6: Update Stripe Webhook (If Using Stripe)

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers** → **Webhooks**
3. Either:
   - **Update existing endpoint** with new URL
   - **Create new endpoint** with custom domain URL
4. Webhook URL: `https://app.yourdomain.com/webhooks/stripe`
5. Get the new webhook secret and update Railway:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_new_secret_here
   ```

---

## SSL Certificate

Railway automatically provisions SSL certificates for custom domains:

- Uses Let's Encrypt
- Auto-renews before expiration
- No configuration needed

Allow a few minutes after DNS verification for SSL to be ready.

---

## Multiple Domains

You can add multiple domains to the same deployment:

1. Add each domain in Railway Settings
2. Configure DNS for each
3. All domains will point to the same application

---

## Troubleshooting

### "Domain verification failed"

- Check DNS records are correct
- Wait for propagation (use whatsmydns.net)
- Remove and re-add the domain

### "SSL certificate pending"

- Wait 5-10 minutes after DNS verification
- Clear browser cache
- Try incognito/private window

### "ERR_SSL_PROTOCOL_ERROR"

- Certificate not yet issued
- Wait a few more minutes
- Check Railway dashboard for status

### "Redirect to old domain"

- Clear browser cache
- Update APP_URL and CLIENT_URL environment variables
- Redeploy the service

### Google OAuth Error

- Ensure new domain is added to authorized origins
- Add callback URL with new domain
- Wait 5 minutes for Google to update

---

## DNS Provider Guides

### Cloudflare

1. DNS → Add Record
2. Type: CNAME
3. Name: `app` (or your subdomain)
4. Target: `your-app.up.railway.app`
5. Proxy status: **DNS only** (grey cloud) - Important!

### Namecheap

1. Domain List → Manage → Advanced DNS
2. Add New Record
3. Type: CNAME Record
4. Host: `app`
5. Value: `your-app.up.railway.app`

### GoDaddy

1. My Products → DNS → Manage
2. Add Record
3. Type: CNAME
4. Name: `app`
5. Value: `your-app.up.railway.app`

---

## Best Practices

1. **Use a subdomain** - Easier to manage than root domain
2. **Keep Railway URL** - Don't delete it, useful for testing
3. **Update OAuth promptly** - Prevents login issues
4. **Test thoroughly** - Check login, webhooks, emails

---

## Next Steps

Domain configured! Now customize your instance:

**[08 - Customization](08-customization.md)** →
