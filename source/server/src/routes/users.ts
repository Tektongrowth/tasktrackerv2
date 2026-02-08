import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../db/client.js';
import { isAuthenticated, isAdmin } from '../middleware/auth.js';
import { sendInviteEmail } from '../services/email.js';
import { AppError } from '../middleware/errorHandler.js';
import { assignContractorToRoleTasks } from '../services/roleAssignment.js';

const router = Router();

// Valid permission keys that can be set
const VALID_PERMISSION_KEYS = [
  'viewOwnTasksOnly',
  'viewAllTasks',
  'editOwnTasks',
  'editAllTasks',
  'viewOwnTimeEntries',
  'viewAllTimeEntries',
  'manageTemplates',
] as const;

// Valid access levels
const VALID_ACCESS_LEVELS = ['viewer', 'editor', 'project_manager', 'admin'] as const;
type AccessLevel = typeof VALID_ACCESS_LEVELS[number];

// Validate and sanitize permissions object
function sanitizePermissions(permissions: unknown): Record<string, boolean> | null {
  if (!permissions || typeof permissions !== 'object') return null;

  const sanitized: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(permissions)) {
    if (VALID_PERMISSION_KEYS.includes(key as any) && typeof value === 'boolean') {
      sanitized[key] = value;
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

// List users for mentions (any authenticated user)
// Returns minimal user info needed for @mentions
router.get('/mentionable', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
      },
      orderBy: { name: 'asc' },
    });
    res.json(users);
  } catch (error) {
    next(error);
  }
});

// List users for chat (available to all authenticated users, minimal info)
router.get('/chat-list', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const currentUser = req.user as Express.User;

    // Return only active users with minimal info needed for chat
    const users = await prisma.user.findMany({
      where: {
        active: true,
        archived: false,
        id: { not: currentUser.id } // Exclude current user
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true
      },
      orderBy: { name: 'asc' }
    });

    res.json(users);
  } catch (error) {
    next(error);
  }
});

// List all users (all authenticated users)
router.get('/', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const currentUser = req.user as Express.User;

    if (currentUser.role === 'admin') {
      const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          jobRole: true
        }
      });
      return res.json(users);
    }

    // Non-admin users get minimal fields only
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        role: true,
        jobRoleId: true,
        jobRole: true
      }
    });
    res.json(users);
  } catch (error) {
    next(error);
  }
});

// Invite new contractor
router.post('/invite', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, name, permissions, accessLevel, jobRoleId } = req.body;

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError('User with this email already exists', 400);
    }

    // Validate access level if provided
    const validAccessLevel: AccessLevel = accessLevel && VALID_ACCESS_LEVELS.includes(accessLevel)
      ? accessLevel
      : 'viewer';

    // Validate jobRoleId if provided
    if (jobRoleId) {
      const roleExists = await prisma.role.findUnique({ where: { id: jobRoleId } });
      if (!roleExists) {
        throw new AppError('Invalid role ID', 400);
      }
    }

    const inviteToken = uuidv4();

    const user = await prisma.user.create({
      data: {
        email,
        name: name || email.split('@')[0],
        role: 'contractor',
        accessLevel: validAccessLevel,
        permissions: permissions || {
          viewOwnTasksOnly: true,
          viewAllTasks: false,
          editOwnTasks: true,
          editAllTasks: false,
          viewOwnTimeEntries: true,
          viewAllTimeEntries: false,
          manageTemplates: false
        },
        inviteToken,
        ...(jobRoleId && { jobRoleId })
      },
      include: {
        jobRole: true
      }
    });

    // If user has a role, auto-assign them to existing tasks with that role
    if (jobRoleId) {
      await assignContractorToRoleTasks(user.id, jobRoleId);
    }

    // Send invite email
    await sendInviteEmail(email, inviteToken, user.name);

    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
});

