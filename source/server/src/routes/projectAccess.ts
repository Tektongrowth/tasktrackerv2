import { Router, Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/client.js';
import { isAuthenticated, isAdmin } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

// Type for bulk project access input
interface ProjectAccessInput {
  projectId: string;
  canView?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

const router = Router();

// Get all project access entries (admin only)
router.get('/', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, projectId } = req.query;

    const where: Prisma.ProjectAccessWhereInput = {};
    if (userId) where.userId = userId as string;
    if (projectId) where.projectId = projectId as string;

    const access = await prisma.projectAccess.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true }
        },
        project: {
          select: { id: true, name: true, client: { select: { id: true, name: true } } }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(access);
  } catch (error) {
    next(error);
  }
});

// Get project access for a specific user
router.get('/user/:userId', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.userId as string;

    const access = await prisma.projectAccess.findMany({
      where: { userId },
      include: {
        project: {
          select: { id: true, name: true, client: { select: { id: true, name: true } } }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(access);
  } catch (error) {
    next(error);
  }
});

// Get users with access to a specific project
router.get('/project/:projectId', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params.projectId as string;

    const access = await prisma.projectAccess.findMany({
      where: { projectId },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(access);
  } catch (error) {
    next(error);
  }
});

// Create or update project access for a user
router.post('/', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, projectId, canView, canEdit, canDelete } = req.body;

    if (!userId || !projectId) {
      throw new AppError('userId and projectId are required', 400);
    }

    // Verify user and project exist
    const [user, project] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.project.findUnique({ where: { id: projectId } })
    ]);

    if (!user) throw new AppError('User not found', 404);
    if (!project) throw new AppError('Project not found', 404);

    // Upsert the project access
    const access = await prisma.projectAccess.upsert({
      where: {
        userId_projectId: { userId, projectId }
      },
      create: {
        userId,
        projectId,
        canView: canView ?? true,
        canEdit: canEdit ?? false,
        canDelete: canDelete ?? false
      },
      update: {
        canView: canView ?? true,
        canEdit: canEdit ?? false,
        canDelete: canDelete ?? false
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true }
        },
        project: {
          select: { id: true, name: true, client: { select: { id: true, name: true } } }
        }
      }
    });

    res.json(access);
  } catch (error) {
    next(error);
  }
});

// Bulk update project access for a user (set all at once)
router.put('/user/:userId', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.userId as string;
    const { projectAccess } = req.body; // Array of { projectId, canView, canEdit, canDelete }

    if (!Array.isArray(projectAccess)) {
      throw new AppError('projectAccess must be an array', 400);
    }

    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404);

    // Delete existing access entries for this user
    await prisma.projectAccess.deleteMany({ where: { userId } });

    // Create new access entries
    if (projectAccess.length > 0) {
      await prisma.projectAccess.createMany({
        data: projectAccess.map((pa: ProjectAccessInput) => ({
          userId,
          projectId: pa.projectId,
          canView: pa.canView ?? true,
          canEdit: pa.canEdit ?? false,
          canDelete: pa.canDelete ?? false
        }))
      });
    }

    // Fetch and return the updated access entries
    const access = await prisma.projectAccess.findMany({
      where: { userId },
      include: {
        project: {
          select: { id: true, name: true, client: { select: { id: true, name: true } } }
        }
      }
    });

    res.json(access);
  } catch (error) {
    next(error);
  }
});

// Delete specific project access
router.delete('/:id', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    await prisma.projectAccess.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Delete all project access for a user-project pair
router.delete('/user/:userId/project/:projectId', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.userId as string;
    const projectId = req.params.projectId as string;

    await prisma.projectAccess.delete({
      where: {
        userId_projectId: { userId, projectId }
      }
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
