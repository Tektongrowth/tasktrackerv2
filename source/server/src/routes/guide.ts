import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db/client.js';
import { isAuthenticated } from '../middleware/auth.js';

const router = Router();

// Get user's guide state (hasSeenWelcome + completed guides)
router.get('/state', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as Express.User).id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        hasSeenWelcome: true,
        role: true,
        guideCompletions: {
          select: {
            guideId: true,
            completedAt: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const completedGuides = user.guideCompletions.map(gc => gc.guideId);

    res.json({
      hasSeenWelcome: user.hasSeenWelcome,
      role: user.role,
      completedGuides
    });
  } catch (error) {
    next(error);
  }
});

// Mark welcome wizard as seen
router.post('/welcome-seen', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as Express.User).id;

    await prisma.user.update({
      where: { id: userId },
      data: { hasSeenWelcome: true }
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Mark a specific guide as complete
router.post('/complete/:guideId', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as Express.User).id;
    const guideId = req.params.guideId as string;

    // Validate guideId
    const validGuideIds = [
      'welcome',
      'dashboard',
      'kanban',
      'timeTracking',
      'settings',
      'templates',
      'submissions',
      'clientPortal'
    ];

    if (!validGuideIds.includes(guideId)) {
      return res.status(400).json({ error: 'Invalid guide ID' });
    }

    // Upsert guide completion
    await prisma.guideCompletion.upsert({
      where: {
        userId_guideId: {
          userId,
          guideId
        }
      },
      update: {
        completedAt: new Date()
      },
      create: {
        userId,
        guideId
      }
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Reset all guide progress for user
router.post('/reset', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as Express.User).id;

    // Delete all guide completions for user
    await prisma.guideCompletion.deleteMany({
      where: { userId }
    });

    // Reset hasSeenWelcome
    await prisma.user.update({
      where: { id: userId },
      data: { hasSeenWelcome: false }
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
