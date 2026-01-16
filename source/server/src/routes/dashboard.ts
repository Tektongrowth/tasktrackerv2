import { Router, Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/client.js';
import { isAuthenticated } from '../middleware/auth.js';

const router = Router();

// Get upcoming tasks
router.get('/upcoming', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;
    const { assigneeId, clientId, tag, limit } = req.query;

    const where: Prisma.TaskWhereInput = {
      status: { not: 'completed' }
    };

    // Permission-based filtering
    if (user.role !== 'admin' && user.permissions?.viewOwnTasksOnly !== false) {
      where.assignees = { some: { userId: user.id } };
    } else if (assigneeId) {
      where.assignees = { some: { userId: assigneeId as string } };
    }

    if (clientId) {
      where.project = { clientId: clientId as string };
    }

    if (tag) {
      where.tags = { has: tag as string };
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        project: {
          include: {
            client: {
              select: { id: true, name: true }
            }
          }
        },
        assignees: {
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } }
          }
        }
      },
      orderBy: [
        { dueDate: 'asc' },
        { createdAt: 'asc' }
      ],
      take: limit ? parseInt(limit as string) : 50
    });

    // Add overdue flag
    const now = new Date();
    const tasksWithOverdue = tasks.map(task => ({
      ...task,
      isOverdue: task.dueDate ? new Date(task.dueDate) < now : false
    }));

    res.json(tasksWithOverdue);
  } catch (error) {
    next(error);
  }
});

// Get recently completed tasks (rolling 30 days)
router.get('/completed', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;
    const { assigneeId, clientId, tag, days } = req.query;

    const daysBack = days ? parseInt(days as string) : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const where: Prisma.TaskWhereInput = {
      status: 'completed',
      completedAt: { gte: startDate }
    };

    // Permission-based filtering
    if (user.role !== 'admin' && user.permissions?.viewOwnTasksOnly !== false) {
      where.assignees = { some: { userId: user.id } };
    } else if (assigneeId) {
      where.assignees = { some: { userId: assigneeId as string } };
    }

    if (clientId) {
      where.project = { clientId: clientId as string };
    }

    if (tag) {
      where.tags = { has: tag as string };
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        project: {
          include: {
            client: {
              select: { id: true, name: true }
            }
          }
        },
        assignees: {
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } }
          }
        }
      },
      orderBy: { completedAt: 'desc' }
    });

    res.json(tasks);
  } catch (error) {
    next(error);
  }
});

// Get time tracking summary
router.get('/time-summary', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;
    const { startDate, endDate, userId, projectId } = req.query;

    const where: Prisma.TimeEntryWhereInput = {
      durationMinutes: { not: null }
    };

    // Permission-based filtering
    if (user.role !== 'admin' && !user.permissions?.viewAllTimeEntries) {
      where.userId = user.id;
    } else if (userId) {
      where.userId = userId as string;
    }

    if (projectId) where.projectId = projectId as string;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    // Get all entries for aggregation
    const entries = await prisma.timeEntry.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true }
        },
        project: {
          include: {
            client: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });

    // Aggregate by contractor
    const byContractor: Record<string, { name: string; email: string; avatarUrl: string | null; totalMinutes: number }> = {};
    // Aggregate by project/client
    const byProject: Record<string, { projectName: string; clientName: string; totalMinutes: number }> = {};

    for (const entry of entries) {
      const userId = entry.user.id;
      if (!byContractor[userId]) {
        byContractor[userId] = {
          name: entry.user.name,
          email: entry.user.email,
          avatarUrl: entry.user.avatarUrl,
          totalMinutes: 0
        };
      }
      byContractor[userId].totalMinutes += entry.durationMinutes || 0;

      if (entry.project) {
        const projectId = entry.project.id;
        if (!byProject[projectId]) {
          byProject[projectId] = {
            projectName: entry.project.name,
            clientName: entry.project.client?.name || 'Unknown',
            totalMinutes: 0
          };
        }
        byProject[projectId].totalMinutes += entry.durationMinutes || 0;
      }
    }

    const totalMinutes = entries.reduce((sum, e) => sum + (e.durationMinutes || 0), 0);

    res.json({
      totalMinutes,
      totalHours: (totalMinutes / 60).toFixed(2),
      byContractor: Object.entries(byContractor).map(([id, data]) => ({
        id,
        ...data,
        totalHours: (data.totalMinutes / 60).toFixed(2)
      })),
      byProject: Object.entries(byProject).map(([id, data]) => ({
        id,
        ...data,
        totalHours: (data.totalMinutes / 60).toFixed(2)
      }))
    });
  } catch (error) {
    next(error);
  }
});

