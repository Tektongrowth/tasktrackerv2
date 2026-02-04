# Claude Code Context

## Project Overview

TaskTrackerPro - A task management system for agencies with clients, projects, and team collaboration features including chat, Telegram integration, and a monthly leaderboard/gamification system.

## Deployment

- **Hosting**: Railway (auto-deploys from GitHub main branch)
- **Production URL**: https://tasks.tektongrowth.com
- **API URL**: https://api.tektongrowth.com
- **GitHub**: Tektongrowth/tasktrackerv2

If deployment seems stuck:
1. Check Railway dashboard for build logs
2. Disconnect/reconnect GitHub repo if needed
3. Push a new commit to trigger deploy

## Workflow Rules

- **Always ask before pushing to production** - Never push to main/deploy without explicit user approval
- Test changes locally first using `npm run dev:local` (see memory.md for local dev setup)

## Project Structure

```
source/
├── client/           # React frontend (Vite + TypeScript)
│   └── src/
│       ├── components/   # UI components
│       ├── hooks/        # React Query hooks (useTasks, useAuth, etc.)
│       ├── pages/        # Page components (KanbanPage, DashboardPage, etc.)
│       └── lib/          # API client, types, utilities
├── server/           # Express.js backend (TypeScript)
│   └── src/
│       ├── routes/       # API route handlers
│       ├── services/     # Business logic (email, telegram, stripe, etc.)
│       ├── db/           # Prisma client
│       └── middleware/   # Auth, error handling
└── prisma/           # Database schema
```

## Key Commands

```bash
# Local development (runs both client and server)
npm run dev

# Build for production
npm run build

# Type-check client
cd client && npx tsc --noEmit

# Type-check server
cd server && npx tsc --noEmit

# Database operations (run from server/)
npx prisma db push              # Apply schema changes (dev)
npx prisma migrate dev          # Create migration (dev)
npx prisma studio               # Visual database browser

# Deploy (auto-deploys on push)
git push origin main
```

## Architecture Patterns

### Frontend (React + React Query)
- **State management**: React Query for server state, local state for UI
- **Data fetching**: Custom hooks in `hooks/` wrapping React Query
- **API client**: `lib/api.ts` - all API calls go through `fetchApi()`
- **Prevent empty data flash**: Use `placeholderData: (prev) => prev` in queries

### Backend (Express + Prisma)
- **Database**: PostgreSQL via Prisma ORM
- **Auth**: Google OAuth, session cookies
- **Real-time**: Socket.io for chat messages
- **File uploads**: Comment attachments stored in `/uploads`

### Key Services
- `server/src/services/telegram.ts` - Telegram bot notifications and reply handling
- `server/src/services/email.ts` - Email notifications via Resend
- `server/src/services/stripe.ts` - Subscription webhooks, auto-creates clients/projects
- `server/src/services/taskGenerator.ts` - Creates tasks from templates
- `server/src/socket.ts` - WebSocket chat with offline notifications

## Common Patterns

### Adding a new API endpoint
1. Add route in `server/src/routes/`
2. Add API function in `client/src/lib/api.ts`
3. Create React Query hook in `client/src/hooks/`

### Database schema changes
1. Edit `server/prisma/schema.prisma`
2. Run `npx prisma db push` (dev) or create migration
3. Prisma client auto-regenerates

### React Query cache invalidation
```typescript
queryClient.invalidateQueries({ queryKey: ['tasks'] });
queryClient.invalidateQueries({ queryKey: ['dashboard'] });
```

## Environment Variables

Key env vars (set in Railway):
- `DATABASE_URL` - PostgreSQL connection string
- `GOOGLE_CLIENT_ID/SECRET` - OAuth
- `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET` - Payments
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` - Notifications
- `RESEND_API_KEY` - Email
- `SESSION_SECRET` - Cookie signing

## Gotchas

- Always use `placeholderData` in React Query to prevent empty data flash during refetch
- Telegram webhook endpoint is `/telegram/webhook` (not under /api)
- Stripe webhook endpoint is `/webhooks/stripe` (not under /api)
- Socket.io requires CORS config matching client origin
- File uploads max 10MB, stored locally (not S3)

## Code Style

- TypeScript strict mode
- ES modules (import/export)
- 2-space indentation
- React functional components with hooks
- Prisma for all database operations (no raw SQL)

## Maintenance

**Last reviewed**: 2026-02-03

This file contains foundational project information. Update it when:
- New services or integrations are added
- Architecture patterns or conventions change
- Project structure changes
- New commands or workflows are established
- New gotchas are discovered

At session start, check if significant commits have been made since last review date. If foundational changes occurred, update this file and the review date.
