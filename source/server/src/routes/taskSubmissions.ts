import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db/client.js';
import { isAuthenticated } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { sendSubmissionApprovedEmail } from '../services/email.js';

const router = Router();

// List all submissions (admin only)
router.get('/', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;

    if (user.role !== 'admin') {
      throw new AppError('Permission denied', 403);
    }

    const { status } = req.query;

    const where: any = {};
    if (status && typeof status === 'string') {
      where.status = status;
    }

    const submissions = await prisma.taskSubmission.findMany({
      where,
      include: {
        client: { select: { id: true, name: true, email: true } },
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

// Approve submission and create task
router.post('/:id/approve', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;

    if (user.role !== 'admin') {
      throw new AppError('Permission denied', 403);
    }

    const id = req.params.id as string;
    const { projectId, assigneeIds, dueDate } = req.body;

    // Use transaction to prevent race conditions
    const result = await prisma.$transaction(async (tx) => {
      // Lock the submission row by selecting it within transaction
      const submission = await tx.taskSubmission.findUnique({
        where: { id },
        include: { client: true, project: true }
      });

      if (!submission) {
        throw new AppError('Submission not found', 404);
      }

      if (submission.status !== 'pending') {
        throw new AppError('Submission has already been processed', 400);
      }

      // Determine project ID
      const taskProjectId = projectId || submission.projectId;
      if (!taskProjectId) {
        throw new AppError('Project ID is required', 400);
      }

      // Validate dueDate if provided
      let parsedDueDate: Date | null = null;
      if (dueDate) {
        parsedDueDate = new Date(dueDate);
        if (isNaN(parsedDueDate.getTime())) {
          throw new AppError('Invalid due date format', 400);
        }
      }

      // Create the task with assignees
      const task = await tx.task.create({
        data: {
          projectId: taskProjectId,
          title: submission.title,
          description: submission.description,
          status: 'todo',
          priority: (['low', 'medium', 'high', 'urgent'].includes(submission.priority || '')
            ? submission.priority as 'low' | 'medium' | 'high' | 'urgent'
            : 'medium'),
          dueDate: parsedDueDate,
          assignees: assigneeIds?.length ? {
            create: assigneeIds.map((userId: string) => ({ userId }))
          } : undefined
        },
        include: {
          project: { include: { client: true } },
          assignees: {
            include: {
              user: { select: { id: true, name: true, email: true, avatarUrl: true } }
            }
          }
        }
      });

      // Update submission atomically
      await tx.taskSubmission.update({
        where: { id },
        data: {
          status: 'approved',
          taskId: task.id,
          reviewedBy: user.id,
          reviewedAt: new Date()
        }
      });

      // Log activity
      await tx.taskActivity.create({
        data: {
          taskId: task.id,
          userId: user.id,
          action: 'created',
          details: { source: 'client_submission', submissionId: id }
        }
      });

      // Log audit
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'submission_approved',
          entityType: 'task_submission',
          entityIds: [id],
          details: { taskId: task.id, clientName: submission.client?.name }
        }
      });

      return { task, submission };
    });

    // Notify client (outside transaction - non-critical)
    if (result.submission.submittedBy) {
      await sendSubmissionApprovedEmail(result.submission.submittedBy, result.task.title).catch(
        (err) => console.error('Failed to send approval email:', err)
      );
    }

    res.json({ success: true, task: result.task });
  } catch (error) {
    next(error);
  }
});

// Reject submission
router.post('/:id/reject', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;

    if (user.role !== 'admin') {
      throw new AppError('Permission denied', 403);
    }

    const id = req.params.id as string;
    const { reason } = req.body;

    // Use transaction to prevent race conditions
    await prisma.$transaction(async (tx) => {
      const submission = await tx.taskSubmission.findUnique({
        where: { id },
        include: { client: true }
      });

      if (!submission) {
        throw new AppError('Submission not found', 404);
      }

      if (submission.status !== 'pending') {
        throw new AppError('Submission has already been processed', 400);
      }

      await tx.taskSubmission.update({
        where: { id },
        data: {
          status: 'rejected',
          reviewedBy: user.id,
          reviewedAt: new Date()
        }
      });

      // Log audit
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'submission_rejected',
          entityType: 'task_submission',
          entityIds: [id],
          details: { reason, clientName: submission.client?.name }
        }
      });
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
