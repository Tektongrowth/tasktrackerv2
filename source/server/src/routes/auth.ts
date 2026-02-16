import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { isAuthenticated } from '../middleware/auth.js';

const router = Router();

// Initiate Google OAuth
router.get('/google', passport.authenticate('google', {
  scope: [
    'profile',
    'email',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/spreadsheets',
  ],
  accessType: 'offline',
  prompt: 'consent',
} as any));

// Google OAuth callback
router.get('/google/callback', (req: Request, res: Response, next: NextFunction) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  passport.authenticate('google', (err: Error | null, user: Express.User | false) => {
    if (err || !user) {
      return res.redirect(`${clientUrl}/login?error=auth_failed`);
    }
    req.logIn(user, (loginErr) => {
      if (loginErr) {
        return res.redirect(`${clientUrl}/login?error=auth_failed`);
      }
      return res.redirect(`${clientUrl}/dashboard`);
    });
  })(req, res, next);
});

// Handle invite link with token
router.get('/invite/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    // Store token in session for post-OAuth linking
    (req.session as any).inviteToken = token;
    res.redirect('/auth/google');
  } catch (error) {
    next(error);
  }
});

// Logout
router.post('/logout', (req: Request, res: Response) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ success: true });
  });
});

// Get current user
router.get('/me', isAuthenticated, (req: Request, res: Response) => {
  res.json({ user: req.user });
});

export default router;
