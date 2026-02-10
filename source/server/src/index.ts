import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import passport from 'passport';
import rateLimit from 'express-rate-limit';
import { config } from 'dotenv';
import path from 'path';
import { doubleCsrf } from 'csrf-csrf';
import { initializeSocket } from './socket.js';

import { configurePassport } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import clientRoutes from './routes/clients.js';
import projectRoutes from './routes/projects.js';
import taskRoutes from './routes/tasks.js';
import templateRoutes from './routes/templates.js';
import timeEntryRoutes from './routes/timeEntries.js';
import dashboardRoutes from './routes/dashboard.js';
import webhookRoutes from './routes/webhooks.js';
import settingsRoutes from './routes/settings.js';
import tagRoutes from './routes/tags.js';
import roleRoutes from './routes/roles.js';
import clientPortalRoutes from './routes/clientPortal.js';
import projectAccessRoutes from './routes/projectAccess.js';
import searchRoutes from './routes/search.js';
import taskSubmissionsRoutes from './routes/taskSubmissions.js';
import auditLogsRoutes from './routes/auditLogs.js';
import backupsRoutes from './routes/backups.js';
import templateSetsRoutes from './routes/templateSets.js';
import embedRoutes from './routes/embed.js';
import appSettingsRoutes from './routes/appSettings.js';
import guideRoutes from './routes/guide.js';
import chatRoutes from './routes/chats.js';
import notificationRoutes from './routes/notifications.js';
import supportRoutes from './routes/support.js';
import telegramRoutes from './routes/telegram.js';
import pushRoutes from './routes/push.js';
import gifRoutes from './routes/gifs.js';
import seoRoutes from './routes/seo.js';
import { initializeScheduler } from './jobs/scheduler.js';

config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// SECURITY: Require SESSION_SECRET in production
if (isProduction && !process.env.SESSION_SECRET) {
  console.error('FATAL: SESSION_SECRET environment variable is required in production');
  process.exit(1);
}

// Trust proxy for Railway
if (isProduction) {
  app.set('trust proxy', 1);
}

// SECURITY: Add security headers via helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://accounts.google.com"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow embedding for OAuth
}));

// Stripe webhook needs raw body - must come before json middleware
app.use('/webhooks/stripe', express.raw({ type: 'application/json' }));

// SECURITY: Configure CORS with explicit origin whitelist
const getAllowedOrigins = (): string | string[] => {
  if (!isProduction) {
    return process.env.CLIENT_URL || 'http://localhost:5173';
  }
  // In production, use APP_URL or explicit CORS_ORIGINS list
  const corsOrigins = process.env.CORS_ORIGINS;
  if (corsOrigins) {
    return corsOrigins.split(',').map(o => o.trim());
  }
  // Default to APP_URL for same-origin (must be set in production)
  return process.env.APP_URL || 'http://localhost:5173';
};

app.use(cors({
  origin: getAllowedOrigins(),
  credentials: true
}));

// SECURITY: Rate limiting to prevent brute force and DoS attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    // Redirect to friendly rate limit page on frontend
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    res.redirect(`${clientUrl}/rate-limited`);
  },
});

const publicApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for VAPID public key (static, no auth needed)
    // req.path is relative to the mount point, so /api/push/... becomes /push/...
    return req.path === '/push/vapid-public-key' || req.path === '/push/status';
  },
});

// Apply rate limiters to specific routes
app.use('/auth', authLimiter);
app.use('/api/embed', publicApiLimiter);
app.use('/client-portal', publicApiLimiter);
app.use('/api/app-settings/theme', publicApiLimiter);
app.use('/api', generalApiLimiter);

// SECURITY: Limit request body size to prevent DoS
// Increased to 10mb to allow base64-encoded images for branding
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session configuration with PostgreSQL store
const PgSession = connectPgSimple(session);
const sessionStore: import('express-session').Store = isProduction
  ? new PgSession({
      conString: process.env.DATABASE_URL,
      tableName: 'user_sessions',
      createTableIfMissing: true
    })
  : new session.MemoryStore();

app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'development-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  rolling: true, // Extend session on each request so active users stay logged in
  proxy: isProduction,
  cookie: {
    secure: isProduction,
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax',
    domain: isProduction ? '.tektongrowth.com' : undefined,
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
}));

// Passport
configurePassport();
app.use(passport.initialize());
app.use(passport.session());

// CSRF protection using double-submit cookie pattern
const { doubleCsrfProtection, generateToken } = doubleCsrf({
  getSecret: () => process.env.SESSION_SECRET || 'development-secret-change-in-production',
  getSessionIdentifier: (req) => (req as any).sessionID || '',
  cookieName: '__csrf',
  cookieOptions: {
    secure: isProduction,
    sameSite: isProduction ? 'none' as const : 'lax' as const,
    httpOnly: true,
  },
  getTokenFromRequest: (req) =>
    req.headers['x-csrf-token'] as string,
});

