import { Router, Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/client.js';
import { isAuthenticated } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { sendTaskAssignedEmail, sendTaskOverdueEmail, sendMentionNotificationEmail } from '../services/email.js';
import { sendTelegramMessage, sendTelegramPhoto, sendTelegramDocument, escapeTelegramHtml } from '../services/telegram.js';
import { parseMentions, resolveMentions, createMentionRecords, markMentionsNotified } from '../utils/mentions.js';
import { validateTitle, validateDescription, validateComment, INPUT_LIMITS } from '../utils/validation.js';
import { uploadFile, getSignedDownloadUrl, deleteFile, generateStorageKey, isStorageConfigured } from '../services/storage.js';
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

// List tasks with filters
router.get('/', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;
    const { status, assignedTo, projectId, clientId, tag, roleId, dueBefore, dueAfter, includeArchived } = req.query;

    const where: Prisma.TaskWhereInput = {
      // By default, exclude archived tasks
      archived: includeArchived === 'true' ? undefined : false
    };

    // Permission-based filtering for contractors (admins and project managers see all)
    if (!hasElevatedAccess(user)) {
      // Get project access for this user
      const projectAccess = await getUserProjectAccess(user.id);
      const allowedProjectIds = projectAccess.map(pa => pa.projectId);

      if (allowedProjectIds.length > 0) {
        // Contractor has explicit project access - show tasks from those projects
        // Plus tasks assigned to them (even from other projects)
        where.OR = [
          { projectId: { in: allowedProjectIds } },
          { assignees: { some: { userId: user.id } } }
        ];
      } else if (user.permissions?.viewOwnTasksOnly !== false) {
        // No explicit project access and viewOwnTasksOnly is true - only show assigned tasks
        where.assignees = { some: { userId: user.id } };
      }
      // If viewAllTasks is true but no project access, they see nothing from restricted projects
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
            attachments: true
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

    // Check permission to create tasks
    if (!hasElevatedAccess(user)) {
      // Check if user has edit access to the project
      const hasAccess = await hasProjectAccess(user.id, projectId, 'canEdit');
      if (!hasAccess && !user.permissions?.editAllTasks) {
        throw new AppError('Permission denied', 403);
      }
    }

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

    // Send email and Telegram notifications to assignees
    for (const assignee of task.assignees) {
      if (assignee.user.email !== user.email) {
        await sendTaskAssignedEmail(assignee.user.email, task);
      }
      if (assignee.user.telegramChatId && assignee.user.id !== user.id) {
        await sendTelegramMessage(
          assignee.user.telegramChatId,
          `📋 <b>New task assigned to you</b>\n\n"${escapeTelegramHtml(task.title)}"\n\nProject: ${escapeTelegramHtml(task.project.client.name)}`
        );
      }
    }

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

    if (!canEdit) {
      throw new AppError('Permission denied', 403);
    }

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

    // Handle assignee changes
    const existingAssigneeIds = existingTask.assignees.map(a => a.userId);
    const newAssigneeIds: string[] = assigneeIds || [];
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

    // Track status change
    if (status !== undefined && status !== existingTask.status) {
      await prisma.taskActivity.create({
        data: {
          taskId: id,
          userId: user.id,
          action: 'status_changed',
          details: { from: existingTask.status, to: status }
        }
      });
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

    // Track role change
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
    }

    // Track individual assignee changes
    for (const addedId of addedAssigneeIds) {
      const addedUser = await prisma.user.findUnique({ where: { id: addedId }, select: { name: true } });
      await prisma.taskActivity.create({
        data: {
          taskId: id,
          userId: user.id,
          action: 'assignee_added',
          details: { addedUserId: addedId, userName: addedUser?.name || 'Unknown' }
        }
      });
    }

    for (const removedId of removedAssigneeIds) {
      const removedUser = await prisma.user.findUnique({ where: { id: removedId }, select: { name: true } });
      await prisma.taskActivity.create({
        data: {
          taskId: id,
          userId: user.id,
          action: 'assignee_removed',
          details: { removedUserId: removedId, userName: removedUser?.name || 'Unknown' }
        }
      });
    }

    // Notify new assignees
    for (const assigneeId of addedAssigneeIds) {
      const assignee = task?.assignees.find(a => a.userId === assigneeId);
      if (assignee && assignee.user.email !== user.email) {
        await sendTaskAssignedEmail(assignee.user.email, task);
      }
      if (assignee?.user.telegramChatId && assignee.user.id !== user.id) {
        await sendTelegramMessage(
          assignee.user.telegramChatId,
          `📋 <b>New task assigned to you</b>\n\n"${escapeTelegramHtml(task!.title)}"\n\nProject: ${escapeTelegramHtml(task!.project.client.name)}`
        );
      }
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
            attachments: true
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
            attachments: true
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
      for (const assignee of assignees) {
        if (assignee.email !== user.email) {
          for (const task of tasks) {
            await sendTaskAssignedEmail(assignee.email, task);
          }
        }
        if (assignee.telegramChatId && assignee.id !== user.id) {
          for (const task of tasks) {
            await sendTelegramMessage(
              assignee.telegramChatId,
              `📋 <b>New task assigned to you</b>\n\n"${escapeTelegramHtml(task.title)}"\n\nProject: ${escapeTelegramHtml(task.project.client.name)}`
            );
          }
        }
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

    // Check view permission
    const isAssigned = task.assignees.some(a => a.userId === user.id);
    const canView = user.role === 'admin' ||
      hasElevatedAccess(user) ||
      user.permissions?.viewAllTasks ||
      isAssigned;

    if (!canView) {
      throw new AppError('Permission denied', 403);
    }

    const comments = await prisma.taskComment.findMany({
      where: { taskId },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true }
        },
        attachments: true
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
      include: { assignees: { select: { userId: true } } }
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
        await Promise.allSettled(
          mentionedUsers.map((mentionedUser) =>
            sendMentionNotificationEmail(
              mentionedUser.email,
              user.name,
              task.title,
              task.id,
              contentPreview
            ).catch((err) => console.error(`Failed to send mention email to ${mentionedUser.email}:`, err))
          )
        );

        // Send Telegram notifications
        const telegramCaption = `💬 <b>${escapeTelegramHtml(user.name)}</b> mentioned you in "${escapeTelegramHtml(task.title)}":\n\n${escapeTelegramHtml(contentPreview)}${content.length > 100 ? '...' : ''}`;

        // Check for attachments
        const attachment = comment.attachments?.[0];

        if (attachment) {
          const fileUrl = await getSignedDownloadUrl(attachment.storageKey);
          const isImage = attachment.fileType.startsWith('image/');

          await Promise.allSettled(
            mentionedUsers
              .filter((u) => u.telegramChatId)
              .map((mentionedUser) =>
                isImage
                  ? sendTelegramPhoto(mentionedUser.telegramChatId!, fileUrl, telegramCaption)
                  : sendTelegramDocument(mentionedUser.telegramChatId!, fileUrl, attachment.fileName, telegramCaption)
              )
          );
        } else {
          await Promise.allSettled(
            mentionedUsers
              .filter((u) => u.telegramChatId)
              .map((mentionedUser) =>
                sendTelegramMessage(mentionedUser.telegramChatId!, telegramCaption)
              )
          );
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

// Upload attachment to a comment
router.post('/:taskId/comments/:commentId/attachments', isAuthenticated, commentUpload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskId = req.params.taskId as string;
    const commentId = req.params.commentId as string;
    const user = req.user as Express.User;

    if (!req.file) {
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

    // Upload to R2
    const storageKey = generateStorageKey('comments', req.file.originalname);
    await uploadFile(storageKey, req.file.buffer, req.file.mimetype);

    // Create attachment record
    const attachment = await prisma.commentAttachment.create({
      data: {
        commentId,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        fileType: req.file.mimetype,
        storageKey
      }
    });

    res.status(201).json(attachment);
  } catch (error) {
    next(error);
  }
});

// Create comment with attachment (combined endpoint)
router.post('/:taskId/comments-with-attachment', isAuthenticated, commentUpload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskId = req.params.taskId as string;
    const user = req.user as Express.User;
    const content = req.body.content ? validateComment(req.body.content) : '';

    // Verify task exists
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { assignees: { select: { userId: true } } }
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

    // Require either content or file
    if (!content && !req.file) {
      throw new AppError('Comment must have content or an attachment', 400);
    }

    // Check storage is configured if uploading file
    if (req.file && !isStorageConfigured()) {
      throw new AppError('Cloud storage not configured', 500);
    }

    // Upload file to R2 if present
    let storageKey: string | undefined;
    if (req.file) {
      storageKey = generateStorageKey('comments', req.file.originalname);
      await uploadFile(storageKey, req.file.buffer, req.file.mimetype);
    }

    // Create comment with optional attachment
    const commentData: Prisma.TaskCommentCreateInput = {
      task: { connect: { id: taskId } },
      user: { connect: { id: user.id } },
      userName: user.name,
      content: content || (req.file ? `Shared a file: ${req.file.originalname}` : '')
    };

    if (req.file && storageKey) {
      commentData.attachments = {
        create: {
          fileName: req.file.originalname,
          fileSize: req.file.size,
          fileType: req.file.mimetype,
          storageKey
        }
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
          await Promise.allSettled(
            mentionedUsers.map((mentionedUser) =>
              sendMentionNotificationEmail(
                mentionedUser.email,
                user.name,
                task.title,
                task.id,
                contentPreview
              ).catch((err) => console.error(`Failed to send mention email to ${mentionedUser.email}:`, err))
            )
          );

          // Send Telegram notifications
          const telegramCaption = `💬 <b>${escapeTelegramHtml(user.name)}</b> mentioned you in "${escapeTelegramHtml(task.title)}":\n\n${escapeTelegramHtml(contentPreview)}${content.length > 100 ? '...' : ''}`;

          // Check for attachments
          const attachment = comment.attachments?.[0];

          if (attachment) {
            const fileUrl = await getSignedDownloadUrl(attachment.storageKey);
            const isImage = attachment.fileType.startsWith('image/');

            await Promise.allSettled(
              mentionedUsers
                .filter((u) => u.telegramChatId)
                .map((mentionedUser) =>
                  isImage
                    ? sendTelegramPhoto(mentionedUser.telegramChatId!, fileUrl, telegramCaption)
                    : sendTelegramDocument(mentionedUser.telegramChatId!, fileUrl, attachment.fileName, telegramCaption)
                )
            );
          } else {
            await Promise.allSettled(
              mentionedUsers
                .filter((u) => u.telegramChatId)
                .map((mentionedUser) =>
                  sendTelegramMessage(mentionedUser.telegramChatId!, telegramCaption)
                )
            );
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

export default router;
