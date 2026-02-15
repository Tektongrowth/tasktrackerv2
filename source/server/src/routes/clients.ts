import { Router, Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';
import { prisma } from '../db/client.js';
import { isAuthenticated, isAdmin } from '../middleware/auth.js';
import { validateName, validateEmail, validatePhone } from '../utils/validation.js';

const router = Router();

// List all clients
router.get('/', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;
    const isAdminUser = user.role === 'admin';

    const clients = await prisma.client.findMany({
      include: {
        projects: {
          select: {
            id: true,
            name: true,
            planType: true,
            subscriptionStatus: true,
            _count: {
              select: {
                tasks: {
                  where: {
                    status: { not: 'completed' }
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Only include embedToken and ghlLocationId for admin users
    // Calculate incomplete task count for each client
    const result = clients.map(client => {
      const incompleteTaskCount = client.projects.reduce(
        (sum, project) => sum + (project._count?.tasks || 0),
        0
      );
      return {
        ...client,
        incompleteTaskCount,
        embedToken: isAdminUser ? client.embedToken : undefined,
        ghlLocationId: isAdminUser ? client.ghlLocationId : undefined
      };
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get client details (admin only - contains sensitive data)
router.get('/:id', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        projects: {
          include: {
            tasks: {
              include: {
                assignees: {
                  include: {
                    user: { select: { id: true, name: true, email: true, avatarUrl: true } }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json(client);
  } catch (error) {
    next(error);
  }
});

// Create client (admin only, for manual creation)
router.post('/', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      name, email, phone, ghlLocationId, gbpLocationId, googleAdsCustomerId,
      contactName, address, city, state, zip, websiteUrl, serviceArea, primaryServices
    } = req.body;

    // Validate inputs
    const validName = validateName(name, true);
    const validEmail = validateEmail(email);
    const validPhone = validatePhone(phone);

    // Auto-generate embed token for new clients
    const embedToken = randomBytes(24).toString('hex');

    const client = await prisma.client.create({
      data: {
        name: validName!,
        email: validEmail,
        phone: validPhone,
        embedToken,
        ghlLocationId: ghlLocationId || null,
        gbpLocationId: gbpLocationId || null,
        googleAdsCustomerId: googleAdsCustomerId || null,
        contactName: contactName || null,
        address: address || null,
        city: city || null,
        state: state || null,
        zip: zip || null,
        websiteUrl: websiteUrl || null,
        serviceArea: serviceArea || null,
        primaryServices: primaryServices || []
      }
    });

    res.status(201).json(client);
  } catch (error) {
    next(error);
  }
});

// Update client
router.patch('/:id', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const {
      name, email, phone, ghlLocationId, gbpLocationId, googleAdsCustomerId,
      contactName, address, city, state, zip, websiteUrl, serviceArea, primaryServices
    } = req.body;

    // Validate inputs if provided
    const validName = name !== undefined ? validateName(name, true) : undefined;
    const validEmail = email !== undefined ? validateEmail(email) : undefined;
    const validPhone = phone !== undefined ? validatePhone(phone) : undefined;

    const client = await prisma.client.update({
      where: { id },
      data: {
        ...(validName && { name: validName }),
        ...(validEmail !== undefined && { email: validEmail }),
        ...(validPhone !== undefined && { phone: validPhone }),
        ...(ghlLocationId !== undefined && { ghlLocationId: ghlLocationId || null }),
        ...(gbpLocationId !== undefined && { gbpLocationId: gbpLocationId || null }),
        ...(googleAdsCustomerId !== undefined && { googleAdsCustomerId: googleAdsCustomerId || null }),
        ...(contactName !== undefined && { contactName: contactName || null }),
        ...(address !== undefined && { address: address || null }),
        ...(city !== undefined && { city: city || null }),
        ...(state !== undefined && { state: state || null }),
        ...(zip !== undefined && { zip: zip || null }),
        ...(websiteUrl !== undefined && { websiteUrl: websiteUrl || null }),
        ...(serviceArea !== undefined && { serviceArea: serviceArea || null }),
        ...(primaryServices !== undefined && { primaryServices: primaryServices || [] })
      }
    });

    res.json(client);
  } catch (error) {
    next(error);
  }
});

// Regenerate embed token for a client
router.post('/:id/regenerate-embed-token', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    const token = randomBytes(24).toString('hex');

    const client = await prisma.client.update({
      where: { id },
      data: { embedToken: token }
    });

    res.json({ embedToken: client.embedToken });
  } catch (error) {
    next(error);
  }
});

// List viewers for a client
router.get('/:id/viewers', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = req.params.id as string;

    const viewers = await prisma.clientViewer.findMany({
      where: { clientId },
      orderBy: { addedAt: 'desc' }
    });

    res.json(viewers);
  } catch (error) {
    next(error);
  }
});

// Add viewer to a client
router.post('/:id/viewers', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = req.params.id as string;
    const { email, name } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if client exists
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
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
        name: name || null
      }
    });

    res.status(201).json(viewer);
  } catch (error) {
    next(error);
  }
});

// Remove viewer from a client
router.delete('/:id/viewers/:viewerId', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = req.params.id as string;
    const viewerId = req.params.viewerId as string;

    // Verify the viewer belongs to this client
    const viewer = await prisma.clientViewer.findFirst({
      where: { id: viewerId, clientId }
    });

    if (!viewer) {
      return res.status(404).json({ error: 'Viewer not found' });
    }

    await prisma.clientViewer.delete({ where: { id: viewerId } });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Delete client (only if no projects)
router.delete('/:id', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    // Check if client has projects
    const clientWithProjects = await prisma.client.findUnique({
      where: { id },
      include: { projects: true }
    });

    if (!clientWithProjects) {
      return res.status(404).json({ error: 'Client not found' });
    }

    if (clientWithProjects.projects.length > 0) {
      return res.status(400).json({ error: 'Cannot delete client with existing projects' });
    }

    await prisma.client.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
