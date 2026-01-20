import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db/client.js';
import { isAuthenticated } from '../middleware/auth.js';

const router = Router();

// Get all mention notifications for the current user
router.get('/mentions', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;

    const mentions = await prisma.commentMention.findMany({
      where: {
        userId: user.id,
      },
      include: {
        comment: {
          include: {
            user: {
              select: { id: true, name: true, avatarUrl: true },
            },
            task: {
              select: {
                id: true,
                title: true,
                project: {
                  select: {
                    id: true,
                    name: true,
                    client: {
                      select: { id: true, name: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50, // Limit to most recent 50 mentions
    });

    // Transform to a cleaner format
    const notifications = mentions.map((mention) => ({
      id: mention.id,
      readAt: mention.readAt,
      createdAt: mention.createdAt,
      commentId: mention.commentId,
      commentContent: mention.comment.content,
      mentionedBy: mention.comment.user,
      task: mention.comment.task,
    }));

    res.json(notifications);
  } catch (error) {
    next(error);
  }
});

// Get unread mention count
router.get('/mentions/unread-count', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;

    const count = await prisma.commentMention.count({
      where: {
        userId: user.id,
        readAt: null,
      },
    });

    res.json({ unreadCount: count });
  } catch (error) {
    next(error);
  }
});

// Mark mentions as read
router.post('/mentions/read', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;
    const { mentionIds } = req.body;

    if (!Array.isArray(mentionIds) || mentionIds.length === 0) {
      return res.status(400).json({ error: 'mentionIds array required' });
    }

    await prisma.commentMention.updateMany({
      where: {
        id: { in: mentionIds },
        userId: user.id, // Only allow marking own mentions as read
      },
      data: {
        readAt: new Date(),
      },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Mark all mentions as read
router.post('/mentions/read-all', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;

    await prisma.commentMention.updateMany({
      where: {
        userId: user.id,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
