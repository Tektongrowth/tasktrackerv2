# Google OAuth Configuration Guide

This guide walks you through setting up "Sign in with Google" for TaskTracker Pro.

---

## Overview

TaskTracker Pro uses Google OAuth for:
- User authentication (no passwords to manage)
- Automatic profile picture import
- Secure, trusted login experience

---

## Step 1: Create Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click the project dropdown at the top
3. Click **New Project**
4. Configure:
   - **Project name:** "TaskTracker Pro" (or your preferred name)
   - **Organization:** Your organization (or leave as "No organization")
5. Click **Create**
6. Wait for project creation (about 30 seconds)
7. Select the new project from the dropdown

---

## Step 2: Enable the Google+ API

1. Go to **APIs & Services** → **Library**
2. Search for "Google+ API"
3. Click on it
4. Click **Enable**

Also enable:
- **Google People API** (for profile information)

---

## Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** (unless you have Google Workspace)
3. Click **Create**

### App Information

Fill in:
- **App name:** "TaskTracker Pro" (or your app name)
- **User support email:** Your email
- **App logo:** Optional (can add later)

### App Domain

Fill in:
- **Application home page:** `https://your-app.up.railway.app`
- **Application privacy policy:** `https://your-app.up.railway.app/privacy` (or your policy URL)
- **Application terms of service:** `https://your-app.up.railway.app/terms` (optional)

### Authorized Domains

Add:
- `railway.app`
- `your-custom-domain.com` (if using custom domain)

### Developer Contact

- Add your email address

Click **Save and Continue**

### Scopes

1. Click **Add or Remove Scopes**
2. Add these scopes:
   - `email` - See your primary email address
   - `profile` - See your personal info, including any info you've made public
   - `openid` - Authenticate using OpenID Connect

3. Click **Update**
4. Click **Save and Continue**

### Test Users (for development)

While in testing mode:
1. Click **Add Users**
2. Add email addresses of people who can test
3. Click **Save and Continue**

### Summary

Review and click **Back to Dashboard**

---

## Step 4: Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Select **Web application**
4. Configure:

### Name
`TaskTracker Pro Web Client`

### Authorized JavaScript Origins

Add:
```
https://your-app.up.railway.app
```

For local development, also add:
```
http://localhost:5173
http://localhost:3001
```

### Authorized Redirect URIs

Add:
```
https://your-app.up.railway.app/auth/google/callback
```

For local development, also add:
```
http://localhost:3001/auth/google/callback
```

5. Click **Create**

### Save Your Credentials

You'll see:
- **Client ID:** `xxxx.apps.googleusercontent.com`
- **Client Secret:** `GOCSPX-xxxx`

**Copy both values!** You'll need them for Railway.

---

## Step 5: Add to Railway

Add these environment variables to your Railway project:

```env
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxx
```

Redeploy after adding the variables.

---

## Step 6: Test the Login

1. Visit your TaskTracker URL
2. Click "Sign in with Google"
3. Select your Google account
4. You should be redirected back and logged in

---

## Step 7: Publish the App (For Production)

While in "Testing" mode, only users you've added can log in.

### To allow anyone to sign in:

1. Go to **OAuth consent screen**
2. Click **Publish App**
3. Confirm the warning
4. Status changes to "In production"

**Note:** Publishing may require verification for apps requesting sensitive scopes. The scopes we use (email, profile, openid) typically don't require verification.

---

## Setting Up Your Admin Account

**IMPORTANT:** You must configure your admin email BEFORE logging in for the first time.

### Step 1: Set Your Admin Email

In Railway, add this environment variable with YOUR Google account email:
```env
ADMIN_EMAILS=your-email@gmail.com
```

### Step 2: First Login

1. Visit your TaskTracker URL
2. Click "Sign in with Google"
3. Sign in with the email you configured in `ADMIN_EMAILS`
4. You'll be automatically created as an admin

### Adding Additional Admins

To add multiple admins, use comma-separated emails:
```env
ADMIN_EMAILS=admin1@gmail.com,admin2@gmail.com
```

### Inviting Team Members

After logging in as admin:
1. Go to **Settings** → **Users**
2. Click **Invite User**
3. Enter their email address
4. They'll receive an invite link to join

**Note:** Users NOT in `ADMIN_EMAILS` cannot log in unless they've been invited by an admin.

---

## Troubleshooting

### "Error 400: redirect_uri_mismatch"

The redirect URI doesn't match what's configured in Google Cloud.

**Fix:**
1. Check your exact Railway URL
2. In Google Cloud → Credentials → Your OAuth Client
3. Add the exact URI: `https://your-exact-url.up.railway.app/auth/google/callback`
4. No trailing slashes
5. Must be HTTPS

### "Access blocked: This app's request is invalid"

OAuth consent screen is misconfigured.

**Fix:**
1. Ensure all required fields are filled
2. Add your Railway domain to Authorized domains
3. Verify scopes are correctly selected

### "This app isn't verified"

Normal for testing mode. Users see a warning but can click "Advanced" → "Go to [app] (unsafe)" to continue.

**For production:**
1. Publish the app (Step 7)
2. If required, submit for verification

### "User not allowed to log in"

- In testing mode, only added test users can log in
- Add the user's email in OAuth consent screen → Test users
- Or publish the app for public access

### Login Redirects to Error Page

Check Railway logs for the specific error:
1. Go to Railway → Deployments → Logs
2. Look for authentication errors
3. Common causes:
   - Incorrect Client ID/Secret
   - Missing environment variables
   - Wrong callback URL

---

## Security Notes

1. **Keep Client Secret secure** - Never expose in frontend code
2. **Use HTTPS** - Railway provides this automatically
3. **Limit authorized domains** - Only add domains you control
4. **Monitor usage** - Check Google Cloud Console for unusual activity

---

## Multiple Environments

For separate development/production:

1. Create separate OAuth clients for each
2. Use different redirect URIs
3. Configure environment-specific credentials

---

## Next Steps

Authentication is configured! Optionally add a custom domain:

**[07 - Custom Domain](07-custom-domain.md)** →

Or skip to customization:

**[08 - Customization](08-customization.md)** →
