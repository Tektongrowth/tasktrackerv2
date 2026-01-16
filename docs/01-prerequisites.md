# Prerequisites - Account Setup Checklist

Before deploying TaskTracker Pro, you'll need accounts with several services. This guide helps you prepare everything.

---

## Required Accounts

### 1. GitHub (Free)
**Purpose:** Host your source code

- [ ] Go to [github.com/signup](https://github.com/signup)
- [ ] Create an account or sign in
- [ ] Enable two-factor authentication (recommended)

**What you'll need later:**
- Your GitHub username
- Ability to create private repositories

---

### 2. Railway ($5-20/month)
**Purpose:** Host your application and database

- [ ] Go to [railway.app](https://railway.app)
- [ ] Sign up with GitHub (recommended) or email
- [ ] Add a payment method (required for production)

**What you'll need later:**
- Railway account connected to GitHub
- Ability to create new projects

**Pricing:**
- Hobby plan: $5/month includes basic resources
- Pro plan: $20/month for more resources
- Usage-based billing applies

---

### 3. Stripe (Free to start, 2.9% + 30¢ per transaction)
**Purpose:** Process payments from your clients

- [ ] Go to [dashboard.stripe.com/register](https://dashboard.stripe.com/register)
- [ ] Create an account
- [ ] Verify your email
- [ ] Complete business verification (for live mode)

**What you'll need later:**
- Publishable key (starts with `pk_`)
- Secret key (starts with `sk_`)
- Webhook signing secret (starts with `whsec_`)

**Note:** You can use test mode while setting up. Switch to live mode when ready to accept real payments.

---

### 4. Resend (Free tier: 3,000 emails/month)
**Purpose:** Send email notifications

- [ ] Go to [resend.com/signup](https://resend.com/signup)
- [ ] Create an account
- [ ] Verify your email

**What you'll need later:**
- API key (starts with `re_`)
- Verified sending domain (or use test mode initially)

**Optional but recommended:**
- Add and verify your custom domain for professional emails

---

### 5. Google Cloud (Free)
**Purpose:** Enable "Sign in with Google"

- [ ] Go to [console.cloud.google.com](https://console.cloud.google.com)
- [ ] Sign in with your Google account
- [ ] Accept the terms of service

**What you'll need later:**
- OAuth Client ID
- OAuth Client Secret
- Configured consent screen

---

## Optional Accounts

### 6. Custom Domain ($10-15/year)
**Purpose:** Use your own URL (e.g., tasks.yourcompany.com)

Recommended registrars:
- [Namecheap](https://namecheap.com)
- [Cloudflare](https://cloudflare.com)
- [Google Domains](https://domains.google.com)

**What you'll need later:**
- Access to DNS settings
- Ability to add CNAME records

---

## Development Tools

### Required on Your Computer

#### Node.js 18+
```bash
# Check your version
node --version

# Should show v18.x.x or higher
```

If not installed, download from [nodejs.org](https://nodejs.org/)

#### Git
```bash
# Check if installed
git --version
```

If not installed:
- **Mac:** `xcode-select --install`
- **Windows:** Download from [git-scm.com](https://git-scm.com/)

#### Claude Code (Recommended)
```bash
# Install Claude Code
npm install -g @anthropic-ai/claude-code

# Verify installation
claude --version
```

---

## Checklist Summary

| Service | Account Created | Notes |
|---------|-----------------|-------|
| GitHub | [ ] | Free |
| Railway | [ ] | Add payment method |
| Stripe | [ ] | Can use test mode initially |
| Resend | [ ] | Free tier is generous |
| Google Cloud | [ ] | Free |
| Domain (optional) | [ ] | $10-15/year |

---

## Time Estimate

| Task | Time |
|------|------|
| Creating accounts | 15-20 minutes |
| Installing tools | 5-10 minutes |
| **Total prep time** | **20-30 minutes** |

---

## Next Steps

Once you have all accounts ready, proceed to:

**[02 - GitHub Setup](02-github-setup.md)** →

Or use Claude Code with the prompts in `SETUP-GUIDE.md` for an AI-guided experience.
