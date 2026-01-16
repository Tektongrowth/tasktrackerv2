import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db/client.js';
import { isAuthenticated } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { runBackup } from '../jobs/databaseBackup.js';
import { logAudit, AuditActions, EntityTypes } from '../services/auditLog.js';
import fs from 'fs';

const router = Router();

// All backup routes require admin
router.use(isAuthenticated);
router.use((req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'admin') {
    return next(new AppError('Admin access required', 403));
  }
  next();
});

// List all backups
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const backups = await prisma.databaseBackup.findMany({
      orderBy: { createdAt: 'desc' },
    });

    res.json(backups);
  } catch (error) {
    next(error);
  }
});

// Trigger a manual backup
router.post('/trigger', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const backup = await runBackup();

    if (backup) {
      await logAudit({
        userId: req.user!.id,
        action: AuditActions.BACKUP_CREATED,
        entityType: EntityTypes.BACKUP,
        entityIds: [backup.id],
        details: { filename: backup.filename, sizeBytes: backup.sizeBytes, manual: true },
        ipAddress: req.ip || undefined,
      });

      res.json({ success: true, backup });
    } else {
      res.status(500).json({ error: 'Backup failed' });
    }
  } catch (error) {
    next(error);
  }
});

// Delete a backup
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const backup = await prisma.databaseBackup.findUnique({
      where: { id },
    });

    if (!backup) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    // Try to delete the file
    try {
      if (fs.existsSync(backup.path)) {
        fs.unlinkSync(backup.path);
      }
    } catch (fileError) {
      console.error('Failed to delete backup file:', fileError);
    }

    // Delete the database record
    await prisma.databaseBackup.delete({
      where: { id },
    });

    await logAudit({
      userId: req.user!.id,
      action: AuditActions.BACKUP_DELETED,
      entityType: EntityTypes.BACKUP,
      entityIds: [id],
      details: { filename: backup.filename },
      ipAddress: req.ip || undefined,
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Get backup statistics
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [backups, totalSize] = await Promise.all([
      prisma.databaseBackup.count(),
      prisma.databaseBackup.aggregate({
        _sum: { sizeBytes: true },
      }),
    ]);

    const latestBackup = await prisma.databaseBackup.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      totalBackups: backups,
      totalSizeBytes: totalSize._sum.sizeBytes || 0,
      lastBackupAt: latestBackup?.createdAt || null,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
