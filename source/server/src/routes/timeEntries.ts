import { Router, Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/client.js';
import { isAuthenticated } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { stringify } from 'csv-stringify/sync';

const router = Router();

// List time entries with filters
router.get('/', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;
    const { userId, projectId, taskId, startDate, endDate } = req.query;

    const where: Prisma.TimeEntryWhereInput = {};

    // Permission-based filtering
    if (user.role !== 'admin' && !user.permissions?.viewAllTimeEntries) {
      where.userId = user.id;
    } else if (userId) {
      where.userId = userId as string;
    }

    if (projectId) where.projectId = projectId as string;
    if (taskId) where.taskId = taskId as string;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const entries = await prisma.timeEntry.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true }
        },
        task: {
          select: { id: true, title: true }
        },
        project: {
          include: {
            client: {
              select: { id: true, name: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(entries);
  } catch (error) {
    next(error);
  }
});

// Create manual time entry
router.post('/', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;
    const { title, description, durationMinutes, taskId, projectId, date } = req.body;

    const entry = await prisma.timeEntry.create({
      data: {
        userId: user.id,
        title,
        description,
        durationMinutes,
        taskId,
        projectId,
        isManual: true,
        startTime: date ? new Date(date) : new Date()
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        },
        task: {
          select: { id: true, title: true }
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

    res.status(201).json(entry);
  } catch (error) {
    next(error);
  }
});

// Start timer
router.post('/start', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;
    const { title, description, taskId, projectId } = req.body;

    // Check for existing running timer
    const running = await prisma.timeEntry.findFirst({
      where: {
        userId: user.id,
        isRunning: true
      }
    });

    if (running) {
      throw new AppError('You already have a running timer', 400);
    }

    const entry = await prisma.timeEntry.create({
      data: {
        userId: user.id,
        title: title || 'Timer',
        description,
        taskId,
        projectId,
        startTime: new Date(),
        isManual: false,
        isRunning: true
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        },
        task: {
          select: { id: true, title: true }
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

    res.status(201).json(entry);
  } catch (error) {
    next(error);
  }
});

// Get current running timer
router.get('/running', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;

    const entry = await prisma.timeEntry.findFirst({
      where: {
        userId: user.id,
        isRunning: true
      },
      include: {
        task: {
          select: { id: true, title: true }
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

    res.json(entry);
  } catch (error) {
    next(error);
  }
});

// Stop timer
router.post('/:id/stop', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const user = req.user as Express.User;
    const { title, taskId, projectId } = req.body;

    const entry = await prisma.timeEntry.findUnique({ where: { id } });

    if (!entry) {
      throw new AppError('Time entry not found', 404);
    }

    if (entry.userId !== user.id) {
      throw new AppError('Permission denied', 403);
    }

    if (!entry.isRunning) {
      throw new AppError('Timer is not running', 400);
    }

    const endTime = new Date();
    // Round up to nearest minute (minimum 1 minute)
    const durationMinutes = Math.max(1, Math.ceil((endTime.getTime() - entry.startTime!.getTime()) / 60000));

    const updated = await prisma.timeEntry.update({
      where: { id },
      data: {
        endTime,
        durationMinutes,
        isRunning: false,
        ...(title && { title }),
        ...(taskId !== undefined && { taskId }),
        ...(projectId !== undefined && { projectId })
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        },
        task: {
          select: { id: true, title: true }
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

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Update time entry
router.patch('/:id', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const user = req.user as Express.User;
    const { title, description, durationMinutes, taskId, projectId } = req.body;

    const entry = await prisma.timeEntry.findUnique({ where: { id } });

    if (!entry) {
      throw new AppError('Time entry not found', 404);
    }

    if (entry.userId !== user.id && user.role !== 'admin') {
      throw new AppError('Permission denied', 403);
    }

    const updated = await prisma.timeEntry.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(durationMinutes !== undefined && { durationMinutes }),
        ...(taskId !== undefined && { taskId }),
        ...(projectId !== undefined && { projectId })
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        },
        task: {
          select: { id: true, title: true }
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

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Delete time entry
router.delete('/:id', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const user = req.user as Express.User;

    const entry = await prisma.timeEntry.findUnique({ where: { id } });

    if (!entry) {
      throw new AppError('Time entry not found', 404);
    }

    if (entry.userId !== user.id && user.role !== 'admin') {
      throw new AppError('Permission denied', 403);
    }

    await prisma.timeEntry.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Export CSV
router.get('/export', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;
    const { userId, projectId, startDate, endDate } = req.query;

    // Only admin can export all
    if (user.role !== 'admin' && userId && userId !== user.id) {
      throw new AppError('Permission denied', 403);
    }

    const where: Prisma.TimeEntryWhereInput = {};
    if (user.role !== 'admin') {
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

    const entries = await prisma.timeEntry.findMany({
      where,
      include: {
        user: {
          select: { name: true, email: true }
        },
        task: {
          select: { title: true }
        },
        project: {
          include: {
            client: {
              select: { name: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const data = entries.map(e => ({
      Date: e.startTime?.toISOString().split('T')[0] || e.createdAt.toISOString().split('T')[0],
      Contractor: e.user.name,
      Email: e.user.email,
      Client: e.project?.client?.name || '',
      Project: e.project?.name || '',
      Task: e.task?.title || '',
      Title: e.title,
      Description: e.description || '',
      'Duration (minutes)': e.durationMinutes || 0,
      'Duration (hours)': ((e.durationMinutes || 0) / 60).toFixed(2),
      Type: e.isManual ? 'Manual' : 'Timer'
    }));

    const csv = stringify(data, { header: true });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="time-entries-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

export default router;
