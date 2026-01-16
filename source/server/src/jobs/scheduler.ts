import cron from 'node-cron';
import { runDueDateReminders } from './dueDateReminder.js';
import { runMonthlyReport } from './monthlyTimeReport.js';
import { runDatabaseBackup } from './databaseBackup.js';

/**
 * Initialize all scheduled jobs
 * Call this from index.ts on server startup
 */
export function initializeScheduler() {
  console.log('[Scheduler] Initializing scheduled jobs...');

  // Due date reminders - daily at 8:00 AM
  cron.schedule('0 8 * * *', async () => {
    console.log('[Scheduler] Triggering due date reminders...');
    try {
      await runDueDateReminders();
    } catch (error) {
      console.error('[Scheduler] Due date reminders job failed:', error);
    }
  }, {
    timezone: 'America/Los_Angeles' // Adjust to your timezone
  });
  console.log('[Scheduler] Due date reminders scheduled for 8:00 AM daily');

  // Monthly time report - last day of month at 11:59 PM
  // This cron expression runs at 23:59 on the last day of each month
  // Using day 28-31 with condition check
  cron.schedule('59 23 28-31 * *', async () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Only run if tomorrow is the 1st (meaning today is the last day)
    if (tomorrow.getDate() === 1) {
      console.log('[Scheduler] Triggering monthly report...');
      try {
        await runMonthlyReport();
      } catch (error) {
        console.error('[Scheduler] Monthly report job failed:', error);
      }
    }
  }, {
    timezone: 'America/Los_Angeles'
  });
  console.log('[Scheduler] Monthly report scheduled for last day of month at 11:59 PM');

  // Database backup - daily at 2:00 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('[Scheduler] Triggering database backup...');
    try {
      await runDatabaseBackup();
    } catch (error) {
      console.error('[Scheduler] Database backup job failed:', error);
    }
  }, {
    timezone: 'America/Los_Angeles'
  });
  console.log('[Scheduler] Database backup scheduled for 2:00 AM daily');

  console.log('[Scheduler] All scheduled jobs initialized');
}

// Export individual job runners for manual triggering
export { runDueDateReminders, runMonthlyReport, runDatabaseBackup };
