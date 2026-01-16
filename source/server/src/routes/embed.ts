import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db/client.js';
import { sendTaskSubmissionEmail } from '../services/email.js';
import { validateTitle, validateDescription, validateName, validateEmail } from '../utils/validation.js';

const router = Router();

// Get client info by embed token (public - no auth required)
router.get('/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.params.token as string;

    const client = await prisma.client.findUnique({
      where: { embedToken: token },
      select: {
        id: true,
        name: true,
        projects: {
          where: { subscriptionStatus: 'active' },
          select: {
            id: true,
            name: true
          },
          orderBy: { name: 'asc' }
        }
      }
    });

    if (!client) {
      return res.status(404).json({ error: 'Invalid embed token' });
    }

    res.json({
      clientName: client.name,
      projects: client.projects
    });
  } catch (error) {
    next(error);
  }
});

// Get client info by GHL Location ID (public - no auth required)
router.get('/location/:locationId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const locationId = req.params.locationId as string;

    const client = await prisma.client.findUnique({
      where: { ghlLocationId: locationId },
      select: {
        id: true,
        name: true,
        projects: {
          where: { subscriptionStatus: 'active' },
          select: {
            id: true,
            name: true
          },
          orderBy: { name: 'asc' }
        }
      }
    });

    if (!client) {
      return res.status(404).json({ error: 'Location not found' });
    }

    res.json({
      clientName: client.name,
      projects: client.projects
    });
  } catch (error) {
    next(error);
  }
});

// Submit a task request via GHL Location ID (public - no auth required)
router.post('/location/:locationId/submit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const locationId = req.params.locationId as string;
    const { projectId, priority } = req.body;

    // Validate inputs
    const title = validateTitle(req.body.title);
    const description = validateDescription(req.body.description);
    const submitterName = validateName(req.body.submitterName, false);
    const submitterEmail = validateEmail(req.body.submitterEmail, false);

    // Find client by GHL location ID
    const client = await prisma.client.findUnique({
      where: { ghlLocationId: locationId },
      select: {
        id: true,
        name: true,
        email: true,
        projects: {
          where: { subscriptionStatus: 'active' },
          select: { id: true }
        }
      }
    });

    if (!client) {
      return res.status(404).json({ error: 'Location not found' });
    }

    // Verify project belongs to client if provided
    if (projectId) {
      const validProject = client.projects.some(p => p.id === projectId);
      if (!validProject) {
        return res.status(400).json({ error: 'Invalid project' });
      }
    }

    // Determine submitter info
    const submittedBy = submitterEmail || submitterName || client.email || 'Embed Form';

    const submission = await prisma.taskSubmission.create({
      data: {
        clientId: client.id,
        projectId: projectId || null,
        title,
        description: description || null,
        priority: priority || 'medium',
        submittedBy,
        status: 'pending'
      }
    });

    // Notify admin
    await sendTaskSubmissionEmail(submission, client).catch(err => {
      console.error('Failed to send submission email:', err);
    });

    res.status(201).json({
      success: true,
      message: 'Task request submitted successfully',
      submissionId: submission.id
    });
  } catch (error) {
    next(error);
  }
});

// Submit a task request via embed (public - no auth required)
router.post('/:token/submit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.params.token as string;
    const { projectId, priority } = req.body;

    // Validate inputs
    const title = validateTitle(req.body.title);
    const description = validateDescription(req.body.description);
    const submitterName = validateName(req.body.submitterName, false);
    const submitterEmail = validateEmail(req.body.submitterEmail, false);

    // Find client by embed token
    const client = await prisma.client.findUnique({
      where: { embedToken: token },
      select: {
        id: true,
        name: true,
        email: true,
        projects: {
          where: { subscriptionStatus: 'active' },
          select: { id: true }
        }
      }
    });

    if (!client) {
      return res.status(404).json({ error: 'Invalid embed token' });
    }

    // Verify project belongs to client if provided
    if (projectId) {
      const validProject = client.projects.some(p => p.id === projectId);
      if (!validProject) {
        return res.status(400).json({ error: 'Invalid project' });
      }
    }

    // Determine submitter info
    const submittedBy = submitterEmail || submitterName || client.email || 'Embed Form';

    const submission = await prisma.taskSubmission.create({
      data: {
        clientId: client.id,
        projectId: projectId || null,
        title,
        description: description || null,
        priority: priority || 'medium',
        submittedBy,
        status: 'pending'
      }
    });

    // Notify admin
    await sendTaskSubmissionEmail(submission, client).catch(err => {
      console.error('Failed to send submission email:', err);
    });

    res.status(201).json({
      success: true,
      message: 'Task request submitted successfully',
      submissionId: submission.id
    });
  } catch (error) {
    next(error);
  }
});

export default router;