// Update user/permissions
router.patch('/:id', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { name, email, permissions, role, active, accessLevel, jobRoleId } = req.body;
    const currentUser = req.user as Express.User;

    // Prevent admin from deactivating themselves
    if (id === currentUser.id && active === false) {
      throw new AppError('Cannot deactivate your own account', 400);
    }

    // Validate role if provided
    if (role && !['admin', 'contractor'].includes(role)) {
      throw new AppError('Invalid role. Must be admin or contractor', 400);
    }

    // Validate access level if provided
    if (accessLevel && !VALID_ACCESS_LEVELS.includes(accessLevel)) {
      throw new AppError('Invalid access level. Must be viewer, editor, project_manager, or admin', 400);
    }

    // Validate jobRoleId if provided (null is allowed to clear)
    if (jobRoleId !== undefined && jobRoleId !== null) {
      const roleExists = await prisma.role.findUnique({ where: { id: jobRoleId } });
      if (!roleExists) {
        throw new AppError('Invalid job role ID', 400);
      }
    }

    // Prevent removing own admin role/access
    if (id === currentUser.id && role === 'contractor') {
      throw new AppError('Cannot remove your own admin privileges', 400);
    }
    if (id === currentUser.id && accessLevel && accessLevel !== 'admin') {
      throw new AppError('Cannot demote your own access level', 400);
    }

    // Sanitize permissions
    const sanitizedPermissions = sanitizePermissions(permissions);

    // Get current user to check if role is changing
    const existingUser = await prisma.user.findUnique({ where: { id } });

    // Check for email uniqueness if email is being changed
    if (email && typeof email === 'string') {
      const emailTrimmed = email.trim().toLowerCase();
      const existingWithEmail = await prisma.user.findFirst({
        where: { email: emailTrimmed, id: { not: id } }
      });
      if (existingWithEmail) {
        throw new AppError('A user with this email already exists', 400);
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(name && typeof name === 'string' && { name: name.trim() }),
        ...(email && typeof email === 'string' && { email: email.trim().toLowerCase() }),
        ...(sanitizedPermissions && { permissions: sanitizedPermissions }),
        ...(role && { role }),
        ...(accessLevel && { accessLevel }),
        ...(typeof active === 'boolean' && { active }),
        ...(jobRoleId !== undefined && { jobRoleId: jobRoleId || null })
      },
      include: {
        jobRole: true
      }
    });

    // If job role changed to a new role, auto-assign to tasks with that role
    if (jobRoleId && existingUser?.jobRoleId !== jobRoleId) {
      await assignContractorToRoleTasks(id, jobRoleId);
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Archive contractor (unassigns tasks, revokes access)
router.post('/:id/archive', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const currentUser = req.user as Express.User;

    // Prevent admin from archiving themselves
    if (id === currentUser.id) {
      throw new AppError('Cannot archive your own account', 400);
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Unassign only incomplete tasks from this user (keep completed tasks assigned)
    await prisma.taskAssignee.deleteMany({
      where: {
        userId: id,
        task: { status: { not: 'completed' } }
      }
    });

    // Archive the user (also deactivates to revoke access)
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        archived: true,
        archivedAt: new Date(),
        active: false
      }
    });

    res.json(updatedUser);
  } catch (error) {
    next(error);
  }
});

// Unarchive contractor (restores access)
router.post('/:id/unarchive', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        archived: false,
        archivedAt: null,
        active: true
      }
    });

    res.json(updatedUser);
  } catch (error) {
    next(error);
  }
});

