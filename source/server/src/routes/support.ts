import { Router, Request, Response, NextFunction } from 'express';
import { isAuthenticated } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { sendBugReportEmail, BugReport } from '../services/email.js';

const router = Router();

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

    res.json({ success: true, message: 'Bug report submitted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