// Get incomplete tasks (missing assignee or due date)
router.get('/incomplete', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;

    // Only admins can see all incomplete tasks
    if (user.role !== 'admin') {
      return res.json({
        unassigned: [],
        noDueDate: [],
        counts: { unassigned: 0, noDueDate: 0, total: 0 }
      });
    }

    const [unassignedTasks, noDueDateTasks] = await Promise.all([
      prisma.task.findMany({
        where: {
          status: { not: 'completed' },
          assignees: { none: {} }
        },
        include: {
          project: {
            include: {
              client: {
                select: { id: true, name: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),
      prisma.task.findMany({
        where: {
          status: { not: 'completed' },
          dueDate: null
        },
        include: {
          project: {
            include: {
              client: {
                select: { id: true, name: true }
              }
            }
          },
          assignees: {
            include: {
              user: { select: { id: true, name: true, avatarUrl: true } }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      })
    ]);

    const [unassignedCount, noDueDateCount] = await Promise.all([
      prisma.task.count({
        where: {
          status: { not: 'completed' },
          assignees: { none: {} }
        }
      }),
      prisma.task.count({
        where: {
          status: { not: 'completed' },
          dueDate: null
        }
      })
    ]);

    res.json({
      unassigned: unassignedTasks,
      noDueDate: noDueDateTasks,
      counts: {
        unassigned: unassignedCount,
        noDueDate: noDueDateCount,
        total: unassignedCount + noDueDateCount
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get recent activity (comments)
router.get('/recent-activity', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;
    const { projectId, clientId, limit } = req.query;

    const where: Prisma.TaskCommentWhereInput = {};

    // Filter by project or client
    if (projectId) {
      where.task = { projectId: projectId as string };
    } else if (clientId) {
      where.task = { project: { clientId: clientId as string } };
    }

    // Permission-based filtering for non-admins
    if (user.role !== 'admin' && user.permissions?.viewOwnTasksOnly !== false) {
      where.task = { ...(where.task as Prisma.TaskWhereInput), assignees: { some: { userId: user.id } } };
    }

    const comments = await prisma.taskComment.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true }
        },
        task: {
          select: {
            id: true,
            title: true,
            projectId: true,
            project: {
              select: {
                id: true,
                name: true,
                client: {
                  select: { id: true, name: true }
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit as string) : 20
    });

    res.json(comments);
  } catch (error) {
    next(error);
  }
});

// Get dashboard stats
router.get('/stats', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;
    const { projectId, clientId } = req.query;

    const baseWhere: Prisma.TaskWhereInput = {};
    if (user.role !== 'admin' && user.permissions?.viewOwnTasksOnly !== false) {
      baseWhere.assignees = { some: { userId: user.id } };
    }

    // Filter by project or client
    if (projectId) {
      baseWhere.projectId = projectId as string;
    } else if (clientId) {
      baseWhere.project = { clientId: clientId as string };
    }

    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [todoCount, inReviewCount, completedCount, overdueCount, totalClients, totalProjects] = await Promise.all([
      prisma.task.count({ where: { ...baseWhere, status: 'todo' } }),
      prisma.task.count({ where: { ...baseWhere, status: 'in_review' } }),
      prisma.task.count({ where: { ...baseWhere, status: 'completed', completedAt: { gte: thirtyDaysAgo } } }),
      prisma.task.count({ where: { ...baseWhere, status: { not: 'completed' }, dueDate: { lt: now } } }),
      user.role === 'admin' ? prisma.client.count() : Promise.resolve(0),
      user.role === 'admin' ? prisma.project.count({ where: { subscriptionStatus: 'active' } }) : Promise.resolve(0)
    ]);

    res.json({
      tasks: {
        todo: todoCount,
        inReview: inReviewCount,
        completed: completedCount,
        overdue: overdueCount
      },
      clients: totalClients,
      activeProjects: totalProjects
    });
  } catch (error) {
    next(error);
  }
});

export default router;