// CSRF token endpoint
app.get('/api/csrf-token', (req, res) => {
  const token = generateToken(req, res);
  res.json({ token });
});

// CSRF protection (disabled until frontend sends X-CSRF-TOKEN header)
// To enable: have the client fetch /api/csrf-token on init and include
// the token as X-CSRF-TOKEN header on all state-changing requests.
// app.use((req, res, next) => {
//   if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
//   if (req.path.startsWith('/webhooks/')) return next();
//   if (req.path.startsWith('/auth/google')) return next();
//   doubleCsrfProtection(req, res, next);
// });

// Prevent browser caching of API responses - let client-side React Query handle caching
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Track server start time for deploy notifications
const SERVER_START_TIME = Date.now();
const DEPLOY_BANNER_DURATION = 5 * 60 * 1000; // 5 minutes

// Health check endpoint for monitoring
app.get('/health', async (_req, res) => {
  try {
    // Test database connection
    const { prisma } = await import('./db/client.js');
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'healthy', database: 'connected' });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      database: 'disconnected',
      ...(isProduction ? {} : { error: String(error) })
    });
  }
});

// Temporary debug endpoint - remove after fixing login loop
const authDebugLog: any[] = [];
app.get('/auth/debug-session', (req, res) => {
  res.json({
    sessionID: req.sessionID,
    hasSession: !!req.session,
    hasCookie: !!req.headers.cookie,
    cookieHeader: req.headers.cookie?.substring(0, 100),
    isAuthenticated: req.isAuthenticated(),
    hasUser: !!req.user,
    userId: (req.user as any)?.id,
    sessionPassport: (req.session as any)?.passport,
    origin: req.headers.origin,
    referer: req.headers.referer,
    xForwardedProto: req.headers['x-forwarded-proto'],
    xForwardedFor: req.headers['x-forwarded-for'],
    reqSecure: req.secure,
    nodeEnv: process.env.NODE_ENV,
    isProductionFlag: isProduction,
    recentAuthMeLogs: authDebugLog.slice(-5),
  });
});
// Log /auth/me requests for debugging
app.use('/auth/me', (req, _res, next) => {
  authDebugLog.push({
    ts: new Date().toISOString(),
    hasCookie: !!req.headers.cookie,
    cookieKeys: req.headers.cookie?.split(';').map((c: string) => c.trim().split('=')[0]),
    sessionID: req.sessionID?.substring(0, 10),
    isAuthenticated: req.isAuthenticated(),
    hasUser: !!req.user,
    sessionPassport: (req.session as any)?.passport,
    xForwardedProto: req.headers['x-forwarded-proto'],
  });
  if (authDebugLog.length > 20) authDebugLog.shift();
  next();
});

// Deploy status endpoint - returns whether we're in the post-deploy window
app.get('/api/deploy-status', (_req, res) => {
  const uptime = Date.now() - SERVER_START_TIME;
  const isDeploying = uptime < DEPLOY_BANNER_DURATION;
  const remainingMs = Math.max(0, DEPLOY_BANNER_DURATION - uptime);

  res.json({
    isDeploying,
    uptimeMs: uptime,
    remainingMs,
    serverStartTime: SERVER_START_TIME
  });
});

// API Routes
app.use('/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/time-entries', timeEntryRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/client-portal', clientPortalRoutes);
app.use('/api/project-access', projectAccessRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/task-submissions', taskSubmissionsRoutes);
app.use('/api/audit-logs', auditLogsRoutes);
app.use('/api/backups', backupsRoutes);
app.use('/api/template-sets', templateSetsRoutes);
app.use('/api/embed', embedRoutes);
app.use('/api/app-settings', appSettingsRoutes);
app.use('/api/guide', guideRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/gifs', gifRoutes);
app.use('/api/seo', seoRoutes);
app.use('/webhooks', webhookRoutes);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const clientPath = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientPath));
  app.get('*', (req, res) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith('/api') || req.path.startsWith('/auth') || req.path.startsWith('/webhooks')) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Allow framing for embed and client-portal routes (for GHL iframe embedding)
    // SECURITY: Configure FRAME_ANCESTORS env var with allowed domains (comma-separated)
    // Default to 'self' if not configured for security
    if (req.path.startsWith('/embed/') || req.path.startsWith('/client-portal')) {
      res.removeHeader('X-Frame-Options');
      const frameAncestors = process.env.FRAME_ANCESTORS || "'self'";
      res.setHeader('Content-Security-Policy', `frame-ancestors ${frameAncestors};`);
    }

    // Serve index.html for all client-side routes including client portal
    res.sendFile(path.join(clientPath, 'index.html'));
  });
}

// Error handler
app.use(errorHandler);

// Initialize Socket.IO with session store for auth
const io = initializeSocket(httpServer, getAllowedOrigins(), sessionStore);

// Store io instance for use in routes
app.set('io', io);

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // Initialize scheduled jobs
  initializeScheduler();
});

export default app;
export { io };
