# TaskTracker Pro - Claude Code Setup Guide

This guide will help you deploy TaskTracker Pro using Claude Code. The AI will walk you through each step interactively.

---

## Before You Begin

Make sure you have:

1. **Claude Code installed** - [Get it here](https://claude.ai/code)
2. **A GitHub account** - [Create one](https://github.com/signup)
3. **Node.js 18+** - [Download](https://nodejs.org/)

You'll create the following accounts during setup:
- Railway (hosting)
- Stripe (payments)
- Resend (email)
- Google Cloud (authentication)

---

## Step 1: Start Claude Code

Open a terminal in the `source/` directory of this package:

```bash
cd tasktracker-pro/source
claude
```

---

## Step 2: Copy This Prompt

Once Claude Code starts, paste the following prompt:

---

### INITIAL SETUP PROMPT

```
I just purchased TaskTracker Pro and need help deploying it. The source code is in this directory.

Here's what I need to set up:
1. GitHub - Push this code to my own private repository
2. Railway - Deploy the application (frontend + backend + database)
3. Stripe - Set up payment processing
4. Resend - Configure email notifications
5. Google OAuth - Enable login with Google

My custom domain (if I have one): [ENTER YOUR DOMAIN OR TYPE "none"]
My email address: [ENTER YOUR EMAIL]

Please start by helping me push this code to GitHub. Walk me through each step one at a time, asking for confirmation before proceeding to the next step.
```

---

## Step 3: Follow the Interactive Guide

Claude will guide you through:

### A. GitHub Setup (~5 minutes)
- Creating a new private repository
- Pushing the source code
- Setting up the correct branch

### B. Railway Deployment (~10 minutes)
- Creating a Railway account
- Connecting to GitHub
- Setting up the PostgreSQL database
- Configuring environment variables
- Deploying the application

### C. Stripe Configuration (~5 minutes)
- Creating Stripe account (if needed)
- Getting API keys
- Setting up webhook endpoints
- Testing the connection

### D. Resend Email Setup (~5 minutes)
- Creating Resend account
- Verifying your domain (or using test mode)
- Getting the API key
- Testing email delivery

### E. Google OAuth (~10 minutes)
- Creating Google Cloud project
- Configuring OAuth consent screen
- Creating OAuth credentials
- Adding authorized redirect URIs

### F. Final Testing (~5 minutes)
- Verifying the deployment
- Testing login flow
- Sending test emails
- Checking Stripe integration

---

## Alternative Prompts

### If you get stuck, use these prompts:

**Resume where you left off:**
```
I was setting up TaskTracker Pro and got stuck on [STEP NAME]. Here's what I've completed so far:
- GitHub: [done/not done]
- Railway: [done/not done]
- Stripe: [done/not done]
- Resend: [done/not done]
- Google OAuth: [done/not done]

Please help me continue from where I stopped.
```

**Debug a specific issue:**
```
I'm having an issue with TaskTracker Pro deployment.

The error I'm seeing is:
[PASTE ERROR MESSAGE]

This happened when I was trying to:
[DESCRIBE WHAT YOU WERE DOING]

Please help me fix this.
```

**Add a custom domain:**
```
TaskTracker Pro is deployed and working. Now I want to add my custom domain:
- Domain: [YOUR DOMAIN]
- Current Railway URL: [YOUR RAILWAY URL]

Please walk me through connecting my domain.
```

**Customize branding:**
```
TaskTracker Pro is deployed and working. I want to customize the branding:
- Company name: [YOUR COMPANY]
- Primary color: [HEX CODE or describe]
- Logo: [I have a logo file / I need help creating one]

Please help me update the branding.
```

---

## Manual Setup Alternative

If you prefer not to use Claude Code, follow the step-by-step guides in the `docs/` folder:

1. [Prerequisites](docs/01-prerequisites.md)
2. [GitHub Setup](docs/02-github-setup.md)
3. [Railway Deployment](docs/03-railway-deploy.md)
4. [Stripe Configuration](docs/04-stripe-config.md)
5. [Resend Configuration](docs/05-resend-config.md)
6. [Google OAuth](docs/06-google-oauth.md)
7. [Custom Domain](docs/07-custom-domain.md)
8. [Customization](docs/08-customization.md)

---

## Troubleshooting

### Common Issues

**"Railway deployment failed"**
- Check that all environment variables are set
- Ensure DATABASE_URL is using the Railway-provided URL
- Check the Railway logs for specific errors

**"Google OAuth not working"**
- Verify the redirect URI matches exactly
- Make sure the OAuth consent screen is configured
- Check that the correct scopes are enabled

**"Emails not sending"**
- Verify your Resend API key is correct
- Check that your domain is verified (or use test mode)
- Look at Resend dashboard for delivery logs

**"Stripe webhooks failing"**
- Ensure the webhook secret matches
- Verify the endpoint URL is correct
- Check that the webhook is listening for the right events

---

## Need Help?

Reply to your purchase confirmation email for support.

Include:
- Your license key
- Screenshot of the error
- Steps you took before the error

Response time: Within 24-48 hours
