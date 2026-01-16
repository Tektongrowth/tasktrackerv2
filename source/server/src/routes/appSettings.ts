import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db/client.js';
import { isAuthenticated, isAdmin } from '../middleware/auth.js';

const router = Router();

// Default theme settings
const defaultTheme = {
  colors: {
    primary: '#35a9ad',
    accent: '#4cf2f7',
    background: '#f9f9f9',
    cardBackground: '#ffffff',
    text: '#1a1a1a',
    mutedText: '#737373',
    border: '#e5e5e5',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444'
  },
  borderRadius: 'medium',
  fonts: {
    heading: 'Inter',
    body: 'Inter'
  },
  branding: {
    logoUrl: '',
    backgroundImage: '',
    backgroundColor: ''
  }
};

// Get current theme (public - needed for app loading)
router.get('/theme', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await prisma.appSettings.findUnique({
      where: { id: 'default' }
    });

    res.json(settings?.theme || defaultTheme);
  } catch (error) {
    next(error);
  }
});

// Update theme (admin only)
router.patch('/theme', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { theme } = req.body;
    const user = req.user as Express.User;

    const settings = await prisma.appSettings.upsert({
      where: { id: 'default' },
      update: {
        theme,
        updatedBy: user.id
      },
      create: {
        id: 'default',
        theme,
        updatedBy: user.id
      }
    });

    res.json(settings.theme);
  } catch (error) {
    next(error);
  }
});

// Reset theme to defaults (admin only)
router.post('/theme/reset', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;

    const settings = await prisma.appSettings.upsert({
      where: { id: 'default' },
      update: {
        theme: defaultTheme,
        updatedBy: user.id
      },
      create: {
        id: 'default',
        theme: defaultTheme,
        updatedBy: user.id
      }
    });

    res.json(settings.theme);
  } catch (error) {
    next(error);
  }
});

// Default email templates
const defaultEmailTemplates = {
  welcome: {
    subject: 'Welcome to Task Tracker!',
    heading: 'Welcome to the team!',
    body: 'You have been invited to join Task Tracker. Click the button below to complete your account setup and get started.',
    buttonText: 'Complete Setup',
    footer: 'If you have any questions, please contact your administrator.'
  }
};

// Get email templates (admin only)
router.get('/email-templates', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await prisma.appSettings.findUnique({
      where: { id: 'default' }
    });

    const templates = (settings?.emailTemplates || {}) as Partial<typeof defaultEmailTemplates>;
    const mergedTemplates = {
      welcome: { ...defaultEmailTemplates.welcome, ...(templates.welcome || {}) }
    };

    res.json(mergedTemplates);
  } catch (error) {
    next(error);
  }
});

// Update email templates (admin only)
router.patch('/email-templates', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { templates } = req.body;
    const user = req.user as Express.User;

    // Validate templates structure
    if (!templates || typeof templates !== 'object') {
      return res.status(400).json({ error: 'Invalid templates format' });
    }

    // Get current templates
    const settings = await prisma.appSettings.findUnique({
      where: { id: 'default' }
    });

    type WelcomeTemplate = typeof defaultEmailTemplates.welcome;
    const currentTemplates = (settings?.emailTemplates || {}) as Partial<typeof defaultEmailTemplates>;
    const currentWelcome: Partial<WelcomeTemplate> = currentTemplates.welcome || {};

    // Merge with new templates (only allow specific keys)
    const incomingWelcome: Partial<WelcomeTemplate> = templates.welcome && typeof templates.welcome === 'object' ? templates.welcome : {};
    const updatedTemplates: typeof defaultEmailTemplates = {
      welcome: {
        subject: typeof incomingWelcome.subject === 'string' ? incomingWelcome.subject : (currentWelcome.subject || defaultEmailTemplates.welcome.subject),
        heading: typeof incomingWelcome.heading === 'string' ? incomingWelcome.heading : (currentWelcome.heading || defaultEmailTemplates.welcome.heading),
        body: typeof incomingWelcome.body === 'string' ? incomingWelcome.body : (currentWelcome.body || defaultEmailTemplates.welcome.body),
        buttonText: typeof incomingWelcome.buttonText === 'string' ? incomingWelcome.buttonText : (currentWelcome.buttonText || defaultEmailTemplates.welcome.buttonText),
        footer: typeof incomingWelcome.footer === 'string' ? incomingWelcome.footer : (currentWelcome.footer || defaultEmailTemplates.welcome.footer),
      }
    };

    await prisma.appSettings.upsert({
      where: { id: 'default' },
      update: {
        emailTemplates: updatedTemplates,
        updatedBy: user.id
      },
      create: {
        id: 'default',
        emailTemplates: updatedTemplates,
        updatedBy: user.id
      }
    });

    res.json(updatedTemplates);
  } catch (error) {
    next(error);
  }
});

// Reset email templates to defaults (admin only)
router.post('/email-templates/reset', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;

    await prisma.appSettings.upsert({
      where: { id: 'default' },
      update: {
        emailTemplates: defaultEmailTemplates,
        updatedBy: user.id
      },
      create: {
        id: 'default',
        emailTemplates: defaultEmailTemplates,
        updatedBy: user.id
      }
    });

    res.json(defaultEmailTemplates);
  } catch (error) {
    next(error);
  }
});

export default router;
