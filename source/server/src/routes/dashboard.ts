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
    const { projectId, clientId } = req.query;

    // Only admins can see all incomplete tasks
    if (user.role !== 'admin') {
      return res.json({
        unassigned: [],
        noDueDate: [],
        counts: { unassigned: 0, noDueDate: 0, total: 0 }
      });
    }

    // Build base filter for project/client
    const baseWhere: Prisma.TaskWhereInput = {};
    if (projectId) {
      baseWhere.projectId = projectId as string;
    } else if (clientId) {
      baseWhere.project = { clientId: clientId as string };
    }

    const [unassignedTasks, noDueDateTasks] = await Promise.all([
      prisma.task.findMany({
        where: {
          ...baseWhere,
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
          ...baseWhere,
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
          ...baseWhere,
          status: { not: 'completed' },
          assignees: { none: {} }
        }
      }),
      prisma.task.count({
        where: {
          ...baseWhere,
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

// Get monthly leaderboard
router.get('/leaderboard', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get start of current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get all completed tasks this month with assignees, subtasks, and time entries
    const completedTasks = await prisma.task.findMany({
      where: {
        status: 'completed',
        completedAt: { gte: startOfMonth }
      },
      include: {
        assignees: {
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } }
          }
        },
        subtasks: { select: { id: true, completed: true } },
        timeEntries: { select: { durationMinutes: true } }
      }
    });

    // Point values by priority
    const priorityPoints: Record<string, number> = {
      low: 5,
      medium: 10,
      high: 20,
      urgent: 50
    };

    // Calculate scores per user
    const userScores: Record<string, {
      id: string;
      name: string;
      email: string;
      avatarUrl: string | null;
      points: number;
      tasksCompleted: number;
      onTimeCount: number;
      earlyCount: number;
      lateCount: number;
      subtasksCompleted: number;
      hoursTracked: number;
      streak: number;
      completionDates: Set<string>;
    }> = {};

    for (const task of completedTasks) {
      const basePoints = priorityPoints[task.priority] || 10;
      const completedAt = task.completedAt ? new Date(task.completedAt) : now;
      const dueDate = task.dueDate ? new Date(task.dueDate) : null;

      // Calculate timing bonus
      let timingMultiplier = 1;
      let wasEarly = false;
      let wasOnTime = false;
      let wasLate = false;

      if (dueDate) {
        const daysBeforeDue = (dueDate.getTime() - completedAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysBeforeDue >= 3) {
          timingMultiplier = 1.5; // 50% bonus for early
          wasEarly = true;
        } else if (daysBeforeDue >= 0) {
          timingMultiplier = 1.25; // 25% bonus for on-time
          wasOnTime = true;
        } else {
          timingMultiplier = 0.5; // Reduced points for late
          wasLate = true;
        }
      }

      // Calculate subtask bonus
      const completedSubtasks = task.subtasks.filter(s => s.completed).length;
      const subtaskBonus = completedSubtasks * 2;

      // Calculate time bonus (1 point per hour tracked)
      const totalMinutes = task.timeEntries.reduce((sum, e) => sum + (e.durationMinutes || 0), 0);
      const timeBonus = Math.floor(totalMinutes / 60);

      // Total points for this task
      const taskPoints = Math.round(basePoints * timingMultiplier) + subtaskBonus + timeBonus;

      // Distribute points to all assignees
      for (const assignee of task.assignees) {
        const userId = assignee.user.id;
        if (!userScores[userId]) {
          userScores[userId] = {
            id: userId,
            name: assignee.user.name,
            email: assignee.user.email,
            avatarUrl: assignee.user.avatarUrl,
            points: 0,
            tasksCompleted: 0,
            onTimeCount: 0,
            earlyCount: 0,
            lateCount: 0,
            subtasksCompleted: 0,
            hoursTracked: 0,
            streak: 0,
            completionDates: new Set()
          };
        }

        userScores[userId].points += taskPoints;
        userScores[userId].tasksCompleted += 1;
        userScores[userId].subtasksCompleted += completedSubtasks;
        userScores[userId].hoursTracked += totalMinutes / 60;

        if (wasEarly) userScores[userId].earlyCount += 1;
        if (wasOnTime) userScores[userId].onTimeCount += 1;
        if (wasLate) userScores[userId].lateCount += 1;

        // Track completion date for streak calculation
        const dateStr = completedAt.toISOString().split('T')[0];
        userScores[userId].completionDates.add(dateStr);
      }
    }

    // Calculate streaks and determine badges
    const leaderboard = Object.values(userScores).map(user => {
      // Calculate streak (consecutive weekdays with completions, skip weekends)
      const dates = Array.from(user.completionDates).sort().reverse();
      let streak = 0;
      const today = new Date().toISOString().split('T')[0];
      let checkDate = new Date(today);

      for (let i = 0; i < 60; i++) {
        const day = checkDate.getDay();
        if (day === 0 || day === 6) {
          checkDate.setDate(checkDate.getDate() - 1);
          continue;
        }
        const dateStr = checkDate.toISOString().split('T')[0];
        if (dates.includes(dateStr)) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else if (streak > 0) {
          break;
        } else {
          checkDate.setDate(checkDate.getDate() - 1);
        }
      }

      // Determine badges
      const badges: { emoji: string; label: string; description: string }[] = [];

      // On-time rate badge
      const totalWithDue = user.earlyCount + user.onTimeCount + user.lateCount;
      const onTimeRate = totalWithDue > 0 ? (user.earlyCount + user.onTimeCount) / totalWithDue : 0;
      if (onTimeRate >= 0.9 && totalWithDue >= 3) {
        badges.push({ emoji: '🎯', label: 'Sharpshooter', description: '90%+ on-time rate' });
      }

      // Early bird badge
      if (user.earlyCount >= 5) {
        badges.push({ emoji: '🌅', label: 'Early Bird', description: '5+ tasks completed early' });
      }

      // Streak badge
      if (streak >= 5) {
        badges.push({ emoji: '🔥', label: 'On Fire', description: `${streak} day streak` });
      }

      // High volume badge
      if (user.tasksCompleted >= 20) {
        badges.push({ emoji: '⚡', label: 'Powerhouse', description: '20+ tasks completed' });
      }

      // Time tracker badge
      if (user.hoursTracked >= 40) {
        badges.push({ emoji: '⏱️', label: 'Time Lord', description: '40+ hours tracked' });
      }

      // Detail oriented badge (subtasks)
      if (user.subtasksCompleted >= 15) {
        badges.push({ emoji: '🔍', label: 'Detail Master', description: '15+ subtasks completed' });
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        points: user.points,
        tasksCompleted: user.tasksCompleted,
        onTimeRate: Math.round(onTimeRate * 100),
        streak,
        hoursTracked: Math.round(user.hoursTracked * 10) / 10,
        badges
      };
    });

    // Sort by points descending
    leaderboard.sort((a, b) => b.points - a.points);

    // Add rank
    const rankedLeaderboard = leaderboard.map((user, index) => ({
      rank: index + 1,
      ...user
    }));

    res.json({
      month: now.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
      leaderboard: rankedLeaderboard
    });
  } catch (error) {
    next(error);
  }
});

export default router;
