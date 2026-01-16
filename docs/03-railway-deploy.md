# Railway Deployment Guide

This guide walks you through deploying TaskTracker Pro to Railway, including the database setup.

---

## Overview

You'll deploy three services:
1. **PostgreSQL Database** - Stores all your data
2. **Server** - Express.js backend API
3. **Client** - React frontend (served by the server in production)

---

## Step 1: Create a Railway Project

1. Go to [railway.app/dashboard](https://railway.app/dashboard)
2. Click **New Project**
3. Select **Deploy from GitHub repo**
4. Find and select your TaskTracker repository
5. Click **Deploy Now**

Railway will attempt to deploy but will fail (that's expected - we need to configure it first).

---

## Step 2: Add PostgreSQL Database

1. In your Railway project, click **New**
2. Select **Database** → **Add PostgreSQL**
3. Wait for the database to provision (about 30 seconds)

### Get the Database URL

1. Click on the PostgreSQL service
2. Go to the **Variables** tab
3. Copy the `DATABASE_URL` value

It looks like:
```
postgresql://postgres:xxxx@containers-us-west-xxx.railway.app:5432/railway
```

---

## Step 3: Configure the Server Service

1. Click on your main service (the one deployed from GitHub)
2. Go to **Settings** tab

### Configure Build Settings

Set the following:
- **Root Directory:** `server`
- **Build Command:** `npm install && npx prisma generate && npx prisma migrate deploy && npm run build`
- **Start Command:** `npm start`

### Add Environment Variables

Go to the **Variables** tab and add:

```env
# Database (copy from PostgreSQL service)
DATABASE_URL=postgresql://postgres:xxxx@xxx.railway.app:5432/railway

# Node environment
NODE_ENV=production
PORT=3001

# Session secret (generate a random string)
SESSION_SECRET=your-random-32-character-string-here

# App URLs (Railway will provide the domain after first deploy)
APP_URL=https://your-app.up.railway.app
CLIENT_URL=https://your-app.up.railway.app

# These will be added later:
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
# STRIPE_API_KEY=
# STRIPE_WEBHOOK_SECRET=
# RESEND_API_KEY=
# EMAIL_FROM=
# ADMIN_EMAIL=
# ADMIN_EMAILS=
```

**Generate a session secret:**
```bash
openssl rand -hex 32
```

---

## Step 4: Deploy

1. Click **Deploy** or push a change to trigger deployment
2. Wait for the build to complete (2-5 minutes)
3. Check the **Deployments** tab for status

### View Logs

If deployment fails:
1. Click on the deployment
2. View **Build Logs** for build errors
3. View **Deploy Logs** for runtime errors

---

## Step 5: Get Your Railway URL

After successful deployment:

1. Go to **Settings** tab
2. Find **Domains** section
3. Click **Generate Domain**
4. Copy your URL (e.g., `https://tasktracker-production.up.railway.app`)

Update your environment variables:
```env
APP_URL=https://your-actual-url.up.railway.app
CLIENT_URL=https://your-actual-url.up.railway.app
```

---

## Step 6: Verify Deployment

Visit your Railway URL. You should see:
- The login page (if not logged in)
- A redirect to Google OAuth (which will fail until configured)

This is expected! We'll configure Google OAuth next.

---

## Project Structure in Railway

Your Railway project should now have:

```
Railway Project
├── PostgreSQL (database)
└── Server (your app from GitHub)
```

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| DATABASE_URL | Yes | PostgreSQL connection string |
| NODE_ENV | Yes | Set to `production` |
| PORT | Yes | Set to `3001` |
| SESSION_SECRET | Yes | Random 32+ character string |
| APP_URL | Yes | Your Railway URL |
| CLIENT_URL | Yes | Same as APP_URL in production |
| GOOGLE_CLIENT_ID | Yes | From Google Cloud Console |
| GOOGLE_CLIENT_SECRET | Yes | From Google Cloud Console |
| STRIPE_API_KEY | Yes | From Stripe Dashboard |
| STRIPE_WEBHOOK_SECRET | Yes | From Stripe Webhooks |
| RESEND_API_KEY | Yes | From Resend Dashboard |
| EMAIL_FROM | Yes | Your verified sender email |
| ADMIN_EMAIL | Yes | Admin notification email |
| ADMIN_EMAILS | Yes | Comma-separated admin emails |
| CORS_ORIGINS | No | For custom domains |
| FRAME_ANCESTORS | No | For iframe embedding |

---

## Troubleshooting

### "Build failed: prisma generate"

Make sure DATABASE_URL is set correctly:
1. Check the PostgreSQL service is running
2. Copy the exact DATABASE_URL from PostgreSQL variables
3. Redeploy

### "Application error" on visit

Check deploy logs:
1. Click on the deployment
2. Look for error messages
3. Common issues:
   - Missing environment variables
   - Database connection failed
   - Port mismatch

### "Cannot connect to database"

1. Verify DATABASE_URL is correct
2. Check PostgreSQL service is running
3. Try restarting both services

### "Build takes too long"

First builds take longer. Subsequent builds use cache.
If consistently slow:
1. Check your `package.json` for unnecessary dependencies
2. Consider upgrading to Railway Pro for faster builds

---

## Cost Optimization

### Hobby Plan ($5/month)
- Includes 512MB RAM, shared CPU
- Good for low-traffic sites
- Database included

### Pro Plan ($20/month)
- More resources
- Better for production
- Priority support

### Monitoring Usage
1. Go to **Usage** tab in Railway
2. Monitor resource consumption
3. Scale up if needed

---

## Next Steps

Your app is deployed but needs integrations configured:

**[04 - Stripe Configuration](04-stripe-config.md)** →

Then Google OAuth, and Resend for emails.
