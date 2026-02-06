import { spawn } from 'child_process';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { prisma } from '../db/client.js';

const BACKUP_DIR = process.env.BACKUP_DIR || '/data/backups';
const RETENTION_DAYS = 7;

/**
 * Creates a database backup using pg_dump
 * Runs daily at 2:00 AM
 * Keeps backups for 7 days
 */
export async function runDatabaseBackup() {
  console.log('[Job] Running database backup...');

  const jobRun = await prisma.scheduledJobRun.create({
    data: { jobName: 'database_backup', status: 'started' }
  });

  try {
    // Ensure backup directory exists
    try {
      await fs.mkdir(BACKUP_DIR, { recursive: true });
    } catch (err) {
      // Directory might already exist
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.sql.gz`;
    const filepath = path.join(BACKUP_DIR, filename);

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL not configured');
    }

    console.log(`[Job] Creating backup at ${filepath}`);

    // Run pg_dump with gzip compression using safe spawn (no shell interpolation)
    await new Promise<void>((resolve, reject) => {
      const pgDump = spawn('pg_dump', [databaseUrl], { stdio: ['ignore', 'pipe', 'pipe'] });
      const gzip = createGzip();
      const output = createWriteStream(filepath);

      let stderrData = '';
      pgDump.stderr.on('data', (chunk) => { stderrData += chunk; });

      pipeline(pgDump.stdout, gzip, output)
        .then(() => {
          if (pgDump.exitCode !== 0) {
            reject(new Error(`pg_dump exited with code ${pgDump.exitCode}: ${stderrData}`));
          } else {
            resolve();
          }
        })
        .catch(reject);

      const timeout = setTimeout(() => {
        pgDump.kill();
        reject(new Error('pg_dump timed out after 10 minutes'));
      }, 600000);

      pgDump.on('close', () => clearTimeout(timeout));
    });

    // Get file size
    const stats = await fs.stat(filepath);
    console.log(`[Job] Backup created: ${filename} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

    // Record backup in database
    await prisma.databaseBackup.create({
      data: {
        filename,
        sizeBytes: stats.size,
        path: filepath,
        expiresAt: new Date(Date.now() + RETENTION_DAYS * 24 * 60 * 60 * 1000)
      }
    });

    // Delete old backups
    const expiredBackups = await prisma.databaseBackup.findMany({
      where: { expiresAt: { lt: new Date() } }
    });

    let deletedCount = 0;
    for (const backup of expiredBackups) {
      try {
        await fs.unlink(backup.path);
        console.log(`[Job] Deleted expired backup: ${backup.filename}`);
      } catch (e) {
        console.error(`[Job] Failed to delete backup file: ${backup.path}`);
      }
      await prisma.databaseBackup.delete({ where: { id: backup.id } });
      deletedCount++;
    }

    // Log audit
    await prisma.auditLog.create({
      data: {
        action: 'backup_completed',
        entityType: 'backup',
        entityIds: [filename],
        details: {
          sizeBytes: stats.size,
          deletedOldBackups: deletedCount
        }
      }
    });

    await prisma.scheduledJobRun.update({
      where: { id: jobRun.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        details: { filename, sizeBytes: stats.size, deletedOldBackups: deletedCount }
      }
    });

    console.log('[Job] Database backup completed successfully');

    // Return the backup record
    const backup = await prisma.databaseBackup.findFirst({
      orderBy: { createdAt: 'desc' }
    });
    return backup;
  } catch (error) {
    console.error('[Job] Database backup failed:', error);
    await prisma.scheduledJobRun.update({
      where: { id: jobRun.id },
      data: {
        status: 'failed',
        completedAt: new Date(),
        details: { error: String(error) }
      }
    });
    throw error;
  }
}

// Alias for the backup route to trigger manually
export const runBackup = runDatabaseBackup;
