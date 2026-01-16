import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db/client.js';
import { isAuthenticated, isAdmin } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// List all tags
router.get('/', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tags = await prisma.tag.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(tags);
  } catch (error) {
    next(error);
  }
});

// Create tag
router.post('/', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, color } = req.body;

    const existing = await prisma.tag.findUnique({ where: { name } });
    if (existing) {
      throw new AppError('Tag already exists', 400);
    }

    const tag = await prisma.tag.create({
      data: { name, color }
    });

    res.status(201).json(tag);
  } catch (error) {
    next(error);
  }
});

// Update tag
router.patch('/:id', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { name, color } = req.body;

    const tag = await prisma.tag.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(color && { color })
      }
    });

    res.json(tag);
  } catch (error) {
    next(error);
  }
});

// Delete tag
router.delete('/:id', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    await prisma.tag.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
