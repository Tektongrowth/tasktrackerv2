import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db/client.js';
import { sendClientAccessEmail, sendTaskSubmissionEmail } from '../services/email.js';
import crypto from 'crypto';

const router = Router();

// Middleware to check client session
export function isClientAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.session?.clientId) {
    return next();
  }
  res.status(401).json({ error: 'Not authenticated as client' });
}

// Request access via email (magic link)
router.post('/request-access', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find client by email or find viewer with this email
    let client = await prisma.client.findFirst({
      where: { email: email.toLowerCase() }
    });

    // If not a client, check if they're a viewer
    if (!client) {
      const viewer = await prisma.clientViewer.findFirst({
        where: { email: email.toLowerCase() },
        include: { client: true }
      });

      if (viewer) {
        client = viewer.client;
      }
    }

    if (!client) {
      // Don't reveal if email exists or not
      return res.json({ success: true, message: 'If this email is associated with a client account, you will receive an access link.' });
    }

    // Generate access token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.clientAccessToken.create({
      data: {
        clientId: client.id,
        token,
        expiresAt
      }
    });

    // Send email with magic link
    await sendClientAccessEmail(email, client.name, token);

    res.json({ success: true, message: 'If this email is associated with a client account, you will receive an access link.' });
  } catch (error) {
    next(error);
  }
});

// Verify access token and create session
router.get('/verify/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.params.token as string;

    const accessToken = await prisma.clientAccessToken.findUnique({
      where: { token },
      include: { client: true }
    });

    if (!accessToken) {
      return res.status(400).json({ error: 'Invalid or expired access link' });
    }

    if (accessToken.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Access link has expired' });
    }

    if (accessToken.usedAt) {
      return res.status(400).json({ error: 'Access link has already been used' });
    }

    // Mark token as used
    await prisma.clientAccessToken.update({
      where: { id: accessToken.id },
      data: { usedAt: new Date() }
    });

    // SECURITY: Regenerate session to prevent session fixation attacks
    const clientId = accessToken.clientId;
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regeneration error:', err);
        return res.status(500).json({ error: 'Session error' });
      }

      // Set client session on new session
      req.session.clientId = clientId;

      req.session.save(async (saveErr) => {
        if (saveErr) {
          console.error('Session save error:', saveErr);
          return res.status(500).json({ error: 'Session error' });
        }

        // Get client info for response
        const client = await prisma.client.findUnique({
          where: { id: clientId },
          select: { id: true, name: true }
        });

        res.json({ success: true, client });
      });
    });
  } catch (error) {
    next(error);
  }
});

// Check current session
router.get('/me', isClientAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = await prisma.client.findUnique({
      where: { id: req.session.clientId! },
      select: { id: true, name: true, email: true }
    });

    if (!client) {
      req.session.clientId = undefined;
      return res.status(401).json({ error: 'Client not found' });
    }

    res.json({ client });
  } catch (error) {
    next(error);
  }
});

// Logout
router.post('/logout', (req: Request, res: Response) => {
  req.session.clientId = undefined;
  res.json({ success: true });
});

// Get client dashboard data
router.get('/dashboard', isClientAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = req.session.clientId!;

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        projects: {
          include: {
            tasks: {
              select: {
                id: true,
                title: true,
                description: true,
                status: true,
                dueDate: true,
                tags: true,
                completedAt: true,
                createdAt: true
              },
              orderBy: { createdAt: 'desc' }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        viewers: {
          select: {
            id: true,
            email: true,
            name: true,
            addedAt: true
          }
        }
      }
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Calculate summary stats
    const allTasks = client.projects.flatMap(p => p.tasks);
    const stats = {
      totalTasks: allTasks.length,
      completedTasks: allTasks.filter(t => t.status === 'completed').length,
      inReviewTasks: allTasks.filter(t => t.status === 'in_review').length,
      todoTasks: allTasks.filter(t => t.status === 'todo').length,
      upcomingDue: allTasks.filter(t =>
        t.dueDate &&
        t.status !== 'completed' &&
        new Date(t.dueDate) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      ).length
    };

    res.json({
      client: { id: client.id, name: client.name, email: client.email },
      projects: client.projects,
      viewers: client.viewers,
      stats
    });
  } catch (error) {
    next(error);
  }
});

// Add viewer
router.post('/viewers', isClientAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = req.session.clientId as string;
    const { email, name } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if viewer already exists
    const existing = await prisma.clientViewer.findUnique({
      where: {
        clientId_email: {
          clientId,
          email: email.toLowerCase()
        }
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'This email already has access' });
    }

    const viewer = await prisma.clientViewer.create({
      data: {
        clientId,
        email: email.toLowerCase(),
        name: name || undefined
      }
    });

    res.status(201).json(viewer);
  } catch (error) {
    next(error);
  }
});

// Remove viewer
router.delete('/viewers/:id', isClientAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = req.session.clientId as string;
    const id = req.params.id as string;

    // Verify the viewer belongs to this client
    const viewer = await prisma.clientViewer.findFirst({
      where: { id, clientId }
    });

    if (!viewer) {
      return res.status(404).json({ error: 'Viewer not found' });
    }

    await prisma.clientViewer.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Submit a task request
router.post('/submissions', isClientAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = req.session.clientId!;
    const { title, description, projectId, priority, submittedByEmail } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Get client info
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, name: true, email: true }
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Verify project belongs to client if provided
    if (projectId) {
      const project = await prisma.project.findFirst({
        where: { id: projectId, clientId }
      });
      if (!project) {
        return res.status(400).json({ error: 'Invalid project' });
      }
    }

    const submission = await prisma.taskSubmission.create({
      data: {
        clientId,
        projectId: projectId || null,
        title,
        description: description || null,
        priority: priority || null,
        submittedBy: submittedByEmail || client.email || 'Unknown',
        status: 'pending'
      }
    });

    // Notify admin
    await sendTaskSubmissionEmail(submission, client);

    res.status(201).json(submission);
  } catch (error) {
    next(error);
  }
});

// List client's submissions
router.get('/submissions', isClientAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = req.session.clientId!;

    const submissions = await prisma.taskSubmission.findMany({
      where: { clientId },
      include: {
        project: { select: { id: true, name: true } },
        task: { select: { id: true, title: true, status: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(submissions);
  } catch (error) {
    next(error);
  }
});

export default router;
