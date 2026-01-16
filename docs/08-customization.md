# Customization Guide

This guide covers how to customize TaskTracker Pro for your brand and business needs.

---

## Overview

TaskTracker Pro supports customization through:
- Environment variables (no code changes)
- Admin settings panel (in-app)
- Code modifications (for advanced users)

---

## Branding Options

### App Name

Update the application name displayed throughout:

**In Railway environment variables:**
```env
APP_NAME=Your Company Tasks
```

This affects:
- Browser tab title
- Login page heading
- Email templates

### Logo

Replace the logo via the admin panel:

1. Log in as admin
2. Go to **Settings** → **Appearance**
3. Upload your logo (recommended: 200x50px PNG with transparency)
4. Click **Save**

Or modify directly in code:
```
client/public/logo.svg
client/public/logo-dark.svg (for dark mode)
```

---

## Color Theming

### Via Admin Panel

1. Go to **Settings** → **Appearance**
2. Adjust:
   - Primary color (buttons, links, accents)
   - Secondary color (highlights, badges)
   - Enable/disable dark mode default

### Via Code (Advanced)

Edit `client/src/index.css`:

```css
:root {
  /* Primary brand color */
  --primary: 221.2 83.2% 53.3%;
  
  /* Secondary accent */
  --secondary: 210 40% 96.1%;
  
  /* Background colors */
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  
  /* Card and component backgrounds */
  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;
}
```

---

## Email Templates

### Customizing Email Content

Email templates are stored in the database. To modify:

1. Go to **Settings** → **Emails**
2. Select a template to edit
3. Modify subject and body
4. Use available variables (shown in editor)
5. Send a test email
6. Save changes

### Available Templates

| Template | Variables |
|----------|-----------|
| User Invite | `{{inviteLink}}`, `{{adminName}}` |
| Task Assignment | `{{taskTitle}}`, `{{assignerName}}`, `{{dueDate}}` |
| Task Due Soon | `{{taskTitle}}`, `{{dueDate}}`, `{{taskLink}}` |
| Task Overdue | `{{taskTitle}}`, `{{dueDate}}`, `{{taskLink}}` |
| Comment Mention | `{{commenterName}}`, `{{taskTitle}}`, `{{comment}}` |

### Email Sender Name

Update in Railway:
```env
EMAIL_FROM=Your Company <tasks@yourdomain.com>
```

---

## Task Statuses

### Default Statuses

TaskTracker Pro includes these default statuses:
- Backlog
- To Do
- In Progress
- Review
- Complete

### Adding Custom Statuses

1. Go to **Settings** → **Workflow**
2. Click **Add Status**
3. Configure:
   - Name
   - Color
   - Position in workflow

### Removing Statuses

1. Ensure no tasks use the status
2. Go to **Settings** → **Workflow**
3. Click the delete icon on the status

---

## Task Fields

### Default Fields

- Title (required)
- Description
- Status
- Priority (Low, Medium, High, Urgent)
- Due Date
- Assignee(s)
- Tags
- Time Estimate
- Attachments

### Custom Fields (Admin)

1. Go to **Settings** → **Custom Fields**
2. Click **Add Field**
3. Configure:
   - Field name
   - Field type (text, number, date, dropdown, checkbox)
   - Required or optional
4. Save

Custom fields appear on all task forms.

---

## User Roles

### Default Roles

| Role | Capabilities |
|------|-------------|
| Admin | Full access, user management, settings |
| Contractor | Task management, time tracking |

### Role Assignment

1. Go to **Settings** → **Users**
2. Click on a user
3. Change their role
4. Save

### Auto-Admin Assignment

Set admin emails in Railway:
```env
ADMIN_EMAILS=admin1@example.com,admin2@example.com
```

Users with these emails automatically become admins on login.

---

## Client Portal

### Enabling Client Access

1. Go to **Settings** → **Clients**
2. Create or select a client
3. Enable **Portal Access**
4. Configure visible projects
5. Send invite link

### Client Permissions

Clients can:
- View assigned tasks
- Add comments
- View progress
- Cannot edit tasks or access admin features

---

## Notifications

### Email Notifications (User Settings)

Users can configure their notifications:

1. Click profile icon → **Settings**
2. Go to **Notifications**
3. Toggle:
   - Task assignments
   - Due date reminders
   - Comment mentions
   - Weekly digest

### System Notifications (Admin)

1. Go to **Settings** → **Notifications**
2. Configure:
   - Due date reminder timing (1 day, 3 days, etc.)
   - Overdue check frequency
   - Admin alert emails

---

## Time Tracking

### Configure Time Tracking

1. Go to **Settings** → **Time Tracking**
2. Options:
   - Enable/disable time tracking
   - Require time entries
   - Billable rates (per user or project)
   - Rounding rules

### Billable Rates

Set default rate in Railway:
```env
DEFAULT_HOURLY_RATE=150
```

Override per client or project in admin settings.

---

## Advanced Customization

### Modifying the Frontend

The React frontend is in `client/src/`:

```
client/src/
├── components/     # Reusable UI components
├── pages/          # Page components
├── lib/            # Utilities and API
└── index.css       # Global styles
```

After changes:
```bash
cd client
npm run build
```

### Modifying the Backend

The Express backend is in `server/src/`:

```
server/src/
├── routes/         # API endpoints
├── middleware/     # Auth, validation
├── services/       # Business logic
└── index.ts        # App entry point
```

### Database Modifications

Schema is in `server/prisma/schema.prisma`.

After schema changes:
```bash
cd server
npx prisma migrate dev --name your_change_name
npx prisma generate
```

---

## Environment Variables Reference

| Variable | Purpose | Example |
|----------|---------|---------|
| APP_NAME | Display name | "Acme Tasks" |
| APP_URL | Backend URL | "https://app.yourdomain.com" |
| CLIENT_URL | Frontend URL | "https://app.yourdomain.com" |
| EMAIL_FROM | Sender email | "Tasks <tasks@domain.com>" |
| ADMIN_EMAILS | Auto-admin list | "a@b.com,c@d.com" |
| DEFAULT_HOURLY_RATE | Billing rate | "150" |

---

## Getting Help

For customization assistance:

1. **Review source code** - Well-documented components
2. **Use Claude Code** - Ask for help with modifications
3. **Check logs** - Railway deployment logs for errors

---

## You're All Set!

Congratulations! TaskTracker Pro is now configured and customized.

**Quick Links:**
- [Prerequisites](01-prerequisites.md)
- [GitHub Setup](02-github-setup.md)
- [Railway Deploy](03-railway-deploy.md)
- [Stripe Config](04-stripe-config.md)
- [Resend Email](05-resend-config.md)
- [Google OAuth](06-google-oauth.md)
- [Custom Domain](07-custom-domain.md)
