# Session Memory

This file tracks ongoing work context, decisions, and session history. Updated dynamically as work progresses.

## Recent Work

### Push Notifications Overhaul (Jan-Feb 2026)
- Implemented PWA push notifications for chat messages and mentions
- Added VAPID key configuration
- Fixed rate limiting for public push endpoints
- Added push notification settings to My Settings page
- Enabled sound and vibration for notifications
- Fixed notifications to work even when user is online

### Unread/Badge UX Improvements (Feb 2026)
- Updated unread badges to use red color consistently
- Added red left border styling for unread chat items
- Sort unread chats first in the list
- Simplified mobile badge to red dot
- Added debug logging for unread counts

### Infrastructure Fixes
- Fixed notification click navigation
- Updated service worker versioning
- Added database connection handling and health check
- Fixed various TypeScript errors in push notification code

## Current Priorities

- Monitor task disappearing bug (caching fixes deployed, refresh button added)
- Verify auto-assign on role change works after Railway deploys

## Local Development Setup

**Prerequisites:** Docker Desktop must be running

| Command | Description |
|---------|-------------|
| `npm run dev:local` | Run app with local database |
| `npm run dev` | Run app with production database |
| `npm run db:local:start` | Start local PostgreSQL (Docker) |
| `npm run db:local:stop` | Stop local PostgreSQL |
| `npm run db:local:reset` | Wipe and restart local database |
| `npm run db:local:setup` | Start DB + apply schema + seed test data |

**Local URLs:**
- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- Database: localhost:5433 (PostgreSQL in Docker)

**Workflow:**
1. Work on feature branches during the day, test with `npm run dev:local`
2. Merge to `main` and push in the evening when ready to deploy
3. Railway auto-deploys from `main` → no interruptions for team during work hours

**Files:**
- `source/docker-compose.yml` - Local PostgreSQL container config
- `source/server/.env.local` - Local environment variables
- `source/server/prisma/seed-local.ts` - Test data seeder

## Decisions Made

- Push notifications use VAPID (not Firebase) for better control
- Unread indicators use red consistently across the app
- Mobile uses simplified red dot badge (not count)

## Ongoing Investigations

- (Add bugs or issues being investigated)

## Reminders

- After adding new services/patterns, update CLAUDE.md with foundational info
- Check CLAUDE.md staleness at session start (compare last reviewed date to recent commits)

## Session Log

### 2026-02-03
- **Client import from ClickUp:**
  - Created `importClients.ts` script to bulk import clients from CSV
  - Imported 23 clients with projects and auto-generated tasks from templates
  - 1 skipped (Todd Quality Landscapes - already existed)
  - Blue Ribbon Lawn & Landscape: no package, manual "Website Build" task created
  - 149 total tasks generated across all imported projects

- **Local development environment setup:**
  - Added Docker Compose for local PostgreSQL (port 5433)
  - Created `.env.local` for local environment config
  - Created `seed-local.ts` for test data (3 clients, 3 projects, 7 tasks, 4 roles)
  - Added npm scripts: `dev:local`, `db:local:start`, `db:local:stop`, `db:local:reset`, `db:local:setup`
  - Enables testing without affecting production or interrupting team

- **Role-based auto-assignment feature completed:**
  - When a task gets a role → contractors with that jobRoleId are auto-assigned
  - When a contractor gets a role → they're assigned to existing tasks with that role
  - Works for: task creation, task updates, template-based task generation
  - New function: `assignRoleContractorsToTask()` in roleAssignment.ts
  - Ran backfill script to fix 9 existing tasks missing assignees

- **Task disappearing bug investigation & fixes:**
  - Removed permission-based task filtering (all users now see all tasks)
  - Fixed React Query caching: changed `onSuccess` to `onSettled` for task updates
  - Added auto-retry when empty response received with existing cache
  - Added refresh button to Kanban toolbar for manual cache clear
  - Added logging for debugging empty responses

- **Template task generation fix:**
  - Fixed taskGenerator.ts to copy `defaultRoleId` from template to task
  - Ran backfill script to add roleId to 4 existing template-based tasks

- **Railway deployment issues:**
  - Builds were getting stuck, resolved with empty commits to retrigger
  - Multiple deploys needed to get all fixes live

### 2026-02-02
- Set up memory.md and moved CLAUDE.md to project root for better Claude Code integration
- Added maintenance workflow for keeping context files updated
- Fixed task assignment bug: relaxed permissions so any authenticated user can:
  - Create tasks (removed project edit access requirement)
  - Assign themselves to any task (special self-assign check added)
  - Comment on any task (removed view permission requirement)
