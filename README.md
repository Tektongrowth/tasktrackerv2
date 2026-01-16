# TaskTracker Pro

**Your complete task management platform - ready to deploy in under 30 minutes.**

---

## What You're Getting

TaskTracker Pro is a full-featured task management SaaS platform that includes:

- **Kanban Board** - Drag-and-drop task management
- **Time Tracking** - Built-in timer and analytics
- **Multi-tenant** - Manage multiple clients and projects
- **Team Collaboration** - Assignees, comments, mentions
- **Email Notifications** - Powered by Resend
- **Client Portal** - Let clients view their tasks
- **Customizable Branding** - Your logo, colors, domain
- **Role-based Access** - Admin, Project Manager, Contractor roles

---

## Quick Start

### Option A: Claude Code Setup (Recommended - 20-30 minutes)

If you have [Claude Code](https://claude.ai/code) installed:

1. Open a terminal in this directory
2. Run `claude` to start Claude Code
3. Copy and paste the prompt from `SETUP-GUIDE.md`
4. Follow the AI-guided setup

### Option B: Manual Setup (2-4 hours)

Follow the step-by-step guides in the `docs/` folder:

1. [Prerequisites](docs/01-prerequisites.md) - Account setup checklist
2. [GitHub Setup](docs/02-github-setup.md) - Create your repository
3. [Railway Deployment](docs/03-railway-deploy.md) - Deploy the application
4. [Stripe Configuration](docs/04-stripe-config.md) - Payment integration
5. [Resend Configuration](docs/05-resend-config.md) - Email setup
6. [Google OAuth](docs/06-google-oauth.md) - Authentication setup
7. [Custom Domain](docs/07-custom-domain.md) - Connect your domain
8. [Customization](docs/08-customization.md) - Branding and theming

---

## Package Contents

```
tasktracker-pro/
├── README.md              # This file
├── SETUP-GUIDE.md         # Claude Code setup prompts
├── LICENSE.txt            # Commercial license
├── docs/                  # Step-by-step guides
│   ├── 01-prerequisites.md
│   ├── 02-github-setup.md
│   ├── 03-railway-deploy.md
│   ├── 04-stripe-config.md
│   ├── 05-resend-config.md
│   ├── 06-google-oauth.md
│   ├── 07-custom-domain.md
│   └── 08-customization.md
└── source/                # Application source code
    ├── client/            # React frontend
    ├── server/            # Express backend
    └── .env.example       # Environment template
```

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS |
| Backend | Node.js, Express, Prisma ORM |
| Database | PostgreSQL |
| Authentication | Google OAuth, Passport.js |
| Payments | Stripe |
| Email | Resend |
| Hosting | Railway (recommended) |

---

## Estimated Costs

| Service | Monthly Cost | Notes |
|---------|-------------|-------|
| Railway | $5-20 | Scales with usage |
| Database | Included | Railway PostgreSQL |
| Stripe | 2.9% + 30¢ | Per transaction |
| Resend | Free | Up to 3,000 emails/mo |
| Domain | ~$1 | Optional, annual |

**Total: ~$5-25/month** to run your own instance.

---

## Support

- **Email Support:** 30 days included with purchase
- **Documentation:** Complete guides in `docs/` folder
- **Updates:** Check your purchase email for update notifications

For support, reply to your purchase confirmation email.

---

## License

This software is licensed for commercial use. See `LICENSE.txt` for full terms.

**You CAN:**
- Deploy for your own business use
- Modify and customize the code
- Use for client projects
- White-label with your branding

**You CANNOT:**
- Resell the source code
- Distribute to others
- Create derivative products for sale

---

Thank you for purchasing TaskTracker Pro!
