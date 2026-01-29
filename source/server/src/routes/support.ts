import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db/client.js';
import { isAuthenticated } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { sendBugReportEmail, BugReport, sendFeatureRequestEmail, FeatureRequest } from '../services/email.js';
import { sendTelegramMessage, escapeTelegramHtml } from '../services/telegram.js';

const router = Router();

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

    // Send Telegram notification to admins
    const urgencyEmoji = urgency === 'blocking' ? '🚨' : urgency === 'annoying' ? '⚠️' : '📝';
    const telegramMessage = `${urgencyEmoji} <b>Bug Report</b> (${urgency.toUpperCase()})\n\n<b>From:</b> ${escapeTelegramHtml(user.name)}\n<b>Issue:</b> ${escapeTelegramHtml(action.substring(0, 100))}${action.length > 100 ? '...' : ''}\n\n<i>Check email for full details</i>`;
    notifyAdminsViaTelegram(telegramMessage);

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

    // Send Telegram notification to admins
    const priorityEmoji = priority === 'important' ? '⭐' : priority === 'would_help' ? '💡' : '✨';
    const telegramMessage = `${priorityEmoji} <b>Feature Request</b>\n\n<b>From:</b> ${escapeTelegramHtml(user.name)}\n<b>Feature:</b> ${escapeTelegramHtml(title.substring(0, 100))}${title.length > 100 ? '...' : ''}\n\n<i>Check email for full details</i>`;
    notifyAdminsViaTelegram(telegramMessage);

    res.json({ success: true, message: 'Feature request submitted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
