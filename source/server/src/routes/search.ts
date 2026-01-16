import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db/client.js';
import { isAuthenticated } from '../middleware/auth.js';

const router = Router();

router.get('/', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;
    const { q, limit = '10', page = '1' } = req.query;

    if (!q || typeof q !== 'string' || q.length < 2) {
      return res.json({ tasks: [], projects: [], clients: [], pagination: { page: 1, hasMore: false } });
    }

    const query = q.toLowerCase();
    const limitNum = Math.min(parseInt(limit as string) || 10, 50);
    const pageNum = Math.max(parseInt(page as string) || 1, 1);
    const skip = (pageNum - 1) * limitNum;

    // Build task query based on user role
    const taskWhere: any = {
      archived: false,
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ],
    };

    // Contractors can only see tasks assigned to them or from accessible projects
    if (user.role !== 'admin') {
      const projectAccess = await prisma.projectAccess.findMany({
        where: { userId: user.id, canView: true },
        select: { projectId: true },
      });
      const allowedProjectIds = projectAccess.map((pa) => pa.projectId);

      taskWhere.AND = {
        OR: [
          { assignedTo: user.id },
          ...(allowedProjectIds.length > 0 ? [{ projectId: { in: allowedProjectIds } }] : []),
        ],
      };
    }

    // Run all searches in parallel (fetch one extra to check if there's more)
    const [tasks, projects, clients, taskCount] = await Promise.all([
      // Tasks - all users
      prisma.task.findMany({
        where: taskWhere,
        include: {
          project: {
            include: {
              client: { select: { id: true, name: true } },
            },
          },
          assignees: {
            include: {
              user: { select: { id: true, name: true, email: true, avatarUrl: true } }
            }
          },
        },
        skip,
        take: limitNum + 1, // Fetch one extra to check for more
        orderBy: { updatedAt: 'desc' },
      }),

      // Projects - admin only
      user.role === 'admin'
        ? prisma.project.findMany({
            where: {
              name: { contains: query, mode: 'insensitive' },
            },
            include: {
              client: { select: { id: true, name: true } },
            },
            skip,
            take: limitNum + 1,
            orderBy: { updatedAt: 'desc' },
          })
        : [],

      // Clients - admin only
      user.role === 'admin'
        ? prisma.client.findMany({
            where: {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { email: { contains: query, mode: 'insensitive' } },
              ],
            },
            skip,
            take: limitNum + 1,
            orderBy: { updatedAt: 'desc' },
          })
        : [],

      // Count total tasks for pagination
      prisma.task.count({ where: taskWhere }),
    ]);

    // Check if there are more results
    const hasMoreTasks = tasks.length > limitNum;
    const hasMoreProjects = projects.length > limitNum;
    const hasMoreClients = clients.length > limitNum;

    res.json({
      tasks: tasks.slice(0, limitNum),
      projects: projects.slice(0, limitNum),
      clients: clients.slice(0, limitNum),
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalTasks: taskCount,
        hasMore: hasMoreTasks || hasMoreProjects || hasMoreClients,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
