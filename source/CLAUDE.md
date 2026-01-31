# Claude Code Context

## Deployment

- **Hosting**: Railway (auto-deploys from GitHub main branch)
- **URL**: https://tasks.tektongrowth.com (or your Railway URL)
- **If auto-deploy not working**: Go to Railway dashboard → Project → Settings → Check "Enable auto-deploy from GitHub"

## Project Structure

- `client/` - React frontend (Vite)
- `server/` - Express.js backend
- Production: Server serves client from `client/dist`

## Key Commands

```bash
# Local dev
npm run dev

# Build for production
npm run build

# After pushing to main, Railway auto-deploys
git push origin main
```

## API Endpoints

- Backend API: `/api/*`
- Stripe webhooks: `/webhooks/stripe`

## Environment

- Database: PostgreSQL on Railway
- Auth: Google OAuth
- Payments: Stripe
- Email: Resend
- Notifications: Telegram bot

