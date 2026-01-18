import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db/client.js';
import { isAuthenticated, isAdmin } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { applyTemplateSetToProject } from '../services/templateService.js';

const router = Router();

// List all template sets
router.get('/', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const templateSets = await prisma.templateSet.findMany({
      include: {
        templates: {
          orderBy: { sortOrder: 'asc' },
          include: {
            defaultRole: true,
            subtasks: { orderBy: { sortOrder: 'asc' } }
          }
        },
        _count: {
          select: { templates: true }
        }
      },
      orderBy: [
        { isSystem: 'desc' },
        { name: 'asc' }
      ]
    });
    res.json(templateSets);
  } catch (error) {
    next(error);
  }
});

// Get single template set with templates
router.get('/:id', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const templateSet = await prisma.templateSet.findUnique({
      where: { id: id as string },
      include: {
        templates: {
          orderBy: { sortOrder: 'asc' },
          include: {
            defaultRole: true,
            subtasks: { orderBy: { sortOrder: 'asc' } }
          }
        }
      }
    });

    if (!templateSet) {
      throw new AppError('Template set not found', 404);
    }

    res.json(templateSet);
  } catch (error) {
    next(error);
  }
});

// Create template set
router.post('/', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, triggerType, triggerRules, planTypes, active } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new AppError('Name is required', 400);
    }

    const validTriggerTypes = ['manual', 'new_project', 'subscription_change', 'schedule'];
    if (triggerType && !validTriggerTypes.includes(triggerType)) {
      throw new AppError('Invalid trigger type', 400);
    }

    const templateSet = await prisma.templateSet.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        triggerType: triggerType || 'manual',
        triggerRules: triggerRules || {},
        planTypes: planTypes || [],
        active: active !== false,
        isSystem: false
      }
    });

    res.status(201).json(templateSet);
  } catch (error) {
    next(error);
  }
});

// Update template set
router.patch('/:id', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, description, triggerType, triggerRules, planTypes, active } = req.body;

    const existing = await prisma.templateSet.findUnique({ where: { id: id as string } });
    if (!existing) {
      throw new AppError('Template set not found', 404);
    }

    // Don't allow editing system template sets' core properties
    if (existing.isSystem && (name || triggerType)) {
      throw new AppError('Cannot modify system template set name or trigger type', 400);
    }

    const validTriggerTypes = ['manual', 'new_project', 'subscription_change', 'schedule'];
    if (triggerType && !validTriggerTypes.includes(triggerType)) {
      throw new AppError('Invalid trigger type', 400);
    }

    const templateSet = await prisma.templateSet.update({
      where: { id: id as string },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(triggerType && { triggerType }),
        ...(triggerRules !== undefined && { triggerRules }),
        ...(planTypes !== undefined && { planTypes }),
        ...(typeof active === 'boolean' && { active })
      }
    });

    res.json(templateSet);
  } catch (error) {
    next(error);
  }
});

// Delete template set
router.delete('/:id', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const existing = await prisma.templateSet.findUnique({ where: { id: id as string } });
    if (!existing) {
      throw new AppError('Template set not found', 404);
    }

    if (existing.isSystem) {
      throw new AppError('Cannot delete system template sets', 400);
    }

    // Delete the template set (templates will have their templateSetId set to null)
    await prisma.templateSet.delete({ where: { id: id as string } });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Trigger a template set manually (creates tasks from templates)
router.post('/:id/trigger', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { projectId } = req.body;

    if (!projectId) {
      throw new AppError('Project ID is required', 400);
    }

    const templateSet = await prisma.templateSet.findUnique({
      where: { id: id as string }
    });

    if (!templateSet) {
      throw new AppError('Template set not found', 404);
    }

    if (!templateSet.active) {
      throw new AppError('Template set is not active', 400);
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    // Check if project's plan type matches template set
    if (templateSet.planTypes.length > 0 && project.planType && !templateSet.planTypes.includes(project.planType)) {
      throw new AppError('Project plan type does not match template set requirements', 400);
    }

    // Apply the template set to the project
    const result = await applyTemplateSetToProject(id as string, projectId);

    res.json({
      success: true,
      tasksCreated: result.tasksCreated,
      taskIds: result.taskIds
    });
  } catch (error) {
    next(error);
  }
});

export default router;
