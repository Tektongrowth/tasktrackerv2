import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db/client.js';
import { isAuthenticated } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// All audit log routes require admin
router.use(isAuthenticated);
router.use((req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'admin') {
    return next(new AppError('Admin access required', 403));
  }
  next();
});

// List audit logs with pagination and filters
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const skip = (page - 1) * limit;

    const { action, entityType, userId, startDate, endDate } = req.query;

    const where: any = {};

    if (action) {
      where.action = { contains: action as string };
    }

    if (entityType) {
      where.entityType = entityType as string;
    }

    if (userId) {
      where.userId = userId as string;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        const start = new Date(startDate as string);
        if (!isNaN(start.getTime())) {
          where.createdAt.gte = start;
        }
      }
      if (endDate) {
        const end = new Date(endDate as string);
        if (!isNaN(end.getTime())) {
          where.createdAt.lte = end;
        }
      }
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get distinct actions for filtering (limited to prevent DoS)
router.get('/actions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actions = await prisma.auditLog.findMany({
      select: { action: true },
      distinct: ['action'],
      orderBy: { action: 'asc' },
      take: 100, // Limit distinct values
    });

    res.json(actions.map((a) => a.action));
  } catch (error) {
    next(error);
  }
});

// Get distinct entity types for filtering (limited to prevent DoS)
router.get('/entity-types', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entityTypes = await prisma.auditLog.findMany({
      select: { entityType: true },
      distinct: ['entityType'],
      orderBy: { entityType: 'asc' },
      take: 100, // Limit distinct values
    });

    res.json(entityTypes.map((e) => e.entityType));
  } catch (error) {
    next(error);
  }
});

// Get a single audit log entry
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const log = await prisma.auditLog.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!log) {
      return res.status(404).json({ error: 'Audit log not found' });
    }

    res.json(log);
  } catch (error) {
    next(error);
  }
});

export default router;
