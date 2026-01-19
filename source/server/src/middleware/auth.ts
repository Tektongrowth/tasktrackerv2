import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/client.js';

export function configurePassport() {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackURL: `${process.env.APP_URL || 'http://localhost:3001'}/auth/google/callback`
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      const avatarUrl = profile.photos?.[0]?.value || null;

      if (!email) {
        return done(new Error('No email found in Google profile'));
      }

      // Check if user exists by Google ID
      let user = await prisma.user.findUnique({
        where: { googleId: profile.id }
      });

      if (!user) {
        // Check if user was invited (exists with email but no googleId)
        user = await prisma.user.findUnique({
          where: { email }
        });

        if (user) {
          // Link Google account to existing invited user
          user = await prisma.user.update({
            where: { email },
            data: {
              googleId: profile.id,
              name: profile.displayName || user.name,
              avatarUrl,
              inviteToken: null
            }
          });
        } else {
          // Not invited - check if this is an allowed admin email
          const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
          if (adminEmails.includes(email.toLowerCase())) {
            user = await prisma.user.create({
              data: {
                email,
                name: profile.displayName || email.split('@')[0],
                googleId: profile.id,
                avatarUrl,
                role: 'admin',
                permissions: {}
              }
            });
          } else {
            return done(new Error('You have not been invited to this application'));
          }
        }
      } else {
        // Update avatar URL on each login in case it changed
        if (avatarUrl && avatarUrl !== user.avatarUrl) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { avatarUrl }
          });
        }
      }

      if (!user.active) {
        return done(new Error('Your account has been deactivated'));
      }

      // Convert Prisma user to Express.User type
      const expressUser: Express.User = {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role,
        accessLevel: user.accessLevel,
        permissions: (user.permissions as Record<string, boolean>) || {}
      };

      return done(null, expressUser);
    } catch (error) {
      return done(error as Error);
    }
  }));

  passport.serializeUser((user: Express.User, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id }
      });
      if (!user) {
        return done(null, false);
      }
      // Convert Prisma user to Express.User type
      const expressUser: Express.User = {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role,
        accessLevel: user.accessLevel,
        permissions: (user.permissions as Record<string, boolean>) || {}
      };
      done(null, expressUser);
    } catch (error) {
      done(error);
    }
  });
}

export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
}

export function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated() && (req.user as any)?.role === 'admin') {
    return next();
  }
  res.status(403).json({ error: 'Admin access required' });
}

export function hasPermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Admins have all permissions
    if (user.role === 'admin') {
      return next();
    }

    const permissions = user.permissions || {};
    if (permissions[permission]) {
      return next();
    }

    res.status(403).json({ error: 'Permission denied' });
  };
}

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      name: string;
      avatarUrl: string | null;
      role: string;
      accessLevel: string;
      permissions: Record<string, boolean>;
    }
  }
}
