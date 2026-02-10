import { Router, Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/client.js';
import { isAuthenticated } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { sendMentionNotificationEmail } from '../services/email.js';
import { sendTelegramMessage, sendTelegramPhoto, sendTelegramDocument, escapeTelegramHtml, storeTelegramMessageMapping } from '../services/telegram.js';
import { sendMentionPush, sendTaskUpdatePush } from '../services/pushNotifications.js';
import { parseMentions, resolveMentions, createMentionRecords, markMentionsNotified } from '../utils/mentions.js';
import { validateTitle, validateDescription, validateComment, INPUT_LIMITS } from '../utils/validation.js';
import { uploadFile, getSignedDownloadUrl, deleteFile, generateStorageKey, isStorageConfigured } from '../services/storage.js';
import { shouldNotify } from '../utils/notificationPrefs.js';
import { assignRoleContractorsToTask } from '../services/roleAssignment.js';
import { notifyTaskAssignees } from '../services/notifications.js';
import multer from 'multer';
import path from 'path';

const router = Router();

// Configure multer for comment attachment uploads (memory storage for R2 upload)
const commentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    // Allow images and common document types
    const allowedTypes = /jpeg|jpg|png|gif|webp|heic|heif|pdf/;
    const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mime = allowedTypes.test(file.mimetype);
    if (ext || mime) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: jpeg, jpg, png, gif, webp, heic, heif, pdf'));
    }
  }
});

// Valid status and priority values (must match Prisma enums)
const VALID_STATUSES = ['todo', 'in_review', 'completed'] as const;
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

