import { prisma } from '../db/client.js';
import { sendTaskAssignedEmail } from './email.js';
import { sendTelegramMessage, escapeTelegramHtml } from './telegram.js';
import { sendTaskAssignmentPush } from './pushNotifications.js';
import { shouldNotify } from '../utils/notificationPrefs.js';

interface TaskWithProject {
  id: string;
  title: string;
  project: {
    client: {
      name: string;
    };
    [key: string]: any;
  };
  [key: string]: any;
}

interface AssigneeInfo {
  id: string;
  email: string;
  telegramChatId?: string | null;
}

/**
 * Send task assignment notifications (email, push, telegram) to a list of assignees.
 * Skips sending to the actor who triggered the assignment.
 */
export async function notifyTaskAssignees(
  assignees: AssigneeInfo[],
  actorId: string,
  actorName: string,
  task: TaskWithProject
): Promise<void> {
  for (const assignee of assignees) {
    if (assignee.id === actorId) continue;

    // Email notification
    if (assignee.email && await shouldNotify(assignee.id, 'taskAssignment', 'email')) {
      await sendTaskAssignedEmail(assignee.email, task);
    }

    // Push notification
    if (await shouldNotify(assignee.id, 'taskAssignment', 'push')) {
      await sendTaskAssignmentPush(assignee.id, actorName, task.title, task.id);
    }

    // Telegram notification
    if (assignee.telegramChatId && await shouldNotify(assignee.id, 'taskAssignment', 'telegram')) {
      await sendTelegramMessage(
        assignee.telegramChatId,
        `📋 <b>New task assigned to you</b>\n\n"${escapeTelegramHtml(task.title)}"\n\nProject: ${escapeTelegramHtml(task.project.client.name)}`
      );
    }
  }
}
