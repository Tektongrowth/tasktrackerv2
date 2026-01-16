# Resend Email Configuration Guide

This guide walks you through setting up Resend for email notifications in TaskTracker Pro.

---

## Overview

TaskTracker Pro uses Resend to send:
- Task assignment notifications
- Due date reminders
- Comment mentions
- Invite emails for new users
- Client portal access links

---

## Step 1: Create Resend Account

1. Go to [resend.com/signup](https://resend.com/signup)
2. Create an account with your email
3. Verify your email address

---

## Step 2: Get Your API Key

1. Go to [resend.com/api-keys](https://resend.com/api-keys)
2. Click **Create API Key**
3. Configure:
   - **Name:** "TaskTracker Pro"
   - **Permission:** Full access
   - **Domain:** All domains (or specific if you prefer)
4. Click **Create**
5. Copy the API key: `re_...`

**Important:** Save this key securely. It's only shown once.

---

## Step 3: Add to Railway

Add these environment variables to your Railway project:

```env
RESEND_API_KEY=re_...
EMAIL_FROM=Task Tracker <onboarding@resend.dev>
ADMIN_EMAIL=your-email@example.com
```

**Note:** The `onboarding@resend.dev` domain works for testing without domain verification.

---

## Step 4: Verify Your Domain (Recommended)

For professional emails from your domain:

### Add Your Domain

1. Go to [resend.com/domains](https://resend.com/domains)
2. Click **Add Domain**
3. Enter your domain (e.g., `yourdomain.com`)
4. Click **Add**

### Configure DNS Records

Resend will show you DNS records to add:

1. Go to your domain registrar's DNS settings
2. Add the records Resend provides:
   - **SPF record** (TXT)
   - **DKIM record** (TXT)
   - **DMARC record** (TXT) - optional but recommended

Example records:
```
Type: TXT
Name: @
Value: v=spf1 include:_spf.resend.com ~all

Type: TXT
Name: resend._domainkey
Value: [provided by Resend]
```

### Verify

1. Click **Verify** in Resend dashboard
2. Wait for DNS propagation (can take up to 48 hours)
3. Status will change to "Verified"

### Update Environment Variable

Once verified:
```env
EMAIL_FROM=Task Tracker <tasks@yourdomain.com>
```

---

## Step 5: Test Email Delivery

### Quick Test via API

You can test using Resend's dashboard:

1. Go to **Emails** section
2. Click **Send a test email**
3. Fill in recipient and subject
4. Send and verify receipt

### Test via TaskTracker

1. Log into your TaskTracker instance
2. Invite a new user (Settings → Users → Invite)
3. Check that the invite email is received

---

## Email Templates

TaskTracker Pro includes these email templates:

| Email Type | Trigger |
|------------|---------|
| User Invite | When admin invites a new user |
| Task Assignment | When a task is assigned to someone |
| Task Due Soon | 24 hours before task due date |
| Task Overdue | When task passes due date |
| Comment Mention | When @mentioned in a comment |
| Client Portal Access | When client requests portal access |

### Customizing Templates

Templates are in the database and can be edited via Settings → Emails in the app.

---

## Resend Free Tier Limits

| Feature | Free Tier |
|---------|-----------|
| Emails per month | 3,000 |
| Emails per day | 100 |
| Domains | 1 |
| API access | Yes |
| Logs retention | 3 days |

**Upgrade options:**
- Pro: $20/mo for 50,000 emails
- Enterprise: Custom pricing

For most small-to-medium teams, the free tier is sufficient.

---

## Troubleshooting

### "API key is invalid"

- Verify the key starts with `re_`
- Check for extra spaces when copying
- Create a new key if needed

### "Emails not sending"

1. Check Resend dashboard → Emails → Logs
2. Look for delivery errors
3. Common issues:
   - Rate limit exceeded
   - Invalid recipient
   - Domain not verified

### "Emails going to spam"

- Verify your domain (adds SPF/DKIM)
- Add DMARC record
- Avoid spam trigger words in subject
- Include unsubscribe link (already included)

### "Domain verification stuck"

DNS propagation can take 24-48 hours. If still stuck:
1. Double-check record values
2. Use [MXToolbox](https://mxtoolbox.com/SuperTool.aspx) to verify records
3. Contact Resend support

---

## Environment Variables Summary

| Variable | Example | Description |
|----------|---------|-------------|
| RESEND_API_KEY | `re_abc123...` | API key from dashboard |
| EMAIL_FROM | `Tasks <tasks@yourdomain.com>` | Sender name and email |
| ADMIN_EMAIL | `admin@yourdomain.com` | Admin notification recipient |

---

## Best Practices

1. **Use a subdomain** for transactional email (e.g., `mail.yourdomain.com`)
2. **Monitor delivery** via Resend dashboard
3. **Set up DMARC** for better deliverability
4. **Keep within rate limits** to avoid temporary blocks

---

## Next Steps

Email is configured! Now set up Google authentication:

**[06 - Google OAuth](06-google-oauth.md)** →
