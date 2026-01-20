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

// List all users (admin only)
router.get('/', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
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
    const { name, permissions, role, active, accessLevel, jobRoleId } = req.body;
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

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(name && typeof name === 'string' && { name: name.trim() }),
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

// Valid notification preference keys
const VALID_NOTIFICATION_KEYS = [
  'projectAssignment',     // When assigned to a new project
  'taskAssignment',        // When assigned to a new task
  'taskMovedToReview',     // When a task is moved to review
  'taskCompleted',         // When a task is marked complete
  'taskOverdue',           // When a task becomes overdue
  'taskDueSoon',           // When a task is due within 24 hours
  'mentions',              // When mentioned in comments
  'dailyDigest',           // Daily summary email
  'weeklyDigest',          // Weekly summary email
] as const;

// Validate notification preferences
function sanitizeNotificationPrefs(prefs: unknown): Record<string, boolean> | null {
  if (!prefs || typeof prefs !== 'object') return null;

  const sanitized: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(prefs)) {
    if (VALID_NOTIFICATION_KEYS.includes(key as any) && typeof value === 'boolean') {
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

    // Return preferences with defaults for any missing keys
    const defaultPrefs: Record<string, boolean> = {
      projectAssignment: true,
      taskAssignment: false,
      taskMovedToReview: true,
      taskCompleted: false,
      taskOverdue: true,
      taskDueSoon: false,
      mentions: true,
      dailyDigest: false,
      weeklyDigest: true,
    };

    const currentPrefs = (user.notificationPreferences as Record<string, boolean>) || {};
    const mergedPrefs = { ...defaultPrefs, ...currentPrefs };

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

    const currentPrefs = (user?.notificationPreferences as Record<string, boolean>) || {};
    const mergedPrefs = { ...currentPrefs, ...sanitized };

    await prisma.user.update({
      where: { id: userId },
      data: { notificationPreferences: mergedPrefs }
    });

    res.json(mergedPrefs);
  } catch (error) {
    next(error);
  }
});

export default router;
