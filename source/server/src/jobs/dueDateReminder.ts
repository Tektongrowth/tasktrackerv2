import { prisma } from '../db/client.js';
import { sendDueDateReminderEmail } from '../services/email.js';

/**
 * Sends email reminders to contractors about tasks due tomorrow
 * Runs daily at 8:00 AM
 */
export async function runDueDateReminders() {
  console.log('[Job] Running due date reminders...');

  const jobRun = await prisma.scheduledJobRun.create({
    data: { jobName: 'due_date_reminder', status: 'started' }
  });

  try {
    // Calculate tomorrow's date range
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    // Find tasks due tomorrow with assigned contractors
    const tasksDueTomorrow = await prisma.task.findMany({
      where: {
        dueDate: { gte: tomorrow, lt: dayAfter },
        status: { not: 'completed' },
        assignees: { some: {} },
        archived: false
      },
      include: {
        assignees: {
          include: {
            user: { select: { id: true, name: true, email: true } }
          }
        },
        project: { include: { client: { select: { name: true } } } }
      }
    });

    console.log(`[Job] Found ${tasksDueTomorrow.length} tasks due tomorrow`);

    if (tasksDueTomorrow.length === 0) {
      await prisma.scheduledJobRun.update({
        where: { id: jobRun.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          details: { taskCount: 0, emailsSent: 0 }
        }
      });
      return;
    }

    // Group tasks by contractor email
    const tasksByContractor: Record<string, typeof tasksDueTomorrow> = {};
    for (const task of tasksDueTomorrow) {
      for (const assignee of task.assignees) {
        const email = assignee.user.email;
        if (!tasksByContractor[email]) {
          tasksByContractor[email] = [];
        }
        tasksByContractor[email].push(task);
      }
    }

    // Send emails to each contractor
    let emailsSent = 0;
    for (const [email, tasks] of Object.entries(tasksByContractor)) {
      console.log(`[Job] Sending reminder to ${email} for ${tasks.length} tasks`);
      await sendDueDateReminderEmail(email, tasks);
      emailsSent++;
    }

    // Log audit
    await prisma.auditLog.create({
      data: {
        action: 'due_date_reminders_sent',
        entityType: 'scheduled_job',
        entityIds: tasksDueTomorrow.map(t => t.id),
        details: { taskCount: tasksDueTomorrow.length, emailsSent }
      }
    });

    await prisma.scheduledJobRun.update({
      where: { id: jobRun.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        details: { taskCount: tasksDueTomorrow.length, emailsSent }
      }
    });

    console.log(`[Job] Due date reminders completed: ${emailsSent} emails sent`);
  } catch (error) {
    console.error('[Job] Due date reminders failed:', error);
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
