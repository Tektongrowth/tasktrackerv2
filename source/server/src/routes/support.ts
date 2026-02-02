import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db/client.js';
import { isAuthenticated } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { sendBugReportEmail, BugReport, sendFeatureRequestEmail, FeatureRequest } from '../services/email.js';
import { sendTelegramMessage, escapeTelegramHtml, sendBugReportToChannel } from '../services/telegram.js';

const router = Router();

// Internal project name for bug reports and feature requests
const INTERNAL_CLIENT_NAME = 'Internal';
const INTERNAL_PROJECT_NAME = 'Bug Reports & Feature Requests';

// Get or create the internal project for bug reports and feature requests
async function getOrCreateInternalProject(): Promise<string> {
  // Check if internal client exists
  let client = await prisma.client.findFirst({
    where: { name: INTERNAL_CLIENT_NAME }
  });

  if (!client) {
    client = await prisma.client.create({
      data: { name: INTERNAL_CLIENT_NAME }
    });
  }

  // Check if internal project exists
  let project = await prisma.project.findFirst({
    where: {
      clientId: client.id,
      name: INTERNAL_PROJECT_NAME
    }
  });

  if (!project) {
    project = await prisma.project.create({
      data: {
        clientId: client.id,
        name: INTERNAL_PROJECT_NAME,
        subscriptionStatus: 'active'
      }
    });
  }

  return project.id;
}

// Get all admin user IDs
async function getAdminUserIds(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: {
      role: 'admin',
      active: true,
      archived: false
    },
    select: { id: true }
  });
  return admins.map(a => a.id);
}

// Helper to send Telegram notifications to admins
async function notifyAdminsViaTelegram(message: string) {
  try {
    // Find all admins with Telegram connected
    const admins = await prisma.user.findMany({
      where: {
        role: 'admin',
        telegramChatId: { not: null },
        active: true,
        archived: false,
      },
      select: { telegramChatId: true },
    });

    // Send to all connected admins
    for (const admin of admins) {
      if (admin.telegramChatId) {
        await sendTelegramMessage(admin.telegramChatId, message);
      }
    }
  } catch (error) {
    console.error('Failed to send admin Telegram notification:', error);
  }
}

// Submit a bug report
router.post('/bug-report', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;
    const {
      action,
      actual,
      errorMessage,
      steps,
      browser,
      device,
      urgency,
      screenshotUrl
    } = req.body;

    // Validate required fields
    if (!action || !actual || !steps || !browser || !device || !urgency) {
      throw new AppError('Missing required fields', 400);
    }

    // Validate urgency value
    if (!['blocking', 'annoying', 'minor'].includes(urgency)) {
      throw new AppError('Invalid urgency level', 400);
    }

    // Map access level to readable role
    const roleMap: Record<string, string> = {
      admin: 'Admin',
      project_manager: 'Project Manager',
      editor: 'Editor',
      viewer: 'Viewer'
    };

    const report: BugReport = {
      action,
      expected: '', // Not required in form
      actual,
      errorMessage: errorMessage || undefined,
      steps,
      reporterName: user.name,
      reporterRole: roleMap[user.accessLevel] || user.accessLevel,
      browser,
      device,
      urgency,
      screenshotUrl: screenshotUrl || undefined
    };

    await sendBugReportEmail(report);

    // Create task in internal project
    const projectId = await getOrCreateInternalProject();
    const adminIds = await getAdminUserIds();

    // Set due date based on urgency: blocking = 1 day, annoying = 3 days, minor = 7 days
    const dueDaysMap: Record<string, number> = {
      blocking: 1,
      annoying: 3,
      minor: 7
    };
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (dueDaysMap[urgency] || 7));

    // Map urgency to task priority
    const priorityMap: Record<string, 'high' | 'medium' | 'low'> = {
      blocking: 'high',
      annoying: 'medium',
      minor: 'low'
    };

    // Build task description
    const taskDescription = `**Reported by:** ${user.name}
**Browser:** ${browser}
**Device:** ${device}
**Urgency:** ${urgency}

**What were you trying to do?**
${action}

**What actually happened?**
${actual}

**Error message (if any):**
${errorMessage || 'None'}

**Steps to reproduce:**
${steps}${screenshotUrl ? `\n\n**Screenshot:** ${screenshotUrl}` : ''}`;

    await prisma.task.create({
      data: {
        projectId,
        title: `🐛 Bug: ${action.substring(0, 80)}${action.length > 80 ? '...' : ''}`,
        description: taskDescription,
        priority: priorityMap[urgency] || 'medium',
        status: 'todo',
        dueDate,
        tags: ['bug-report', urgency],
        assignees: adminIds.length > 0 ? {
          create: adminIds.map(userId => ({ userId }))
        } : undefined
      }
    });

    // Send Telegram notification to admins
    const urgencyEmoji = urgency === 'blocking' ? '🚨' : urgency === 'annoying' ? '⚠️' : '📝';
    const telegramMessage = `${urgencyEmoji} <b>Bug Report</b> (${urgency.toUpperCase()})\n\n<b>From:</b> ${escapeTelegramHtml(user.name)}\n<b>Issue:</b> ${escapeTelegramHtml(action)}\n\n<i>Task created in Bug Reports & Feature Requests project</i>`;
    notifyAdminsViaTelegram(telegramMessage);

    // Claude bug channel analysis - disabled for now
    // sendBugReportToChannel({
    //   reporterName: user.name,
    //   action,
    //   actual,
    //   steps,
    //   urgency,
    //   errorMessage: errorMessage || undefined,
    //   browser,
    //   device,
    // });

    res.json({ success: true, message: 'Bug report submitted successfully' });
  } catch (error) {
    next(error);
  }
});

