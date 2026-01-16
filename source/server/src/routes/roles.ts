import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db/client.js';
import { isAuthenticated, isAdmin } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// List all roles
router.get('/', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roles = await prisma.role.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(roles);
  } catch (error) {
    next(error);
  }
});

// Create role
router.post('/', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, color, description } = req.body;

    const existing = await prisma.role.findUnique({ where: { name } });
    if (existing) {
      throw new AppError('Role already exists', 400);
    }

    const role = await prisma.role.create({
      data: { name, color, description }
    });

    res.status(201).json(role);
  } catch (error) {
    next(error);
  }
});

// Update role
router.patch('/:id', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { name, color, description } = req.body;

    const role = await prisma.role.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(color !== undefined && { color }),
        ...(description !== undefined && { description })
      }
    });

    res.json(role);
  } catch (error) {
    next(error);
  }
});

// Delete role
router.delete('/:id', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    await prisma.role.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
