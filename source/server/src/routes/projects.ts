import { Router, Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/client.js';
import { isAuthenticated, isAdmin } from '../middleware/auth.js';
import { validateName } from '../utils/validation.js';
import { applyNewProjectTemplates, upgradeProjectPlanType, offboardProject } from '../services/templateService.js';
import { createClientDriveFolder } from '../services/driveClientFolder.js';

const router = Router();

// List all projects (all authenticated users can see all projects)
router.get('/', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projects = await prisma.project.findMany({
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
    const { clientId, name, planType, addOns } = req.body;

    // Validate inputs
    const validName = validateName(name, true);
    const validAddOns = Array.isArray(addOns) ? addOns : [];

    const project = await prisma.project.create({
      data: {
        clientId,
        name: validName!,
        planType,
        addOns: validAddOns,
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
    // Also apply templates for each add-on
    for (const addon of validAddOns) {
      const addonResult = await applyNewProjectTemplates(project.id, addon);
      templatesApplied.totalTasksCreated += addonResult.totalTasksCreated;
      templatesApplied.templateSetsApplied += addonResult.templateSetsApplied;
    }

    // Auto-create Google Drive folder structure (non-blocking — don't fail project creation)
    let driveResult: { driveFolderUrl: string; cosmoSheetUrl: string } | null = null;
    if (planType && process.env.DRIVE_CLIENTS_FOLDER_ID) {
      try {
        driveResult = await createClientDriveFolder(
          project.id,
          planType,
          project.client,
          project.name,
          validAddOns
        );
      } catch (err) {
        console.error('[Projects] Drive folder creation failed:', err);
      }
    }

    res.status(201).json({
      ...project,
      ...(driveResult && { driveFolderUrl: driveResult.driveFolderUrl, cosmoSheetUrl: driveResult.cosmoSheetUrl }),
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
    const { name, planType, subscriptionStatus, billingDate, addOns } = req.body;

    // Validate name if provided
    const validName = name !== undefined ? validateName(name, true) : undefined;

    const project = await prisma.project.update({
      where: { id },
      data: {
        ...(validName && { name: validName }),
        ...(planType && { planType }),
        ...(addOns !== undefined && { addOns: Array.isArray(addOns) ? addOns : [] }),
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

// Upgrade project plan type (applies new templates without duplicating existing ones)
router.post('/:id/upgrade', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { planType } = req.body;

    // Validate plan type
    const validPlanTypes = ['package_one', 'package_two', 'package_three', 'package_four', 'facebook_ads_addon', 'custom_website_addon'];
    if (!planType || !validPlanTypes.includes(planType)) {
      return res.status(400).json({ error: 'Invalid plan type' });
    }

    // Check project exists
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const result = await upgradeProjectPlanType(id, planType);

    res.json({
      success: true,
      previousPlanType: project.planType,
      newPlanType: planType,
      tasksCreated: result.tasksCreated,
      skippedDuplicates: result.skippedDuplicates,
      templateSetsProcessed: result.templateSetsProcessed
    });
  } catch (error) {
    next(error);
  }
});

// Offboard project (applies offboarding templates and sets status to canceled)
router.post('/:id/offboard', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    // Check project exists
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if already offboarded
    if (project.subscriptionStatus === 'canceled') {
      return res.status(400).json({ error: 'Project is already offboarded' });
    }

    const result = await offboardProject(id);

    res.json({
      success: true,
      previousStatus: project.subscriptionStatus,
      newStatus: 'canceled',
      tasksCreated: result.tasksCreated,
      skippedDuplicates: result.skippedDuplicates,
      templateSetsProcessed: result.templateSetsProcessed
    });
  } catch (error) {
    next(error);
  }
});

// Create (or recreate) Google Drive folder for a project
router.post('/:id/create-drive-folder', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    const project = await prisma.project.findUnique({
      where: { id },
      include: { client: true }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!project.planType) {
      return res.status(400).json({ error: 'Project has no plan type — cannot create folder structure' });
    }

    if (!process.env.DRIVE_CLIENTS_FOLDER_ID) {
      return res.status(500).json({ error: 'DRIVE_CLIENTS_FOLDER_ID not configured' });
    }

    const result = await createClientDriveFolder(
      project.id,
      project.planType,
      project.client,
      project.name,
      (project as any).addOns || []
    );

    res.json(result);
  } catch (error: any) {
    console.error('[Projects] create-drive-folder failed:', error?.message, error?.response?.data || error?.stack);
    res.status(500).json({ error: `Failed to create Drive folder: ${error?.message || 'Unknown error'}` });
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
