import { Router, Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/client.js';
import { isAuthenticated, isAdmin } from '../middleware/auth.js';
import { validateName } from '../utils/validation.js';
import { applyNewProjectTemplates } from '../services/templateService.js';

const router = Router();

// List all projects (filtered by access for contractors)
router.get('/', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;

    let where: Prisma.ProjectWhereInput = {};

    // Filter by project access for non-admins
    if (user.role !== 'admin') {
      const projectAccess = await prisma.projectAccess.findMany({
        where: { userId: user.id, canView: true },
        select: { projectId: true }
      });
      const allowedProjectIds = projectAccess.map(pa => pa.projectId);

      if (allowedProjectIds.length > 0) {
        where.id = { in: allowedProjectIds };
      } else {
        // No project access - return empty array
        return res.json([]);
      }
    }

    const projects = await prisma.project.findMany({
      where,
      include: {
        client: {
          select: { id: true, name: true, email: true }
        },
        _count: {
          select: { tasks: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(projects);
  } catch (error) {
    next(error);
  }
});

// Get project with tasks
router.get('/:id', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        client: true,
        tasks: {
          include: {
            assignees: {
              include: {
                user: { select: { id: true, name: true, email: true, avatarUrl: true } }
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  } catch (error) {
    next(error);
  }
});

// Create project (for manual hosting plans)
router.post('/', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { clientId, name, planType } = req.body;

    // Validate inputs
    const validName = validateName(name, true);

    const project = await prisma.project.create({
      data: {
        clientId,
        name: validName!,
        planType,
        subscriptionStatus: 'active'
      },
      include: {
        client: true
      }
    });

    // Auto-apply template sets configured for new projects with matching plan type
    let templatesApplied = { totalTasksCreated: 0, templateSetsApplied: 0 };
    if (planType) {
      templatesApplied = await applyNewProjectTemplates(project.id, planType);
    }

    res.status(201).json({
      ...project,
      _templatesApplied: templatesApplied
    });
  } catch (error) {
    next(error);
  }
});

// Update project
router.patch('/:id', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { name, planType, subscriptionStatus, billingDate } = req.body;

    // Validate name if provided
    const validName = name !== undefined ? validateName(name, true) : undefined;

    const project = await prisma.project.update({
      where: { id },
      data: {
        ...(validName && { name: validName }),
        ...(planType && { planType }),
        ...(subscriptionStatus && { subscriptionStatus }),
        ...(billingDate && { billingDate: new Date(billingDate) })
      },
      include: {
        client: true
      }
    });

    res.json(project);
  } catch (error) {
    next(error);
  }
});

// Delete project (will also delete all tasks)
router.delete('/:id', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    // Delete all related records first
    await prisma.task.deleteMany({ where: { projectId: id } });
    await prisma.timeEntry.deleteMany({ where: { projectId: id } });
    await prisma.project.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
