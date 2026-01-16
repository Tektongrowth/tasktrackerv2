import { prisma } from '../db/client.js';
import { sendMonthlyReportEmail } from '../services/email.js';

/**
 * Generates monthly time report and auto-archives completed tasks
 * Runs on the last day of each month at 11:59 PM
 * Only counts time for COMPLETED tasks
 */
export async function runMonthlyReport() {
  console.log('[Job] Running monthly time report...');

  const jobRun = await prisma.scheduledJobRun.create({
    data: { jobName: 'monthly_report', status: 'started' }
  });

  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Get all contractors (active users)
    const allContractors = await prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, email: true }
    });

    // Get time entries for COMPLETED tasks only in this month
    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        createdAt: { gte: startOfMonth, lte: endOfMonth },
        task: { status: 'completed' }
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        task: { select: { title: true } }
      }
    });

    console.log(`[Job] Found ${timeEntries.length} time entries for completed tasks`);

    // Aggregate by contractor
    const byContractor: Record<string, {
      name: string;
      email: string;
      totalMinutes: number;
      tasks: Set<string>;
    }> = {};

    // Initialize all contractors with 0 hours
    for (const contractor of allContractors) {
      byContractor[contractor.id] = {
        name: contractor.name,
        email: contractor.email,
        totalMinutes: 0,
        tasks: new Set()
      };
    }

    // Sum up time entries
    for (const entry of timeEntries) {
      const userId = entry.user.id;
      if (byContractor[userId]) {
        byContractor[userId].totalMinutes += entry.durationMinutes || 0;
        if (entry.task) {
          byContractor[userId].tasks.add(entry.task.title);
        }
      }
    }

    // Build report data for all contractors
    const reportData = Object.entries(byContractor).map(([_, data]) => ({
      name: data.name,
      email: data.email,
      totalHours: (data.totalMinutes / 60).toFixed(2),
      taskCount: data.tasks.size
    }));

    const period = {
      month: now.toLocaleString('default', { month: 'long' }),
      year: now.getFullYear()
    };

    // Send report email to admin
    console.log('[Job] Sending monthly report email...');
    await sendMonthlyReportEmail(reportData, period);

    // Auto-archive all completed tasks
    console.log('[Job] Archiving completed tasks...');
    const archiveResult = await prisma.task.updateMany({
      where: { status: 'completed', archived: false },
      data: { archived: true, archivedAt: new Date() }
    });

    console.log(`[Job] Archived ${archiveResult.count} completed tasks`);

    // Log audit
    await prisma.auditLog.create({
      data: {
        action: 'monthly_report_auto_archive',
        entityType: 'scheduled_job',
        entityIds: [],
        details: {
          archivedCount: archiveResult.count,
          month: now.getMonth() + 1,
          year: now.getFullYear(),
          totalTimeEntries: timeEntries.length,
          reportedContractors: reportData.length
        }
      }
    });

    await prisma.scheduledJobRun.update({
      where: { id: jobRun.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        details: {
          contractorsReported: reportData.length,
          tasksArchived: archiveResult.count,
          timeEntries: timeEntries.length
        }
      }
    });

    console.log('[Job] Monthly report completed successfully');
  } catch (error) {
    console.error('[Job] Monthly report failed:', error);
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