// Permanently delete user
router.delete('/:id', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const currentUser = req.user as Express.User;

    // Prevent admin from deleting themselves
    if (id === currentUser.id) {
      throw new AppError('Cannot delete your own account', 400);
    }

    // Check if user exists
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Delete the user (cascade will handle task assignments and other related records)
    await prisma.user.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Resend invite
router.post('/:id/resend-invite', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (user.googleId) {
      throw new AppError('User has already completed signup', 400);
    }

    const inviteToken = uuidv4();
    await prisma.user.update({
      where: { id },
      data: { inviteToken }
    });

    await sendInviteEmail(user.email, inviteToken, user.name);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Valid notification preference keys with channel support
// Core notification types that support per-channel preferences
const CHANNEL_NOTIFICATION_TYPES = ['taskAssignment', 'mentions', 'chatMessages', 'taskUpdates'] as const;

// Legacy notification keys (email-only)
const LEGACY_NOTIFICATION_KEYS = [
  'projectAssignment',     // When assigned to a new project
  'taskMovedToReview',     // When a task is moved to review
  'taskCompleted',         // When a task is marked complete
  'taskOverdue',           // When a task becomes overdue
  'taskDueSoon',           // When a task is due within 24 hours
  'dailyDigest',           // Daily summary email
  'weeklyDigest',          // Weekly summary email
] as const;

// Valid channels for channel-based preferences
const VALID_CHANNELS = ['email', 'push', 'telegram'] as const;

interface ChannelPrefs {
  email?: boolean;
  push?: boolean;
  telegram?: boolean;
}

// Validate and sanitize notification preferences
// Supports both old boolean format and new channel format
function sanitizeNotificationPrefs(prefs: unknown): Record<string, boolean | ChannelPrefs> | null {
  if (!prefs || typeof prefs !== 'object') return null;

  const sanitized: Record<string, boolean | ChannelPrefs> = {};

  for (const [key, value] of Object.entries(prefs)) {
    // Handle channel-based notification types
    if (CHANNEL_NOTIFICATION_TYPES.includes(key as any)) {
      if (typeof value === 'boolean') {
        // Old format: boolean (for backwards compatibility)
        sanitized[key] = value;
      } else if (value && typeof value === 'object') {
        // New format: channel object
        const channelPrefs: ChannelPrefs = {};
        const v = value as Record<string, unknown>;
        for (const channel of VALID_CHANNELS) {
          if (typeof v[channel] === 'boolean') {
            channelPrefs[channel] = v[channel] as boolean;
          }
        }
        if (Object.keys(channelPrefs).length > 0) {
          sanitized[key] = channelPrefs;
        }
      }
    }
    // Handle legacy notification keys (email-only, boolean)
    else if (LEGACY_NOTIFICATION_KEYS.includes(key as any) && typeof value === 'boolean') {
      sanitized[key] = value;
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

// Get current user's notification preferences
router.get('/me/notifications', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as Express.User).id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPreferences: true }
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Default channel preferences for core notification types
    const defaultChannelPrefs = {
      taskAssignment: { email: true, push: true, telegram: true },
      mentions: { email: true, push: true, telegram: true },
      chatMessages: { email: false, push: true, telegram: true },
      taskUpdates: { email: false, push: true, telegram: true },
    };

    // Default legacy preferences (email-only)
    const defaultLegacyPrefs: Record<string, boolean> = {
      projectAssignment: true,
      taskMovedToReview: true,
      taskCompleted: false,
      taskOverdue: true,
      taskDueSoon: false,
      dailyDigest: false,
      weeklyDigest: true,
    };

    const currentPrefs = (user.notificationPreferences as Record<string, unknown>) || {};

    // Build the merged preferences
    const mergedPrefs: Record<string, unknown> = { ...defaultLegacyPrefs };

    // Merge legacy preferences
    for (const key of LEGACY_NOTIFICATION_KEYS) {
      if (typeof currentPrefs[key] === 'boolean') {
        mergedPrefs[key] = currentPrefs[key];
      }
    }

    // Merge channel-based preferences with migration support
    for (const type of CHANNEL_NOTIFICATION_TYPES) {
      const value = currentPrefs[type];
      if (value === undefined) {
        // Use default
        mergedPrefs[type] = defaultChannelPrefs[type];
      } else if (typeof value === 'boolean') {
        // Old format: convert boolean to all channels
        mergedPrefs[type] = {
          email: value,
          push: value,
          telegram: value,
        };
      } else if (value && typeof value === 'object') {
        // New format: merge with defaults
        const channelValue = value as Record<string, unknown>;
        mergedPrefs[type] = {
          email: typeof channelValue.email === 'boolean' ? channelValue.email : defaultChannelPrefs[type].email,
          push: typeof channelValue.push === 'boolean' ? channelValue.push : defaultChannelPrefs[type].push,
          telegram: typeof channelValue.telegram === 'boolean' ? channelValue.telegram : defaultChannelPrefs[type].telegram,
        };
      } else {
        mergedPrefs[type] = defaultChannelPrefs[type];
      }
    }

    res.json(mergedPrefs);
  } catch (error) {
    next(error);
  }
});

// Update current user's notification preferences
router.patch('/me/notifications', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as Express.User).id;
    const { preferences } = req.body;

    const sanitized = sanitizeNotificationPrefs(preferences);
    if (!sanitized) {
      throw new AppError('Invalid notification preferences', 400);
    }

    // Get current preferences and merge with new ones
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPreferences: true }
    });

    const currentPrefs = (user?.notificationPreferences as Record<string, unknown>) || {};
    const mergedPrefs = { ...currentPrefs, ...sanitized };

    await prisma.user.update({
      where: { id: userId },
      data: { notificationPreferences: mergedPrefs as object }
    });

    res.json(mergedPrefs);
  } catch (error) {
    next(error);
  }
});

export default router;
