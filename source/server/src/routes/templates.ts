import { Router, Request, Response, NextFunction } from 'express';
import { Prisma, PlanType } from '@prisma/client';
import { prisma } from '../db/client.js';
import { isAuthenticated, isAdmin } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// List all templates
router.get('/', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { templateType, planType } = req.query;

    const where: Prisma.TaskTemplateWhereInput = {};
    if (templateType) where.templateType = templateType as Prisma.EnumTemplateTypeFilter;
    if (planType) where.planTypes = { has: planType as PlanType };

    const templates = await prisma.taskTemplate.findMany({
      where,
      include: {
        subtasks: {
          orderBy: { sortOrder: 'asc' }
        }
      },
      orderBy: [
        { templateType: 'asc' },
        { dueInDays: 'asc' }
      ]
    });

    res.json(templates);
  } catch (error) {
    next(error);
  }
});

// Get template by ID
router.get('/:id', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    const template = await prisma.taskTemplate.findUnique({
      where: { id },
      include: {
        subtasks: {
          orderBy: { sortOrder: 'asc' }
        }
      }
    });

    if (!template) {
      throw new AppError('Template not found', 404);
    }

    res.json(template);
  } catch (error) {
    next(error);
  }
});

// Create template (admin only)
router.post('/', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, description, templateType, planTypes, defaultAssigneeEmails, dueInDays, tags, subtasks, templateSetId } = req.body;

    const template = await prisma.taskTemplate.create({
      data: {
        title,
        description,
        templateType,
        planTypes: planTypes || [],
        defaultAssigneeEmails: defaultAssigneeEmails || [],
        dueInDays,
        tags: tags || [],
        templateSetId: templateSetId || null,
        subtasks: subtasks?.length > 0 ? {
          create: subtasks.map((s: { title: string }, index: number) => ({
            title: s.title,
            sortOrder: index
          }))
        } : undefined
      },
      include: {
        subtasks: {
          orderBy: { sortOrder: 'asc' }
        }
      }
    });

    res.status(201).json(template);
  } catch (error) {
    next(error);
  }
});

// Update template
router.patch('/:id', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { title, description, templateType, planTypes, defaultAssigneeEmails, dueInDays, tags, subtasks, templateSetId } = req.body;

    // If subtasks are provided, delete existing and create new
    if (subtasks !== undefined) {
      await prisma.templateSubtask.deleteMany({
        where: { templateId: id }
      });

      if (subtasks.length > 0) {
        await prisma.templateSubtask.createMany({
          data: subtasks.map((s: { title: string }, index: number) => ({
            templateId: id,
            title: s.title,
            sortOrder: index
          }))
        });
      }
    }

    const template = await prisma.taskTemplate.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(templateType && { templateType }),
        ...(planTypes && { planTypes }),
        ...(defaultAssigneeEmails !== undefined && { defaultAssigneeEmails }),
        ...(dueInDays !== undefined && { dueInDays }),
        ...(tags && { tags }),
        ...(templateSetId !== undefined && { templateSetId: templateSetId || null })
      },
      include: {
        subtasks: {
          orderBy: { sortOrder: 'asc' }
        }
      }
    });

    res.json(template);
  } catch (error) {
    next(error);
  }
});

// Delete template
router.delete('/:id', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    await prisma.taskTemplate.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
