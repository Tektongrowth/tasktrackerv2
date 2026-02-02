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

- Task assignment bug fix (completed)

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

### 2026-02-02
- Set up memory.md and moved CLAUDE.md to project root for better Claude Code integration
- Added maintenance workflow for keeping context files updated
- Fixed task assignment bug: relaxed permissions so any authenticated user can:
  - Create tasks (removed project edit access requirement)
  - Assign themselves to any task (special self-assign check added)
  - Comment on any task (removed view permission requirement)
