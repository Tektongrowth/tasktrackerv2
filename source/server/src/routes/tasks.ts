import { Router, Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/client.js';
import { isAuthenticated } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { sendTaskAssignedEmail, sendTaskOverdueEmail, sendMentionNotificationEmail } from '../services/email.js';
import { parseMentions, resolveMentions, createMentionRecords, markMentionsNotified } from '../utils/mentions.js';
import { validateTitle, validateDescription, validateComment, INPUT_LIMITS } from '../utils/validation.js';

const router = Router();

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

// List tasks with filters
router.get('/', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;
    const { status, assignedTo, projectId, clientId, tag, roleId, dueBefore, dueAfter, includeArchived } = req.query;

    const where: Prisma.TaskWhereInput = {
      // By default, exclude archived tasks
      archived: includeArchived === 'true' ? undefined : false
    };

    // Permission-based filtering for contractors
    if (user.role !== 'admin') {
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

    // Only admin can view archived tasks
    if (user.role !== 'admin') {
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

    if (!task) {
      throw new AppError('Task not found', 404);
    }

    // Check permission - admin always has access
    if (user.role !== 'admin') {
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
    if (user.role !== 'admin') {
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
              select: { id: true, name: true, email: true, avatarUrl: true }
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

    // Send email notification to assignees
    for (const assignee of task.assignees) {
      if (assignee.user.email !== user.email) {
        await sendTaskAssignedEmail(assignee.user.email, task);
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
    const { title, description, status, assigneeIds, dueDate, tags, roleId } = req.body;

    const existingTask = await prisma.task.findUnique({
      where: { id },
      include: { assignees: true }
    });
    if (!existingTask) {
      throw new AppError('Task not found', 404);
    }

    // Check permission
    const isAssigned = existingTask.assignees.some(a => a.userId === user.id);
    let canEdit = user.role === 'admin' ||
      user.permissions?.editAllTasks ||
      (user.permissions?.editOwnTasks !== false && isAssigned);

    // Also check project-level edit access
    if (!canEdit && user.role !== 'admin') {
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
                select: { id: true, name: true, email: true, avatarUrl: true }
              }
            }
          },
          assignedRole: true
        }
      });
    });

    // Log activity
    const changes: string[] = [];
    if (title !== undefined && title !== existingTask.title) changes.push('title');
    if (status !== undefined && status !== existingTask.status) changes.push(`status to ${status}`);
    if (assigneeIds !== undefined && (addedAssigneeIds.length > 0 || removedAssigneeIds.length > 0)) {
      changes.push('assignees');
    }
    if (dueDate !== undefined) changes.push('due date');

    if (changes.length > 0) {
      await prisma.taskActivity.create({
        data: {
          taskId: id,
          userId: user.id,
          action: 'updated',
          details: { changes }
        }
      });
    }

    // Notify new assignees
    for (const assigneeId of addedAssigneeIds) {
      const assignee = task?.assignees.find(a => a.userId === assigneeId);
      if (assignee && assignee.user.email !== user.email) {
        await sendTaskAssignedEmail(assignee.user.email, task);
      }
    }

    res.json(task);
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
    let canEdit = user.role === 'admin' ||
      user.permissions?.editAllTasks ||
      (user.permissions?.editOwnTasks !== false && isAssigned);

    // Also check project-level edit access
    if (!canEdit && user.role !== 'admin') {
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

    res.json(task);
  } catch (error) {
    next(error);
  }
});

// Delete task
router.delete('/:id', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const user = req.user as Express.User;

    // Only admin can delete
    if (user.role !== 'admin') {
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

    // Only admin can archive tasks
    if (user.role !== 'admin') {
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

    // Only admin can archive tasks
    if (user.role !== 'admin') {
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

    // Only admin can unarchive tasks
    if (user.role !== 'admin') {
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

    if (user.role !== 'admin') {
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

    if (user.role !== 'admin') {
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
        where: { id: { in: newAssigneeIds } }
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

    if (user.role !== 'admin') {
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

    if (user.role !== 'admin') {
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
      include: { assignees: { select: { userId: true } } }
    });
    if (!task) {
      throw new AppError('Task not found', 404);
    }

    // Check permission - anyone who can view the task can comment
    const isAssigned = task.assignees.some(a => a.userId === user.id);
    const canView = user.role === 'admin' ||
      user.permissions?.viewAllTasks ||
      isAssigned;

    if (!canView) {
      throw new AppError('Permission denied', 403);
    }

    const comment = await prisma.taskComment.create({
      data: {
        taskId,
        userId: user.id,
        content
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true }
        }
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
          select: { id: true, email: true }
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

    // Only comment author or admin can edit
    if (existingComment.userId !== user.id && user.role !== 'admin') {
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

    // Only comment author or admin can delete
    if (existingComment.userId !== user.id && user.role !== 'admin') {
      throw new AppError('Permission denied', 403);
    }

    await prisma.taskComment.delete({ where: { id: commentId } });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