// Submit a feature request
router.post('/feature-request', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;
    const { title, description, useCase, priority } = req.body;

    // Validate required fields
    if (!title || !description || !useCase || !priority) {
      throw new AppError('Missing required fields', 400);
    }

    // Validate priority value
    if (!['nice_to_have', 'would_help', 'important'].includes(priority)) {
      throw new AppError('Invalid priority level', 400);
    }

    // Map access level to readable role
    const roleMap: Record<string, string> = {
      admin: 'Admin',
      project_manager: 'Project Manager',
      editor: 'Editor',
      viewer: 'Viewer'
    };

    const request: FeatureRequest = {
      title,
      description,
      useCase,
      priority,
      reporterName: user.name,
      reporterRole: roleMap[user.accessLevel] || user.accessLevel,
    };

    await sendFeatureRequestEmail(request);

    // Create task in internal project
    const projectId = await getOrCreateInternalProject();
    const adminIds = await getAdminUserIds();

    // Set due date based on priority: important = 7 days, would_help = 14 days, nice_to_have = 30 days
    const dueDaysMap: Record<string, number> = {
      important: 7,
      would_help: 14,
      nice_to_have: 30
    };
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (dueDaysMap[priority] || 14));

    // Map priority to task priority
    const priorityMap: Record<string, 'high' | 'medium' | 'low'> = {
      important: 'high',
      would_help: 'medium',
      nice_to_have: 'low'
    };

    // Build task description
    const taskDescription = `**Requested by:** ${user.name}
**Priority:** ${priority.replace('_', ' ')}

**Feature:**
${description}

**Use Case:**
${useCase}`;

    await prisma.task.create({
      data: {
        projectId,
        title: `✨ Feature: ${title.substring(0, 80)}${title.length > 80 ? '...' : ''}`,
        description: taskDescription,
        priority: priorityMap[priority] || 'medium',
        status: 'todo',
        dueDate,
        tags: ['feature-request', priority.replace('_', '-')],
        assignees: adminIds.length > 0 ? {
          create: adminIds.map(userId => ({ userId }))
        } : undefined
      }
    });

    // Send Telegram notification to admins
    const priorityEmoji = priority === 'important' ? '⭐' : priority === 'would_help' ? '💡' : '✨';
    const telegramMessage = `${priorityEmoji} <b>Feature Request</b>\n\n<b>From:</b> ${escapeTelegramHtml(user.name)}\n<b>Feature:</b> ${escapeTelegramHtml(title)}\n\n<i>Task created in Bug Reports & Feature Requests project</i>`;
    notifyAdminsViaTelegram(telegramMessage);

    res.json({ success: true, message: 'Feature request submitted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