function validateStatus(status: unknown): void {
  if (status !== undefined && !VALID_STATUSES.includes(status as any)) {
    throw new AppError(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`, 400);
  }
}

function validatePriority(priority: unknown): void {
  if (priority !== undefined && !VALID_PRIORITIES.includes(priority as any)) {
    throw new AppError(`Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`, 400);
  }
}

function validateTags(tags: unknown): void {
  if (tags !== undefined) {
    if (!Array.isArray(tags) || !tags.every(t => typeof t === 'string')) {
      throw new AppError('Tags must be an array of strings', 400);
    }
  }
}

// Helper to safely parse and validate dates
function parseDate(dateStr: string | undefined | null): Date | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  // Sanity check: date should be within reasonable range (1970-2100)
  if (date.getFullYear() < 1970 || date.getFullYear() > 2100) return null;
  return date;
}

// Helper to get allowed project IDs for a user
async function getUserProjectAccess(userId: string) {
  const access = await prisma.projectAccess.findMany({
    where: { userId, canView: true },
    select: { projectId: true, canView: true, canEdit: true, canDelete: true }
  });
  return access;
}

// Helper to check if user has access to a specific project
async function hasProjectAccess(userId: string, projectId: string, permission: 'canView' | 'canEdit' | 'canDelete' = 'canView') {
  const access = await prisma.projectAccess.findUnique({
    where: { userId_projectId: { userId, projectId } }
  });
  return access ? access[permission] : false;
}

// Helper to check if user has elevated access (admin or project manager)
function hasElevatedAccess(user: Express.User): boolean {
  return user.role === 'admin' || user.accessLevel === 'project_manager';
}

// Helper to add a user as a watcher (idempotent)
async function addWatcher(taskId: string, userId: string): Promise<void> {
  try {
    await prisma.taskWatcher.upsert({
      where: { taskId_userId: { taskId, userId } },
      create: { taskId, userId },
      update: {}
    });
  } catch (error) {
    console.error('Failed to add watcher:', error);
  }
}

// Helper to notify all watchers of a task update
async function notifyWatchers(
  taskId: string,
  actorId: string,
  actorName: string,
  taskTitle: string,
  updateType: 'comment' | 'status' | 'assignee',
  details?: string,
  excludeUserIds: string[] = []
): Promise<void> {
  try {
    // Get task with project info for notifications
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          include: { client: { select: { name: true } } }
        }
      }
    });
    if (!task) return;

    // Get all non-muted watchers except the actor and excluded users
    const watchers = await prisma.taskWatcher.findMany({
      where: {
        taskId,
        muted: false,
        userId: { notIn: [actorId, ...excludeUserIds] }
      },
      include: {
        user: {
          select: { id: true, email: true, telegramChatId: true }
        }
      }
    });

    const clientName = task.project?.client?.name || 'Unknown Client';
    const projectName = task.project?.name || 'Unknown Project';

    for (const watcher of watchers) {
      // Push notification
      if (await shouldNotify(watcher.userId, 'taskUpdates', 'push')) {
        await sendTaskUpdatePush(
          watcher.userId,
          actorName,
          taskTitle,
          taskId,
          updateType,
          details
        );
      }

      // Telegram notification
      if (watcher.user.telegramChatId && await shouldNotify(watcher.userId, 'taskUpdates', 'telegram')) {
        let message: string;
        switch (updateType) {
          case 'comment':
            message = `💬 <b>${escapeTelegramHtml(actorName)}</b> commented on "${escapeTelegramHtml(taskTitle)}":\n\n📁 <b>${escapeTelegramHtml(clientName)}</b> › ${escapeTelegramHtml(projectName)}\n\n"${escapeTelegramHtml(details || '')}"`;
            break;
          case 'status':
            message = `📊 <b>${escapeTelegramHtml(actorName)}</b> changed status to <b>${escapeTelegramHtml(details || 'unknown')}</b>\n\n📋 "${escapeTelegramHtml(taskTitle)}"\n📁 <b>${escapeTelegramHtml(clientName)}</b> › ${escapeTelegramHtml(projectName)}`;
            break;
          case 'assignee':
            message = `👤 <b>${escapeTelegramHtml(actorName)}</b> updated assignees\n\n📋 "${escapeTelegramHtml(taskTitle)}"\n📁 <b>${escapeTelegramHtml(clientName)}</b> › ${escapeTelegramHtml(projectName)}`;
            break;
        }
        await sendTelegramMessage(watcher.user.telegramChatId, message);
      }

      // Email notification (if enabled)
      if (watcher.user.email && await shouldNotify(watcher.userId, 'taskUpdates', 'email')) {
        // Email would be sent here if we had a generic task update email function
        // For now, we skip email notifications for task updates
      }
    }
  } catch (error) {
    console.error('Failed to notify watchers:', error);
  }
}

// List tasks with filters
router.get('/', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;
    const { status, assignedTo, projectId, clientId, tag, roleId, dueBefore, dueAfter, includeArchived } = req.query;

    const where: Prisma.TaskWhereInput = {
      // By default, exclude archived tasks
      archived: includeArchived === 'true' ? undefined : false
    };

    // Non-admin/non-PM users can only see tasks in projects they have access to
    if (!hasElevatedAccess(user)) {
      const projectAccess = await getUserProjectAccess(user.id);
      const allowedProjectIds = projectAccess.map(pa => pa.projectId);
      where.OR = [
        { projectId: { in: allowedProjectIds } },
        { assignees: { some: { userId: user.id } } }
      ];
    }

    if (status) where.status = status as Prisma.EnumTaskStatusFilter;
    if (assignedTo) where.assignees = { some: { userId: assignedTo as string } };
    if (projectId) where.projectId = projectId as string;
    if (tag) where.tags = { has: tag as string };
    if (roleId) where.roleId = roleId as string;

    if (dueBefore || dueAfter) {
      where.dueDate = {};
      const parsedBefore = parseDate(dueBefore as string);
      const parsedAfter = parseDate(dueAfter as string);
      if (parsedBefore) where.dueDate.lte = parsedBefore;
      if (parsedAfter) where.dueDate.gte = parsedAfter;
    }

    if (clientId) {
      where.project = { clientId: clientId as string };
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        project: {
          include: {
            client: {
              select: { id: true, name: true, email: true, phone: true }
            }
          }
        },
        assignees: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true }
            }
          }
        },
        assignedRole: true,
        template: {
          select: { id: true, title: true }
        },
        subtasks: {
          orderBy: { sortOrder: 'asc' }
        },
        _count: {
          select: { timeEntries: true }
        }
      },
      orderBy: [
        { sortOrder: 'asc' },
        { dueDate: 'asc' },
        { createdAt: 'desc' }
      ]
    });

    res.json(tasks);
  } catch (error) {
    next(error);
  }
});

// Get archived tasks (must be before /:id to avoid matching "archived" as an id)
router.get('/archived', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;

    // Only admin/PM can view archived tasks
    if (!hasElevatedAccess(user)) {
      throw new AppError('Permission denied', 403);
    }

    const tasks = await prisma.task.findMany({
      where: { archived: true },
      include: {
        project: {
          include: {
            client: {
              select: { id: true, name: true, email: true, phone: true }
            }
          }
        },
        assignees: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true }
            }
          }
        },
        assignedRole: true
      },
      orderBy: { archivedAt: 'desc' }
    });

    res.json(tasks);
  } catch (error) {
    next(error);
  }
});

// Get task details
router.get('/:id', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const user = req.user as Express.User;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            client: true
          }
        },
        assignees: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true }
            }
          }
        },
        assignedRole: true,
        template: true,
        timeEntries: {
          include: {
            user: {
              select: { id: true, name: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        activities: {
          include: {
            user: {
              select: { id: true, name: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 50
        },
        subtasks: {
          orderBy: { sortOrder: 'asc' }
        },
        comments: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true }
            },
            attachments: true,
            reactions: {
              include: {
                user: {
                  select: { id: true, name: true }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!task) {
      throw new AppError('Task not found', 404);
    }

    // Check permission - admin/PM always has access
    if (!hasElevatedAccess(user)) {
      // Check if user has project access or is assigned to the task
      const hasAccess = await hasProjectAccess(user.id, task.projectId, 'canView');
      const isAssigned = task.assignees.some(a => a.userId === user.id);

      if (!hasAccess && !isAssigned) {
        throw new AppError('Permission denied', 403);
      }
    }

    res.json(task);
  } catch (error) {
    next(error);
  }
});

// Create task
router.post('/', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;
    const { projectId, title, description, status, assigneeIds, dueDate, tags, roleId } = req.body;

    // Validate inputs
    const validTitle = validateTitle(title);
    const validDescription = validateDescription(description);
    validateStatus(status);
    validateTags(tags);

    if (!dueDate) {
      throw new AppError('Due date is required', 400);
    }

    // Any authenticated user can create tasks

    // Validate roleId if provided
    if (roleId) {
      const roleExists = await prisma.role.findUnique({ where: { id: roleId } });
      if (!roleExists) {
        throw new AppError('Invalid role ID', 400);
      }
    }

    // Create task with assignees
    const task = await prisma.task.create({
      data: {
        projectId,
        title: validTitle,
        description: validDescription,
        status: status || 'todo',
        dueDate: dueDate ? new Date(dueDate) : null,
        tags: tags || [],
        roleId: roleId || null,
        assignees: assigneeIds?.length ? {
          create: assigneeIds.map((userId: string) => ({ userId }))
        } : undefined,
      },
      include: {
        project: {
          include: { client: true }
        },
        assignees: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true, telegramChatId: true }
            }
          }
        },
        assignedRole: true
      }
    });

    // Log activity
    await prisma.taskActivity.create({
      data: {
        taskId: task.id,
        userId: user.id,
        action: 'created',
        details: { title }
      }
    });

    // Auto-watch: creator becomes a watcher
    await addWatcher(task.id, user.id);

    // If task has a role, auto-assign contractors with that role
    if (roleId) {
      await assignRoleContractorsToTask(task.id, roleId);
    }

    // Auto-watch assignees and send notifications
    for (const assignee of task.assignees) {
      await addWatcher(task.id, assignee.user.id);
    }
    await notifyTaskAssignees(
      task.assignees.map(a => ({ id: a.user.id, email: a.user.email, telegramChatId: a.user.telegramChatId })),
      user.id,
      user.name,
      task
    );

    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
});

// Update task
router.patch('/:id', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const user = req.user as Express.User;
    const { title, description, status, priority, assigneeIds, dueDate, tags, roleId } = req.body;

    const existingTask = await prisma.task.findUnique({
      where: { id },
      include: { assignees: true, assignedRole: true }
    });
    if (!existingTask) {
      throw new AppError('Task not found', 404);
    }

    // Check permission
    const isAssigned = existingTask.assignees.some(a => a.userId === user.id);
    let canEdit = hasElevatedAccess(user) ||
      user.permissions?.editAllTasks ||
      (user.permissions?.editOwnTasks !== false && isAssigned);

    // Also check project-level edit access
    if (!canEdit && !hasElevatedAccess(user)) {
      canEdit = await hasProjectAccess(user.id, existingTask.projectId, 'canEdit');
    }

    // Allow any user to assign themselves (even without full edit permission)
    // They can also edit other fields in the same request - the guard only checks
    // that they aren't adding/removing other users from the assignee list
    const existingAssigneeIds = existingTask.assignees.map(a => a.userId);
    const newAssigneeIds: string[] = assigneeIds || existingAssigneeIds;
    const isSelfAssignOnly = !canEdit &&
      assigneeIds !== undefined &&
      newAssigneeIds.includes(user.id) &&
      newAssigneeIds.filter(id => !existingAssigneeIds.includes(id)).every(id => id === user.id) &&
      existingAssigneeIds.filter(id => !newAssigneeIds.includes(id)).length === 0;

    // If user can't edit AND isn't just self-assigning, also allow if they're already
    // assigned (which means canEdit should have been true via editOwnTasks)
    if (!canEdit && !isSelfAssignOnly) {
      throw new AppError('Permission denied', 403);
    }

    // Validate fields
    validateStatus(status);
    validatePriority(priority);
    validateTags(tags);

    const updateData: Prisma.TaskUncheckedUpdateInput = {};
    if (title !== undefined) updateData.title = validateTitle(title);
    if (description !== undefined) updateData.description = validateDescription(description);
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'completed' && existingTask.status !== 'completed') {
        updateData.completedAt = new Date();
      } else if (status !== 'completed') {
        updateData.completedAt = null;
      }
    }
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (tags !== undefined) updateData.tags = tags;
    if (roleId !== undefined) updateData.roleId = roleId || null;
    if (priority !== undefined) updateData.priority = priority;

    // Handle assignee changes (existingAssigneeIds and newAssigneeIds declared above)
    const addedAssigneeIds = newAssigneeIds.filter(id => !existingAssigneeIds.includes(id));
    const removedAssigneeIds = existingAssigneeIds.filter(id => !newAssigneeIds.includes(id));

    // Update task and assignees in a transaction
    const task = await prisma.$transaction(async (tx) => {
      // Update task basic fields
      const updatedTask = await tx.task.update({
        where: { id },
        data: updateData,
      });

      // Remove old assignees
      if (assigneeIds !== undefined && removedAssigneeIds.length > 0) {
        await tx.taskAssignee.deleteMany({
          where: {
            taskId: id,
            userId: { in: removedAssigneeIds }
          }
        });
      }

      // Add new assignees
      if (addedAssigneeIds.length > 0) {
        await tx.taskAssignee.createMany({
          data: addedAssigneeIds.map(userId => ({ taskId: id, userId }))
        });
      }

      // Return task with updated assignees
      return tx.task.findUnique({
        where: { id },
        include: {
          project: {
            include: { client: true }
          },
          assignees: {
            include: {
              user: {
                select: { id: true, name: true, email: true, avatarUrl: true, telegramChatId: true }
              }
            }
          },
          assignedRole: true,
          activities: {
            include: {
              user: {
                select: { id: true, name: true }
              }
            },
            orderBy: { createdAt: 'desc' },
            take: 50
          },
          subtasks: {
            orderBy: { sortOrder: 'asc' }
          },
          comments: {
            include: {
              user: {
                select: { id: true, name: true, email: true, avatarUrl: true }
              },
              attachments: true,
              reactions: {
                include: {
                  user: {
                    select: { id: true, name: true }
                  }
                }
              }
            },
            orderBy: { createdAt: 'desc' }
          }
        }
      });
    });

    // Log granular activity changes

    // Track title change
    if (title !== undefined && title !== existingTask.title) {
      await prisma.taskActivity.create({
        data: {
          taskId: id,
          userId: user.id,
          action: 'updated',
          details: { changes: ['title'], from: existingTask.title, to: title }
        }
      });
    }

    // Track status change and notify watchers
    if (status !== undefined && status !== existingTask.status) {
      await prisma.taskActivity.create({
        data: {
          taskId: id,
          userId: user.id,
          action: 'status_changed',
          details: { from: existingTask.status, to: status }
        }
      });

      // Notify watchers of status change
      await notifyWatchers(
        id,
        user.id,
        user.name,
        task!.title,
        'status',
        status
      );
    }

    // Track priority change
    if (priority !== undefined && priority !== existingTask.priority) {
      await prisma.taskActivity.create({
        data: {
          taskId: id,
          userId: user.id,
          action: 'priority_changed',
          details: { from: existingTask.priority, to: priority }
        }
      });
    }

    // Track due date change
    if (dueDate !== undefined) {
      const existingDueDate = existingTask.dueDate?.toISOString().split('T')[0] || null;
      const newDueDate = dueDate ? new Date(dueDate).toISOString().split('T')[0] : null;
      if (existingDueDate !== newDueDate) {
        await prisma.taskActivity.create({
          data: {
            taskId: id,
            userId: user.id,
            action: 'due_date_changed',
            details: { from: existingDueDate, to: newDueDate }
          }
        });
      }
    }

    // Track role change and auto-assign contractors with that role
    if (roleId !== undefined && roleId !== existingTask.roleId) {
      const newRole = roleId ? await prisma.role.findUnique({ where: { id: roleId }, select: { name: true } }) : null;
      await prisma.taskActivity.create({
        data: {
          taskId: id,
          userId: user.id,
          action: 'role_changed',
          details: {
            from: existingTask.roleId,
            to: roleId,
            fromRoleName: existingTask.assignedRole?.name || null,
            roleName: newRole?.name || 'none'
          }
        }
      });

      // Auto-assign contractors with the new role
      if (roleId) {
        await assignRoleContractorsToTask(id, roleId);
      }
    }

    // Track individual assignee changes
    // Batch lookup all changed assignee names to avoid N+1 queries
    const changedUserIds = [...addedAssigneeIds, ...removedAssigneeIds];
    const changedUsers = changedUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: changedUserIds } },
          select: { id: true, name: true }
        })
      : [];
    const userNameMap = new Map(changedUsers.map(u => [u.id, u.name]));

    for (const addedId of addedAssigneeIds) {
      await prisma.taskActivity.create({
        data: {
          taskId: id,
          userId: user.id,
          action: 'assignee_added',
          details: { addedUserId: addedId, userName: userNameMap.get(addedId) || 'Unknown' }
        }
      });
    }

    for (const removedId of removedAssigneeIds) {
      await prisma.taskActivity.create({
        data: {
          taskId: id,
          userId: user.id,
          action: 'assignee_removed',
          details: { removedUserId: removedId, userName: userNameMap.get(removedId) || 'Unknown' }
        }
      });
    }

    // Auto-watch and notify new assignees
    for (const assigneeId of addedAssigneeIds) {
      await addWatcher(id, assigneeId);
    }
    if (addedAssigneeIds.length > 0 && task) {
      const newAssignees = task.assignees
        .filter(a => addedAssigneeIds.includes(a.userId))
        .map(a => ({ id: a.user.id, email: a.user.email, telegramChatId: a.user.telegramChatId }));
      await notifyTaskAssignees(newAssignees, user.id, user.name, task);
    }

    // Notify watchers of assignee changes (if any changes were made)
    if (addedAssigneeIds.length > 0 || removedAssigneeIds.length > 0) {
      await notifyWatchers(
        id,
        user.id,
        user.name,
        task!.title,
        'assignee',
        undefined,
        addedAssigneeIds // Don't notify newly added assignees (they already got assignment notification)
      );
    }

    // Fetch task again with activities included (they were created after the transaction)
    const finalTask = await prisma.task.findUnique({
      where: { id },
      include: {
        project: {
          include: { client: true }
        },
        assignees: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true, telegramChatId: true }
            }
          }
        },
        assignedRole: true,
        activities: {
          include: {
            user: {
              select: { id: true, name: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 50
        },
        subtasks: {
          orderBy: { sortOrder: 'asc' }
        },
        comments: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true }
            },
            attachments: true,
            reactions: {
              include: {
                user: {
                  select: { id: true, name: true }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    res.json(finalTask);
  } catch (error) {
    next(error);
  }
});

// Update task status (for drag/drop)
router.patch('/:id/status', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const user = req.user as Express.User;
    const { status } = req.body;

    const existingTask = await prisma.task.findUnique({
      where: { id },
      include: { assignees: true }
    });
    if (!existingTask) {
      throw new AppError('Task not found', 404);
    }

    // Check permission
    const isAssigned = existingTask.assignees.some(a => a.userId === user.id);
    let canEdit = hasElevatedAccess(user) ||
      user.permissions?.editAllTasks ||
      (user.permissions?.editOwnTasks !== false && isAssigned);

    // Also check project-level edit access
    if (!canEdit && !hasElevatedAccess(user)) {
      canEdit = await hasProjectAccess(user.id, existingTask.projectId, 'canEdit');
    }

    if (!canEdit) {
      throw new AppError('Permission denied', 403);
    }

    validateStatus(status);

    const updateData: Prisma.TaskUncheckedUpdateInput = { status };
    if (status === 'completed' && existingTask.status !== 'completed') {
      updateData.completedAt = new Date();
    } else if (status !== 'completed') {
      updateData.completedAt = null;
    }

    const task = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        project: {
          include: { client: true }
        },
        assignees: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true }
            }
          }
        }
      }
    });

    // Log activity
    await prisma.taskActivity.create({
      data: {
        taskId: task.id,
        userId: user.id,
        action: 'status_changed',
        details: { from: existingTask.status, to: status }
      }
    });

    // Notify watchers of status change
    await notifyWatchers(
      id,
      user.id,
      user.name,
      task.title,
      'status',
      status
    );

    // Fetch task again with activities included
    const finalTask = await prisma.task.findUnique({
      where: { id },
      include: {
        project: {
          include: { client: true }
        },
        assignees: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true }
            }
          }
        },
        assignedRole: true,
        activities: {
          include: {
            user: {
              select: { id: true, name: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 50
        },
        subtasks: {
          orderBy: { sortOrder: 'asc' }
        },
        comments: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true }
            },
            attachments: true,
            reactions: {
              include: {
                user: {
                  select: { id: true, name: true }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    res.json(finalTask);
  } catch (error) {
    next(error);
  }
});

// Delete task
router.delete('/:id', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const user = req.user as Express.User;

    // Only admin/PM can delete
    if (!hasElevatedAccess(user)) {
      throw new AppError('Permission denied', 403);
    }

    await prisma.task.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Archive all completed tasks
router.post('/archive-completed', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;

    // Only admin/PM can archive tasks
    if (!hasElevatedAccess(user)) {
      throw new AppError('Permission denied', 403);
    }

    const result = await prisma.task.updateMany({
      where: {
        status: 'completed',
        archived: false
      },
      data: {
        archived: true,
        archivedAt: new Date()
      }
    });

    res.json({ success: true, count: result.count });
  } catch (error) {
    next(error);
  }
});

// Archive a single task
router.post('/:id/archive', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const user = req.user as Express.User;

    // Only admin/PM can archive tasks
    if (!hasElevatedAccess(user)) {
      throw new AppError('Permission denied', 403);
    }

    const task = await prisma.task.update({
      where: { id },
      data: {
        archived: true,
        archivedAt: new Date()
      }
    });

    res.json(task);
  } catch (error) {
    next(error);
  }
});

// Unarchive a task
router.post('/:id/unarchive', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const user = req.user as Express.User;

    // Only admin/PM can unarchive tasks
    if (!hasElevatedAccess(user)) {
      throw new AppError('Permission denied', 403);
    }

    const task = await prisma.task.update({
      where: { id },
      data: {
        archived: false,
        archivedAt: null
      }
    });

    res.json(task);
  } catch (error) {
    next(error);
  }
});

// ==================== BULK ACTIONS ====================

// Bulk update task status
router.post('/bulk/status', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;
    const { taskIds, status } = req.body;

    if (!hasElevatedAccess(user)) {
      throw new AppError('Permission denied', 403);
    }

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      throw new AppError('taskIds must be a non-empty array', 400);
    }

    validateStatus(status);

    const updateData: Prisma.TaskUncheckedUpdateManyInput = { status };
    if (status === 'completed') {
      updateData.completedAt = new Date();
    } else {
      updateData.completedAt = null;
    }

    const result = await prisma.task.updateMany({
      where: { id: { in: taskIds } },
      data: updateData
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'bulk_status_change',
        entityType: 'tasks',
        entityIds: taskIds,
        details: { newStatus: status, count: result.count }
      }
    });

    // Log individual task activities
    for (const taskId of taskIds) {
      await prisma.taskActivity.create({
        data: {
          taskId,
          userId: user.id,
          action: 'bulk_status_changed',
          details: { to: status }
        }
      });
    }

    res.json({ success: true, count: result.count });
  } catch (error) {
    next(error);
  }
});

// Bulk update task assignees
router.post('/bulk/assignees', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;
    const { taskIds, assigneeIds } = req.body;

    if (!hasElevatedAccess(user)) {
      throw new AppError('Permission denied', 403);
    }

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      throw new AppError('taskIds must be a non-empty array', 400);
    }

    const newAssigneeIds: string[] = assigneeIds || [];

    // Update each task's assignees in a transaction
    await prisma.$transaction(async (tx) => {
      for (const taskId of taskIds) {
        // Remove all existing assignees
        await tx.taskAssignee.deleteMany({
          where: { taskId }
        });

        // Add new assignees
        if (newAssigneeIds.length > 0) {
          await tx.taskAssignee.createMany({
            data: newAssigneeIds.map(userId => ({ taskId, userId }))
          });
        }
      }
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'bulk_assignee_change',
        entityType: 'tasks',
        entityIds: taskIds,
        details: { newAssignees: newAssigneeIds, count: taskIds.length }
      }
    });

    // Notify new assignees
    if (newAssigneeIds.length > 0) {
      const assignees = await prisma.user.findMany({
        where: { id: { in: newAssigneeIds } },
        select: { id: true, email: true, telegramChatId: true }
      });
      const tasks = await prisma.task.findMany({
        where: { id: { in: taskIds } },
        include: { project: { include: { client: true } } }
      });
      for (const task of tasks) {
        await notifyTaskAssignees(assignees, user.id, user.name, task);
      }
    }

    res.json({ success: true, count: taskIds.length });
  } catch (error) {
    next(error);
  }
});

// Bulk delete tasks
router.post('/bulk/delete', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;
    const { taskIds } = req.body;

    if (!hasElevatedAccess(user)) {
      throw new AppError('Permission denied', 403);
    }

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      throw new AppError('taskIds must be a non-empty array', 400);
    }

    const result = await prisma.task.deleteMany({
      where: { id: { in: taskIds } }
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'bulk_delete',
        entityType: 'tasks',
        entityIds: taskIds,
        details: { count: result.count }
      }
    });

    res.json({ success: true, count: result.count });
  } catch (error) {
    next(error);
  }
});

// Bulk archive tasks
router.post('/bulk/archive', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;
    const { taskIds } = req.body;

    if (!hasElevatedAccess(user)) {
      throw new AppError('Permission denied', 403);
    }

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      throw new AppError('taskIds must be a non-empty array', 400);
    }

    const result = await prisma.task.updateMany({
      where: { id: { in: taskIds } },
      data: {
        archived: true,
        archivedAt: new Date()
      }
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'bulk_archive',
        entityType: 'tasks',
        entityIds: taskIds,
        details: { count: result.count }
      }
    });

    res.json({ success: true, count: result.count });
  } catch (error) {
    next(error);
  }
});

// ==================== SUBTASKS ====================

// List subtasks for a task
router.get('/:taskId/subtasks', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskId = req.params.taskId as string;
    const user = req.user as Express.User;

    // Verify task exists and user has access
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { assignees: { select: { userId: true } } }
    });
    if (!task) {
      throw new AppError('Task not found', 404);
    }

    // Check view permission
    const isAssigned = task.assignees.some(a => a.userId === user.id);
    const canView = user.role === 'admin' ||
      user.permissions?.viewAllTasks ||
      isAssigned;

    if (!canView) {
      throw new AppError('Permission denied', 403);
    }

    const subtasks = await prisma.subtask.findMany({
      where: { taskId },
      orderBy: { sortOrder: 'asc' }
    });

    res.json(subtasks);
  } catch (error) {
    next(error);
  }
});

// Create subtask
router.post('/:taskId/subtasks', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskId = req.params.taskId as string;
    const user = req.user as Express.User;
    const { title } = req.body;

    // Verify task exists and user has access
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { assignees: { select: { userId: true } } }
    });
    if (!task) {
      throw new AppError('Task not found', 404);
    }

    // Check permission
    const isAssigned = task.assignees.some(a => a.userId === user.id);
    const canEdit = user.role === 'admin' ||
      hasElevatedAccess(user) ||
      user.permissions?.editAllTasks ||
      (user.permissions?.editOwnTasks !== false && isAssigned);

    if (!canEdit) {
      throw new AppError('Permission denied', 403);
    }

    // Get max sort order
    const lastSubtask = await prisma.subtask.findFirst({
      where: { taskId },
      orderBy: { sortOrder: 'desc' }
    });
    const sortOrder = (lastSubtask?.sortOrder ?? -1) + 1;

    const subtask = await prisma.subtask.create({
      data: {
        taskId,
        title,
        sortOrder
      }
    });

    // Log activity
    await prisma.taskActivity.create({
      data: {
        taskId,
        userId: user.id,
        action: 'subtask_added',
        details: { subtaskId: subtask.id, title: subtask.title }
      }
    });

    res.status(201).json(subtask);
  } catch (error) {
    next(error);
  }
});

// Update subtask
router.patch('/:taskId/subtasks/:subtaskId', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskId = req.params.taskId as string;
    const subtaskId = req.params.subtaskId as string;
    const user = req.user as Express.User;
    const { title, completed, sortOrder } = req.body;

    // Verify task exists and user has access
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { assignees: { select: { userId: true } } }
    });
    if (!task) {
      throw new AppError('Task not found', 404);
    }

    // Check permission
    const isAssigned = task.assignees.some(a => a.userId === user.id);
    const canEdit = user.role === 'admin' ||
      hasElevatedAccess(user) ||
      user.permissions?.editAllTasks ||
      (user.permissions?.editOwnTasks !== false && isAssigned);

    if (!canEdit) {
      throw new AppError('Permission denied', 403);
    }

    // SECURITY: Verify subtask belongs to this task (prevents authorization bypass)
    const existingSubtask = await prisma.subtask.findUnique({ where: { id: subtaskId } });
    if (!existingSubtask || existingSubtask.taskId !== taskId) {
      throw new AppError('Subtask not found', 404);
    }

    const updateData: Prisma.SubtaskUncheckedUpdateInput = {};
    if (title !== undefined) updateData.title = title;
    if (completed !== undefined) {
      updateData.completed = completed;
      updateData.completedAt = completed ? new Date() : null;
    }
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

    const subtask = await prisma.subtask.update({
      where: { id: subtaskId },
      data: updateData
    });

    // Log activity for completion changes
    if (completed !== undefined && completed !== existingSubtask.completed) {
      await prisma.taskActivity.create({
        data: {
          taskId,
          userId: user.id,
          action: completed ? 'subtask_completed' : 'subtask_uncompleted',
          details: { subtaskId: subtask.id, title: subtask.title }
        }
      });
    }

    res.json(subtask);
  } catch (error) {
    next(error);
  }
});

// Delete subtask
router.delete('/:taskId/subtasks/:subtaskId', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskId = req.params.taskId as string;
    const subtaskId = req.params.subtaskId as string;
    const user = req.user as Express.User;

    // Verify task exists and user has access
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { assignees: { select: { userId: true } } }
    });
    if (!task) {
      throw new AppError('Task not found', 404);
    }

    // Check permission
    const isAssigned = task.assignees.some(a => a.userId === user.id);
    const canEdit = user.role === 'admin' ||
      hasElevatedAccess(user) ||
      user.permissions?.editAllTasks ||
      (user.permissions?.editOwnTasks !== false && isAssigned);

    if (!canEdit) {
      throw new AppError('Permission denied', 403);
    }

    // SECURITY: Verify subtask belongs to this task (prevents authorization bypass)
    const existingSubtask = await prisma.subtask.findUnique({ where: { id: subtaskId } });
    if (!existingSubtask || existingSubtask.taskId !== taskId) {
      throw new AppError('Subtask not found', 404);
    }

    await prisma.subtask.delete({ where: { id: subtaskId } });

    // Log activity
    await prisma.taskActivity.create({
      data: {
        taskId,
        userId: user.id,
        action: 'subtask_deleted',
        details: { title: existingSubtask.title }
      }
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ==================== COMMENTS ====================

// List comments for a task
router.get('/:taskId/comments', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskId = req.params.taskId as string;
    const user = req.user as Express.User;

    // Verify task exists and user has access
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { assignees: { select: { userId: true } } }
    });
    if (!task) {
      throw new AppError('Task not found', 404);
    }

    // Any authenticated user can view comments
    const comments = await prisma.taskComment.findMany({
      where: { taskId },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true }
        },
        attachments: true,
        reactions: {
          include: {
            user: {
              select: { id: true, name: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(comments);
  } catch (error) {
    next(error);
  }
});

// Create comment
router.post('/:taskId/comments', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskId = req.params.taskId as string;
    const user = req.user as Express.User;
    const content = validateComment(req.body.content);

    // Verify task exists
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignees: { select: { userId: true } },
        project: {
          include: { client: { select: { name: true } } }
        }
      }
    });
    if (!task) {
      throw new AppError('Task not found', 404);
    }

    // Any authenticated user can comment
    const comment = await prisma.taskComment.create({
      data: {
        taskId,
        userId: user.id,
        userName: user.name,
        content
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true }
        },
        attachments: true
      }
    });

    // Parse and handle @mentions
    const mentions = parseMentions(content);
    if (mentions.length > 0) {
      const mentionedUserIds = await resolveMentions(mentions);
      // Filter out the comment author
      const usersToNotify = mentionedUserIds.filter(id => id !== user.id);

      if (usersToNotify.length > 0) {
        // Create mention records
        await createMentionRecords(comment.id, usersToNotify);

        // Send email notifications in parallel (batched, not N+1)
        const mentionedUsers = await prisma.user.findMany({
          where: { id: { in: usersToNotify } },
          select: { id: true, email: true, telegramChatId: true }
        });

        const contentPreview = content.substring(0, 100);

        // Send push notifications (check preferences)
        await Promise.allSettled(
          mentionedUsers.map(async (mentionedUser) => {
            if (await shouldNotify(mentionedUser.id, 'mentions', 'push')) {
              await sendMentionPush(
                mentionedUser.id,
                user.name,
                task.title,
                task.id,
                contentPreview
              );
            }
          })
        );

        // Send email notifications (check preferences)
        await Promise.allSettled(
          mentionedUsers.map(async (mentionedUser) => {
            if (await shouldNotify(mentionedUser.id, 'mentions', 'email')) {
              await sendMentionNotificationEmail(
                mentionedUser.email,
                user.name,
                task.title,
                task.id,
                contentPreview
              );
            }
          })
        );

        // Send Telegram notifications with reply instructions (check preferences)
        // Get sender's name for @mention (lowercase, no spaces)
        const senderMentionName = user.name.toLowerCase().replace(/\s+/g, '');
        const clientName = task.project?.client?.name || 'Unknown Client';
        const projectName = task.project?.name || 'Unknown Project';
        const telegramCaption = `💬 <b>${escapeTelegramHtml(user.name)}</b> (@${escapeTelegramHtml(senderMentionName)}) mentioned you in "${escapeTelegramHtml(task.title)}":\n\n📁 <b>${escapeTelegramHtml(clientName)}</b> › ${escapeTelegramHtml(projectName)}\n\n"${escapeTelegramHtml(content)}"\n\n<i>Reply to this message to respond, or use @${escapeTelegramHtml(senderMentionName)}</i>`;

        // Check for attachments
        const attachment = comment.attachments?.[0];

        // Send Telegram notifications and store mappings for reply tracking
        const telegramUsersToNotify = mentionedUsers.filter((u) => u.telegramChatId);

        if (attachment) {
          const fileUrl = await getSignedDownloadUrl(attachment.storageKey);
          const isImage = attachment.fileType.startsWith('image/');

          for (const mentionedUser of telegramUsersToNotify) {
            if (await shouldNotify(mentionedUser.id, 'mentions', 'telegram')) {
              const result = isImage
                ? await sendTelegramPhoto(mentionedUser.telegramChatId!, fileUrl, telegramCaption)
                : await sendTelegramDocument(mentionedUser.telegramChatId!, fileUrl, attachment.fileName, telegramCaption);

              if (result.success && result.messageId) {
                await storeTelegramMessageMapping(
                  result.messageId,
                  task.id,
                  mentionedUser.id,
                  user.id
                );
              }
            }
          }
        } else {
          for (const mentionedUser of telegramUsersToNotify) {
            if (await shouldNotify(mentionedUser.id, 'mentions', 'telegram')) {
              const result = await sendTelegramMessage(mentionedUser.telegramChatId!, telegramCaption);

              if (result.success && result.messageId) {
                await storeTelegramMessageMapping(
                  result.messageId,
                  task.id,
                  mentionedUser.id,
                  user.id
                );
              }
            }
          }
        }

        // Mark as notified
        await markMentionsNotified(comment.id);
      }
    }

    // Log activity
    await prisma.taskActivity.create({
      data: {
        taskId,
        userId: user.id,
        action: 'commented',
        details: { preview: content.substring(0, 100) }
      }
    });

    // Auto-watch: commenter becomes a watcher
    await addWatcher(taskId, user.id);

    // Get mentioned user IDs to exclude from watcher notifications (they already got mention notification)
    const mentionedUserIds = mentions.length > 0 ? await resolveMentions(mentions) : [];

    // Notify watchers of new comment (excluding commenter and mentioned users)
    await notifyWatchers(
      taskId,
      user.id,
      user.name,
      task.title,
      'comment',
      content.substring(0, 100),
      mentionedUserIds
    );

    res.status(201).json(comment);
  } catch (error) {
    next(error);
  }
});

// Update comment
router.patch('/:taskId/comments/:commentId', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const commentId = req.params.commentId as string;
    const user = req.user as Express.User;
    const { content } = req.body;

    const existingComment = await prisma.taskComment.findUnique({ where: { id: commentId } });
    if (!existingComment) {
      throw new AppError('Comment not found', 404);
    }

    // Only comment author or admin/PM can edit
    if (existingComment.userId !== user.id && !hasElevatedAccess(user)) {
      throw new AppError('Permission denied', 403);
    }

    const comment = await prisma.taskComment.update({
      where: { id: commentId },
      data: { content },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true }
        }
      }
    });

    res.json(comment);
  } catch (error) {
    next(error);
  }
});

// Delete comment
router.delete('/:taskId/comments/:commentId', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const commentId = req.params.commentId as string;
    const user = req.user as Express.User;

    const existingComment = await prisma.taskComment.findUnique({ where: { id: commentId } });
    if (!existingComment) {
      throw new AppError('Comment not found', 404);
    }

    // Only comment author or admin/PM can delete
    if (existingComment.userId !== user.id && !hasElevatedAccess(user)) {
      throw new AppError('Permission denied', 403);
    }

    await prisma.taskComment.delete({ where: { id: commentId } });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Valid emoji keys for reactions
const VALID_EMOJIS = ['thumbsup', 'thumbsdown', 'heart', 'laugh', 'surprised', 'sad', 'party'];

const EMOJI_DISPLAY: Record<string, string> = {
  thumbsup: '👍',
  thumbsdown: '👎',
  heart: '❤️',
  laugh: '😄',
  surprised: '😮',
  sad: '😢',
  party: '🎉',
};

// Toggle reaction on a comment (add if not exists, remove if exists)
router.post('/:taskId/comments/:commentId/reactions', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskId = req.params.taskId as string;
    const commentId = req.params.commentId as string;
    const user = req.user as Express.User;
    const { emoji } = req.body;

    // Validate emoji
    if (!emoji || !VALID_EMOJIS.includes(emoji)) {
      throw new AppError('Invalid emoji. Must be one of: ' + VALID_EMOJIS.join(', '), 400);
    }

    // Verify comment exists and belongs to task, get author info
    const comment = await prisma.taskComment.findUnique({
      where: { id: commentId },
      include: {
        user: {
          select: { id: true, name: true, telegramChatId: true }
        },
        task: {
          select: {
            id: true,
            title: true,
            project: {
              include: { client: { select: { name: true } } }
            }
          }
        }
      }
    });
    if (!comment || comment.taskId !== taskId) {
      throw new AppError('Comment not found', 404);
    }

    // Check if reaction already exists
    const existingReaction = await prisma.commentReaction.findUnique({
      where: {
        commentId_userId_emoji: {
          commentId,
          userId: user.id,
          emoji
        }
      }
    });

    let isNewReaction = false;

    if (existingReaction) {
      // Remove reaction
      await prisma.commentReaction.delete({
        where: { id: existingReaction.id }
      });
    } else {
      // Add reaction
      await prisma.commentReaction.create({
        data: {
          commentId,
          userId: user.id,
          emoji
        }
      });
      isNewReaction = true;
    }

    // Notify comment author via Telegram (only for new reactions, not removals)
    // Don't notify if user is reacting to their own comment
    if (isNewReaction && comment.user && comment.user.id !== user.id && comment.user.telegramChatId) {
      const emojiIcon = EMOJI_DISPLAY[emoji] || emoji;
      const clientName = comment.task.project?.client?.name || 'Unknown Client';
      const projectName = comment.task.project?.name || 'Unknown Project';
      const telegramMessage = `${emojiIcon} <b>${escapeTelegramHtml(user.name)}</b> reacted to your comment in "${escapeTelegramHtml(comment.task.title)}":\n\n📁 <b>${escapeTelegramHtml(clientName)}</b> › ${escapeTelegramHtml(projectName)}\n\n"${escapeTelegramHtml(comment.content)}"`;

      sendTelegramMessage(comment.user.telegramChatId, telegramMessage);
    }

    // Return updated reactions for this comment
    const reactions = await prisma.commentReaction.findMany({
      where: { commentId },
      include: {
        user: {
          select: { id: true, name: true }
        }
      }
    });

    res.json({ reactions });
  } catch (error) {
    next(error);
  }
});

// Upload attachment to a comment
router.post('/:taskId/comments/:commentId/attachments', isAuthenticated, commentUpload.array('files', 10), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskId = req.params.taskId as string;
    const commentId = req.params.commentId as string;
    const user = req.user as Express.User;

    const files = req.files as Express.Multer.File[] | undefined;
    const singleFile = req.file;
    const uploadFiles = files?.length ? files : singleFile ? [singleFile] : [];

    if (uploadFiles.length === 0) {
      throw new AppError('No file uploaded', 400);
    }

    if (!isStorageConfigured()) {
      throw new AppError('Cloud storage not configured', 500);
    }

    // Verify task exists
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { assignees: { select: { userId: true } } }
    });
    if (!task) {
      throw new AppError('Task not found', 404);
    }

    // Verify comment exists and belongs to this task
    const comment = await prisma.taskComment.findUnique({
      where: { id: commentId }
    });
    if (!comment || comment.taskId !== taskId) {
      throw new AppError('Comment not found', 404);
    }

    // Only comment author or admin/PM can add attachments
    if (comment.userId !== user.id && !hasElevatedAccess(user)) {
      throw new AppError('Permission denied', 403);
    }

    // Upload all files to R2 and create attachment records
    const attachments = await Promise.all(uploadFiles.map(async (file) => {
      const storageKey = generateStorageKey('comments', file.originalname);
      await uploadFile(storageKey, file.buffer, file.mimetype);

      return prisma.commentAttachment.create({
        data: {
          commentId,
          fileName: file.originalname,
          fileSize: file.size,
          fileType: file.mimetype,
          storageKey
        }
      });
    }));

    res.status(201).json(attachments);
  } catch (error) {
    next(error);
  }
});

// Create comment with attachment (combined endpoint)
router.post('/:taskId/comments-with-attachment', isAuthenticated, commentUpload.array('files', 10), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskId = req.params.taskId as string;
    const user = req.user as Express.User;
    const content = req.body.content ? validateComment(req.body.content) : '';

    // Support both multi-file (files) and legacy single-file (file)
    const files = req.files as Express.Multer.File[] | undefined;
    const singleFile = req.file;
    const uploadFiles = files?.length ? files : singleFile ? [singleFile] : [];

    // Verify task exists
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignees: { select: { userId: true } },
        project: {
          include: { client: { select: { name: true } } }
        }
      }
    });
    if (!task) {
      throw new AppError('Task not found', 404);
    }

    // Check permission - anyone who can view the task can comment
    const isAssigned = task.assignees.some(a => a.userId === user.id);
    const canView = user.role === 'admin' ||
      hasElevatedAccess(user) ||
      user.permissions?.viewAllTasks ||
      isAssigned;

    if (!canView) {
      throw new AppError('Permission denied', 403);
    }

    // Require either content or file(s)
    if (!content && uploadFiles.length === 0) {
      throw new AppError('Comment must have content or an attachment', 400);
    }

    // Check storage is configured if uploading files
    if (uploadFiles.length > 0 && !isStorageConfigured()) {
      throw new AppError('Cloud storage not configured', 500);
    }

    // Upload all files to R2
    const uploadedFiles: { fileName: string; fileSize: number; fileType: string; storageKey: string }[] = [];
    for (const file of uploadFiles) {
      const storageKey = generateStorageKey('comments', file.originalname);
      await uploadFile(storageKey, file.buffer, file.mimetype);
      uploadedFiles.push({
        fileName: file.originalname,
        fileSize: file.size,
        fileType: file.mimetype,
        storageKey
      });
    }

    // Create comment with optional attachments
    const fileNames = uploadFiles.map(f => f.originalname).join(', ');
    const commentData: Prisma.TaskCommentCreateInput = {
      task: { connect: { id: taskId } },
      user: { connect: { id: user.id } },
      userName: user.name,
      content: content || (uploadFiles.length > 0 ? `Shared ${uploadFiles.length === 1 ? 'a file' : `${uploadFiles.length} files`}: ${fileNames}` : '')
    };

    if (uploadedFiles.length > 0) {
      commentData.attachments = {
        create: uploadedFiles
      };
    }

    const comment = await prisma.taskComment.create({
      data: commentData,
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true }
        },
        attachments: true
      }
    });

    // Parse and handle @mentions
    if (content) {
      const mentions = parseMentions(content);
      if (mentions.length > 0) {
        const mentionedUserIds = await resolveMentions(mentions);
        const usersToNotify = mentionedUserIds.filter(id => id !== user.id);

        if (usersToNotify.length > 0) {
          await createMentionRecords(comment.id, usersToNotify);

          const mentionedUsers = await prisma.user.findMany({
            where: { id: { in: usersToNotify } },
            select: { id: true, email: true, telegramChatId: true }
          });

          const contentPreview = content.substring(0, 100);

          // Send push notifications (check preferences)
          await Promise.allSettled(
            mentionedUsers.map(async (mentionedUser) => {
              if (await shouldNotify(mentionedUser.id, 'mentions', 'push')) {
                await sendMentionPush(
                  mentionedUser.id,
                  user.name,
                  task.title,
                  task.id,
                  contentPreview
                );
              }
            })
          );

          // Send email notifications (check preferences)
          await Promise.allSettled(
            mentionedUsers.map(async (mentionedUser) => {
              if (await shouldNotify(mentionedUser.id, 'mentions', 'email')) {
                await sendMentionNotificationEmail(
                  mentionedUser.email,
                  user.name,
                  task.title,
                  task.id,
                  contentPreview
                );
              }
            })
          );

          // Send Telegram notifications with reply instructions (check preferences)
          const senderMentionName = user.name.toLowerCase().replace(/\s+/g, '');
          const clientName = task.project?.client?.name || 'Unknown Client';
          const projectName = task.project?.name || 'Unknown Project';
          const telegramCaption = `💬 <b>${escapeTelegramHtml(user.name)}</b> (@${escapeTelegramHtml(senderMentionName)}) mentioned you in "${escapeTelegramHtml(task.title)}":\n\n📁 <b>${escapeTelegramHtml(clientName)}</b> › ${escapeTelegramHtml(projectName)}\n\n"${escapeTelegramHtml(content)}"\n\n<i>Reply to this message to respond, or use @${escapeTelegramHtml(senderMentionName)}</i>`;

          // Check for attachments
          const attachment = comment.attachments?.[0];

          // Send Telegram notifications and store mappings for reply tracking
          const telegramUsersToNotify = mentionedUsers.filter((u) => u.telegramChatId);

          if (attachment) {
            const fileUrl = await getSignedDownloadUrl(attachment.storageKey);
            const isImage = attachment.fileType.startsWith('image/');

            for (const mentionedUser of telegramUsersToNotify) {
              if (await shouldNotify(mentionedUser.id, 'mentions', 'telegram')) {
                const result = isImage
                  ? await sendTelegramPhoto(mentionedUser.telegramChatId!, fileUrl, telegramCaption)
                  : await sendTelegramDocument(mentionedUser.telegramChatId!, fileUrl, attachment.fileName, telegramCaption);

                if (result.success && result.messageId) {
                  await storeTelegramMessageMapping(
                    result.messageId,
                    task.id,
                    mentionedUser.id,
                    user.id
                  );
                }
              }
            }
          } else {
            for (const mentionedUser of telegramUsersToNotify) {
              if (await shouldNotify(mentionedUser.id, 'mentions', 'telegram')) {
                const result = await sendTelegramMessage(mentionedUser.telegramChatId!, telegramCaption);

                if (result.success && result.messageId) {
                  await storeTelegramMessageMapping(
                    result.messageId,
                    task.id,
                    mentionedUser.id,
                    user.id
                  );
                }
              }
            }
          }

          await markMentionsNotified(comment.id);
        }
      }
    }

    // Log activity
    await prisma.taskActivity.create({
      data: {
        taskId,
        userId: user.id,
        action: 'commented',
        details: {
          preview: content ? content.substring(0, 100) : 'Shared a file',
          hasAttachment: !!req.file
        }
      }
    });

    // Auto-watch: commenter becomes a watcher
    await addWatcher(taskId, user.id);

    // Get mentioned user IDs to exclude from watcher notifications
    let mentionedUserIds: string[] = [];
    if (content) {
      const mentions = parseMentions(content);
      if (mentions.length > 0) {
        mentionedUserIds = await resolveMentions(mentions);
      }
    }

    // Notify watchers of new comment (excluding commenter and mentioned users)
    await notifyWatchers(
      taskId,
      user.id,
      user.name,
      task.title,
      'comment',
      content ? content.substring(0, 100) : 'Shared a file',
      mentionedUserIds
    );

    res.status(201).json(comment);
  } catch (error) {
    next(error);
  }
});

// Get signed URL for comment attachment (returns JSON)
router.get('/:taskId/comments/:commentId/attachments/:attachmentId/url', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskId = req.params.taskId as string;
    const commentId = req.params.commentId as string;
    const attachmentId = req.params.attachmentId as string;
    const user = req.user as Express.User;

    // Verify task exists and user has access
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { assignees: { select: { userId: true } } }
    });
    if (!task) {
      throw new AppError('Task not found', 404);
    }

    // Check view permission
    const isAssigned = task.assignees.some(a => a.userId === user.id);
    const canView = user.role === 'admin' ||
      hasElevatedAccess(user) ||
      user.permissions?.viewAllTasks ||
      isAssigned;

    if (!canView) {
      throw new AppError('Permission denied', 403);
    }

    // Get attachment
    const attachment = await prisma.commentAttachment.findUnique({
      where: { id: attachmentId },
      include: { comment: true }
    });

    if (!attachment || attachment.comment.taskId !== taskId || attachment.commentId !== commentId) {
      throw new AppError('Attachment not found', 404);
    }

    // Get signed URL from R2
    const signedUrl = await getSignedDownloadUrl(attachment.storageKey);
    res.json({ url: signedUrl });
  } catch (error) {
    next(error);
  }
});

// Serve comment attachment file (redirect to signed R2 URL)
router.get('/:taskId/comments/:commentId/attachments/:attachmentId', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskId = req.params.taskId as string;
    const commentId = req.params.commentId as string;
    const attachmentId = req.params.attachmentId as string;
    const user = req.user as Express.User;

    // Verify task exists and user has access
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { assignees: { select: { userId: true } } }
    });
    if (!task) {
      throw new AppError('Task not found', 404);
    }

    // Check view permission
    const isAssigned = task.assignees.some(a => a.userId === user.id);
    const canView = user.role === 'admin' ||
      hasElevatedAccess(user) ||
      user.permissions?.viewAllTasks ||
      isAssigned;

    if (!canView) {
      throw new AppError('Permission denied', 403);
    }

    // Get attachment
    const attachment = await prisma.commentAttachment.findUnique({
      where: { id: attachmentId },
      include: { comment: true }
    });

    if (!attachment || attachment.comment.taskId !== taskId || attachment.commentId !== commentId) {
      throw new AppError('Attachment not found', 404);
    }

    // Get signed URL from R2 and redirect
    const signedUrl = await getSignedDownloadUrl(attachment.storageKey);
    res.redirect(signedUrl);
  } catch (error) {
    next(error);
  }
});

// Delete comment attachment
router.delete('/:taskId/comments/:commentId/attachments/:attachmentId', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskId = req.params.taskId as string;
    const commentId = req.params.commentId as string;
    const attachmentId = req.params.attachmentId as string;
    const user = req.user as Express.User;

    // Verify comment exists and belongs to this task
    const comment = await prisma.taskComment.findUnique({
      where: { id: commentId }
    });
    if (!comment || comment.taskId !== taskId) {
      throw new AppError('Comment not found', 404);
    }

    // Only comment author or admin/PM can delete attachments
    if (comment.userId !== user.id && !hasElevatedAccess(user)) {
      throw new AppError('Permission denied', 403);
    }

    // Get attachment and verify it belongs to this comment
    const attachment = await prisma.commentAttachment.findUnique({
      where: { id: attachmentId }
    });
    if (!attachment || attachment.commentId !== commentId) {
      throw new AppError('Attachment not found', 404);
    }

    // Delete file from R2
    try {
      await deleteFile(attachment.storageKey);
    } catch (err) {
      console.error('Failed to delete file from R2:', err);
      // Continue to delete record even if R2 delete fails
    }

    // Delete attachment record
    await prisma.commentAttachment.delete({ where: { id: attachmentId } });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ==================== WATCHERS ====================

// List watchers for a task
router.get('/:id/watchers', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    const task = await prisma.task.findUnique({
      where: { id },
      select: { id: true }
    });
    if (!task) {
      throw new AppError('Task not found', 404);
    }

    const watchers = await prisma.taskWatcher.findMany({
      where: { taskId: id },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json(watchers);
  } catch (error) {
    next(error);
  }
});

// Add watcher to a task (self or others if admin/PM)
router.post('/:id/watchers', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const user = req.user as Express.User;
    const { userId } = req.body;

    const targetUserId = userId || user.id;

    // Only admin/PM can add others as watchers
    if (targetUserId !== user.id && !hasElevatedAccess(user)) {
      throw new AppError('Permission denied', 403);
    }

    const task = await prisma.task.findUnique({
      where: { id },
      select: { id: true }
    });
    if (!task) {
      throw new AppError('Task not found', 404);
    }

    // Check if already watching
    const existing = await prisma.taskWatcher.findUnique({
      where: { taskId_userId: { taskId: id, userId: targetUserId } },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true }
        }
      }
    });
    if (existing) {
      return res.json(existing);
    }

    const watcher = await prisma.taskWatcher.create({
      data: {
        taskId: id,
        userId: targetUserId
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true }
        }
      }
    });

    res.status(201).json(watcher);
  } catch (error) {
    next(error);
  }
});

// Toggle mute for current user (must be before /:id/watchers/:userId to avoid param matching)
router.patch('/:id/watchers/mute', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const user = req.user as Express.User;
    const { muted } = req.body;

    const task = await prisma.task.findUnique({
      where: { id },
      select: { id: true }
    });
    if (!task) {
      throw new AppError('Task not found', 404);
    }

    const watcher = await prisma.taskWatcher.findUnique({
      where: { taskId_userId: { taskId: id, userId: user.id } }
    });
    if (!watcher) {
      throw new AppError('You are not watching this task', 400);
    }

    const updated = await prisma.taskWatcher.update({
      where: { id: watcher.id },
      data: { muted: muted === true },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true }
        }
      }
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Remove watcher from a task
router.delete('/:id/watchers/:userId', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const targetUserId = req.params.userId as string;
    const user = req.user as Express.User;

    // Only admin/PM can remove others, or user can remove themselves
    if (targetUserId !== user.id && !hasElevatedAccess(user)) {
      throw new AppError('Permission denied', 403);
    }

    const task = await prisma.task.findUnique({
      where: { id },
      select: { id: true }
    });
    if (!task) {
      throw new AppError('Task not found', 404);
    }

    await prisma.taskWatcher.deleteMany({
      where: { taskId: id, userId: targetUserId }
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
