import { Resend } from 'resend';

// Only initialize Resend if we have a valid API key
const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey && apiKey.startsWith('re_') ? new Resend(apiKey) : null;

// Email configuration from environment variables
// NOTE: Set EMAIL_FROM and ADMIN_EMAIL in your environment for production
const FROM_EMAIL = process.env.EMAIL_FROM || 'Task Tracker <noreply@example.com>';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

// Rate limiting: Resend allows 2 requests/second, so we'll send 1 per 600ms to be safe
const EMAIL_RATE_LIMIT_MS = 600;
let lastEmailSentAt = 0;
const emailQueue: Array<() => Promise<void>> = [];
let isProcessingQueue = false;

/**
 * Sleep for a specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Process the email queue with rate limiting
 */
async function processEmailQueue(): Promise<void> {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  while (emailQueue.length > 0) {
    const emailFn = emailQueue.shift();
    if (!emailFn) continue;

    // Calculate delay to respect rate limit
    const now = Date.now();
    const timeSinceLastEmail = now - lastEmailSentAt;
    const delay = Math.max(0, EMAIL_RATE_LIMIT_MS - timeSinceLastEmail);

    if (delay > 0) {
      await sleep(delay);
    }

    try {
      await emailFn();
      lastEmailSentAt = Date.now();
    } catch (error) {
      console.error('Error sending queued email:', error);
    }
  }

  isProcessingQueue = false;
}

/**
 * Queue an email to be sent with rate limiting
 */
function queueEmail(emailFn: () => Promise<void>): void {
  emailQueue.push(emailFn);
  processEmailQueue();
}

// SECURITY: Escape HTML entities to prevent XSS in emails
function escapeHtml(text: string | undefined | null): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function shouldSendEmail(eventType: string): Promise<boolean> {
  // Only send emails if Resend is properly configured
  if (!resend) {
    console.log('Email not sent - Resend not configured');
    return false;
  }
  return true;
}

/**
 * Rate-limited email sending wrapper
 * Queues email to be sent with proper spacing to avoid rate limits
 */
async function sendWithRateLimit(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    queueEmail(async () => {
      try {
        await resend!.emails.send({
          from: FROM_EMAIL,
          to,
          subject,
          html,
        });
        resolve();
      } catch (error) {
        console.error(`Failed to send email to ${to}:`, error);
        reject(error);
      }
    });
  });
}

export async function sendInviteEmail(email: string, token: string, name: string) {
  if (!await shouldSendEmail('contractorInvited')) return;

  const inviteUrl = `${APP_URL}/auth/invite/${token}`;
  const safeName = escapeHtml(name);

  try {
    await sendWithRateLimit(
      email,
      'You\'ve been invited to Task Tracker',
      `
        <h2>Welcome to Task Tracker, ${safeName}!</h2>
        <p>You've been invited to join the Task Tracker application as a contractor.</p>
        <p>Click the link below to complete your signup:</p>
        <p><a href="${inviteUrl}" style="display: inline-block; background: #3182ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Accept Invitation</a></p>
        <p>This link will connect your Google account to your Task Tracker profile.</p>
        <p>If you didn't expect this invitation, you can ignore this email.</p>
      `
    );
  } catch (error) {
    console.error('Failed to send invite email:', error);
  }
}

export async function sendTaskAssignedEmail(email: string, task: any) {
  if (!await shouldSendEmail('taskAssigned')) return;

  const taskUrl = `${APP_URL}/tasks/${task.id}`;
  const safeTitle = escapeHtml(task.title);
  const safeDescription = escapeHtml(task.description);
  const safeClientName = escapeHtml(task.project?.client?.name) || 'N/A';

  try {
    await sendWithRateLimit(
      email,
      `New task assigned: ${safeTitle}`,
      `
        <h2>New Task Assigned</h2>
        <p>You've been assigned a new task:</p>
        <div style="background: #f7fafc; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <h3 style="margin: 0 0 8px 0;">${safeTitle}</h3>
          ${safeDescription ? `<p style="color: #4a5568; margin: 0 0 8px 0;">${safeDescription}</p>` : ''}
          <p style="margin: 0;"><strong>Client:</strong> ${safeClientName}</p>
          ${task.dueDate ? `<p style="margin: 8px 0 0 0;"><strong>Due:</strong> ${new Date(task.dueDate).toLocaleDateString()}</p>` : ''}
        </div>
        <p><a href="${taskUrl}" style="display: inline-block; background: #3182ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Task</a></p>
      `
    );
  } catch (error) {
    console.error('Failed to send task assigned email:', error);
  }
}

export async function sendTaskDueSoonEmail(email: string, task: any) {
  if (!await shouldSendEmail('taskDueSoon')) return;

  const taskUrl = `${APP_URL}/tasks/${task.id}`;
  const safeTitle = escapeHtml(task.title);
  const safeClientName = escapeHtml(task.project?.client?.name) || 'N/A';

  try {
    await sendWithRateLimit(
      email,
      `Task due soon: ${safeTitle}`,
      `
        <h2>Task Due Tomorrow</h2>
        <p>This task is due within 24 hours:</p>
        <div style="background: #fefcbf; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <h3 style="margin: 0 0 8px 0;">${safeTitle}</h3>
          <p style="margin: 0;"><strong>Client:</strong> ${safeClientName}</p>
          <p style="margin: 8px 0 0 0;"><strong>Due:</strong> ${new Date(task.dueDate).toLocaleDateString()}</p>
        </div>
        <p><a href="${taskUrl}" style="display: inline-block; background: #3182ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Task</a></p>
      `
    );
  } catch (error) {
    console.error('Failed to send task due soon email:', error);
  }
}

export async function sendTaskOverdueEmail(email: string, task: any, isAdmin: boolean = false) {
  if (!await shouldSendEmail('taskOverdue')) return;

  const taskUrl = `${APP_URL}/tasks/${task.id}`;
  const safeTitle = escapeHtml(task.title);
  const safeClientName = escapeHtml(task.project?.client?.name) || 'N/A';
  const safeAssigneeName = escapeHtml(task.assignee?.name);

  try {
    await sendWithRateLimit(
      email,
      `Task overdue: ${safeTitle}`,
      `
        <h2>Task Overdue</h2>
        <p>This task is past its due date:</p>
        <div style="background: #fed7d7; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <h3 style="margin: 0 0 8px 0;">${safeTitle}</h3>
          ${isAdmin && safeAssigneeName ? `<p style="margin: 0 0 8px 0;"><strong>Assigned to:</strong> ${safeAssigneeName}</p>` : ''}
          <p style="margin: 0;"><strong>Client:</strong> ${safeClientName}</p>
          <p style="margin: 8px 0 0 0;"><strong>Was due:</strong> ${new Date(task.dueDate).toLocaleDateString()}</p>
        </div>
        <p><a href="${taskUrl}" style="display: inline-block; background: #e53e3e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Task</a></p>
      `
    );
  } catch (error) {
    console.error('Failed to send task overdue email:', error);
  }
}

export async function sendNewSubscriptionEmail(client: any, project: any, tasks: any[]) {
  if (!await shouldSendEmail('newSubscription')) return;

  const adminEmail = ADMIN_EMAIL;
  const safeClientName = escapeHtml(client.name);
  const safeClientEmail = escapeHtml(client.email);
  const safeClientPhone = escapeHtml(client.phone);
  const safePlanType = escapeHtml(project.planType);

  try {
    await sendWithRateLimit(
      adminEmail,
      `New subscription: ${safeClientName}`,
      `
        <h2>New Subscription Created</h2>
        <p>A new subscription has been created and tasks have been generated.</p>
        <div style="background: #c6f6d5; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <h3 style="margin: 0 0 8px 0;">${safeClientName}</h3>
          ${safeClientEmail ? `<p style="margin: 0 0 4px 0;"><strong>Email:</strong> ${safeClientEmail}</p>` : ''}
          ${safeClientPhone ? `<p style="margin: 0 0 4px 0;"><strong>Phone:</strong> ${safeClientPhone}</p>` : ''}
          <p style="margin: 8px 0 0 0;"><strong>Plan:</strong> ${safePlanType}</p>
        </div>
        <h3>Tasks Created (${tasks.length}):</h3>
        <ul>
          ${tasks.map(t => `<li>${escapeHtml(t.title)} - Due: ${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'No date'}</li>`).join('')}
        </ul>
        <p><a href="${APP_URL}" style="display: inline-block; background: #3182ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Open Task Tracker</a></p>
      `
    );
  } catch (error) {
    console.error('Failed to send new subscription email:', error);
  }
}

export async function sendSubscriptionCanceledEmail(client: any, project: any) {
  if (!await shouldSendEmail('subscriptionCanceled')) return;

  const adminEmail = ADMIN_EMAIL;
  const safeClientName = escapeHtml(client.name);
  const safeClientEmail = escapeHtml(client.email);
  const safePlanType = escapeHtml(project.planType);

  try {
    await sendWithRateLimit(
      adminEmail,
      `Subscription canceled: ${safeClientName}`,
      `
        <h2>Subscription Canceled</h2>
        <p>A subscription has been canceled. All existing tasks have been preserved.</p>
        <div style="background: #fed7d7; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <h3 style="margin: 0 0 8px 0;">${safeClientName}</h3>
          ${safeClientEmail ? `<p style="margin: 0 0 4px 0;"><strong>Email:</strong> ${safeClientEmail}</p>` : ''}
          <p style="margin: 8px 0 0 0;"><strong>Plan was:</strong> ${safePlanType}</p>
        </div>
        <p><a href="${APP_URL}" style="display: inline-block; background: #3182ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Open Task Tracker</a></p>
      `
    );
  } catch (error) {
    console.error('Failed to send subscription canceled email:', error);
  }
}

export async function sendClientAccessEmail(email: string, clientName: string, token: string) {
  if (!await shouldSendEmail('clientAccess')) return;

  const accessUrl = `${APP_URL}/client-portal/verify/${token}`;
  const safeClientName = escapeHtml(clientName);

  try {
    await sendWithRateLimit(
      email,
      `Access your ${safeClientName} dashboard`,
      `
        <h2>Access Your Project Dashboard</h2>
        <p>Click the link below to access your project dashboard:</p>
        <p><a href="${accessUrl}" style="display: inline-block; background: #3182ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Dashboard</a></p>
        <p style="color: #718096; margin-top: 24px;">This link will expire in 24 hours and can only be used once.</p>
        <p style="color: #718096;">If you didn't request this access link, you can ignore this email.</p>
      `
    );
  } catch (error) {
    console.error('Failed to send client access email:', error);
  }
}

export async function sendMentionNotificationEmail(
  email: string,
  mentionerName: string,
  taskTitle: string,
  taskId: string,
  commentPreview: string
) {
  if (!await shouldSendEmail('mention')) return;

  const taskUrl = `${APP_URL}/kanban?taskId=${taskId}`;
  const safeMentionerName = escapeHtml(mentionerName);
  const safeTaskTitle = escapeHtml(taskTitle);
  const safeCommentPreview = escapeHtml(commentPreview);

  try {
    await sendWithRateLimit(
      email,
      `${safeMentionerName} mentioned you in a comment`,
      `
        <h2>You were mentioned in a comment</h2>
        <p><strong>${safeMentionerName}</strong> mentioned you in a comment on the task:</p>
        <div style="background: #f7fafc; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <h3 style="margin: 0 0 8px 0;">${safeTaskTitle}</h3>
          <p style="color: #4a5568; margin: 0; font-style: italic;">"${safeCommentPreview}..."</p>
        </div>
        <p><a href="${taskUrl}" style="display: inline-block; background: #3182ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Comment</a></p>
      `
    );
  } catch (error) {
    console.error('Failed to send mention notification email:', error);
  }
}

export async function sendDueDateReminderEmail(email: string, tasks: any[]) {
  if (!await shouldSendEmail('dueDateReminder')) return;

  try {
    const taskList = tasks.map(task => `
      <li style="margin-bottom: 12px;">
        <strong>${escapeHtml(task.title)}</strong>
        <br/>
        <span style="color: #718096; font-size: 14px;">
          ${escapeHtml(task.project?.client?.name) || 'No client'} / ${escapeHtml(task.project?.name) || 'No project'}
        </span>
      </li>
    `).join('');

    await sendWithRateLimit(
      email,
      `${tasks.length} task${tasks.length > 1 ? 's' : ''} due tomorrow`,
      `
        <h2>Tasks Due Tomorrow</h2>
        <p>The following task${tasks.length > 1 ? 's are' : ' is'} due tomorrow:</p>
        <ul style="padding-left: 20px;">
          ${taskList}
        </ul>
        <p><a href="${APP_URL}/kanban" style="display: inline-block; background: #3182ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Tasks</a></p>
      `
    );
  } catch (error) {
    console.error('Failed to send due date reminder email:', error);
  }
}

export async function sendMonthlyReportEmail(
  reportData: Array<{ name: string; email: string; totalHours: string; taskCount: number }>,
  period: { month: string; year: number }
) {
  if (!await shouldSendEmail('monthlyReport')) return;

  const adminEmail = ADMIN_EMAIL;

  try {
    const totalHours = reportData.reduce((sum, r) => sum + parseFloat(r.totalHours), 0).toFixed(2);

    const tableRows = reportData.map(r => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${escapeHtml(r.name)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${escapeHtml(r.email)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">${escapeHtml(r.totalHours)}h</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">${r.taskCount}</td>
      </tr>
    `).join('');

    await sendWithRateLimit(
      adminEmail,
      `Monthly Time Report - ${period.month} ${period.year}`,
      `
        <h2>Monthly Time Report</h2>
        <p><strong>${period.month} ${period.year}</strong></p>
        <p>Total hours logged for completed tasks: <strong>${totalHours} hours</strong></p>

        <h3>Hours by Contractor</h3>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <thead>
            <tr style="background: #f7fafc;">
              <th style="padding: 8px; text-align: left; border-bottom: 2px solid #e2e8f0;">Name</th>
              <th style="padding: 8px; text-align: left; border-bottom: 2px solid #e2e8f0;">Email</th>
              <th style="padding: 8px; text-align: right; border-bottom: 2px solid #e2e8f0;">Hours</th>
              <th style="padding: 8px; text-align: right; border-bottom: 2px solid #e2e8f0;">Tasks</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>

        <p style="color: #718096; margin-top: 24px;">
          Note: All completed tasks have been automatically archived after this report was generated.
        </p>

        <p><a href="${APP_URL}/time" style="display: inline-block; background: #3182ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Time Analytics</a></p>
      `
    );
  } catch (error) {
    console.error('Failed to send monthly report email:', error);
  }
}

export async function sendTaskSubmissionEmail(submission: any, client: any) {
  if (!await shouldSendEmail('taskSubmission')) return;

  const adminEmail = ADMIN_EMAIL;
  const safeTitle = escapeHtml(submission.title);
  const safeDescription = escapeHtml(submission.description);
  const safeClientName = escapeHtml(client.name);
  const safeSubmittedBy = escapeHtml(submission.submittedBy);
  const safePriority = escapeHtml(submission.priority);

  try {
    await sendWithRateLimit(
      adminEmail,
      `New task request from ${safeClientName}`,
      `
        <h2>New Task Request</h2>
        <p>A client has submitted a new task request:</p>
        <div style="background: #f7fafc; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <h3 style="margin: 0 0 8px 0;">${safeTitle}</h3>
          ${safeDescription ? `<p style="color: #4a5568; margin: 0 0 8px 0;">${safeDescription}</p>` : ''}
          <p style="margin: 0;"><strong>Client:</strong> ${safeClientName}</p>
          <p style="margin: 4px 0 0 0;"><strong>Submitted by:</strong> ${safeSubmittedBy}</p>
          ${safePriority ? `<p style="margin: 4px 0 0 0;"><strong>Priority:</strong> ${safePriority}</p>` : ''}
        </div>
        <p><a href="${APP_URL}/submissions" style="display: inline-block; background: #3182ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Review Submissions</a></p>
      `
    );
  } catch (error) {
    console.error('Failed to send task submission email:', error);
  }
}

export async function sendSubmissionApprovedEmail(email: string, taskTitle: string) {
  if (!await shouldSendEmail('submissionApproved')) return;

  const safeTaskTitle = escapeHtml(taskTitle);

  try {
    await sendWithRateLimit(
      email,
      `Your task request has been approved`,
      `
        <h2>Task Request Approved</h2>
        <p>Your task request has been approved and added to the project:</p>
        <div style="background: #c6f6d5; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <h3 style="margin: 0;">${safeTaskTitle}</h3>
        </div>
        <p>You can track the progress of this task in your client portal.</p>
      `
    );
  } catch (error) {
    console.error('Failed to send submission approved email:', error);
  }
}

// Debounce map for chat notifications (userId -> timeout)
const chatNotificationDebounce = new Map<string, { timeout: NodeJS.Timeout; count: number; chatId: string; senderName: string }>();

export async function sendChatNotificationEmail(
  email: string,
  senderName: string,
  chatName: string | null,
  messagePreview: string,
  chatId: string
) {
  if (!await shouldSendEmail('chatNotification')) return;

  const safeSenderName = escapeHtml(senderName);
  const safeChatName = escapeHtml(chatName);
  const safeMessagePreview = escapeHtml(messagePreview);
  const chatUrl = `${APP_URL}/chat?id=${chatId}`;

  // Check for existing debounce
  const existing = chatNotificationDebounce.get(email + chatId);
  if (existing) {
    // Clear existing timeout and update count
    clearTimeout(existing.timeout);
    existing.count++;

    // Set new timeout
    const timeout = setTimeout(async () => {
      chatNotificationDebounce.delete(email + chatId);
      try {
        await sendWithRateLimit(
          email,
          existing.count > 1
            ? `${existing.count} new messages from ${safeSenderName}${safeChatName ? ` in ${safeChatName}` : ''}`
            : `New message from ${safeSenderName}`,
          `
            <h2>New ${existing.count > 1 ? `Messages (${existing.count})` : 'Message'}</h2>
            <p><strong>${safeSenderName}</strong> sent you ${existing.count > 1 ? 'messages' : 'a message'}${safeChatName ? ` in <strong>${safeChatName}</strong>` : ''}:</p>
            <div style="background: #f7fafc; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p style="color: #4a5568; margin: 0; font-style: italic;">"${safeMessagePreview}${existing.count > 1 ? '..." and more' : '...'}</p>
            </div>
            <p><a href="${chatUrl}" style="display: inline-block; background: #3182ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Open Chat</a></p>
          `
        );
      } catch (error) {
        console.error('Failed to send chat notification email:', error);
      }
    }, 2 * 60 * 1000); // 2 minute debounce

    existing.timeout = timeout;
  } else {
    // First message, set up debounce
    const timeout = setTimeout(async () => {
      const data = chatNotificationDebounce.get(email + chatId);
      chatNotificationDebounce.delete(email + chatId);

      const count = data?.count || 1;

      try {
        await sendWithRateLimit(
          email,
          count > 1
            ? `${count} new messages from ${safeSenderName}${safeChatName ? ` in ${safeChatName}` : ''}`
            : `New message from ${safeSenderName}`,
          `
            <h2>New ${count > 1 ? `Messages (${count})` : 'Message'}</h2>
            <p><strong>${safeSenderName}</strong> sent you ${count > 1 ? 'messages' : 'a message'}${safeChatName ? ` in <strong>${safeChatName}</strong>` : ''}:</p>
            <div style="background: #f7fafc; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p style="color: #4a5568; margin: 0; font-style: italic;">"${safeMessagePreview}${count > 1 ? '..." and more' : '...'}</p>
            </div>
            <p><a href="${chatUrl}" style="display: inline-block; background: #3182ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Open Chat</a></p>
          `
        );
      } catch (error) {
        console.error('Failed to send chat notification email:', error);
      }
    }, 2 * 60 * 1000); // 2 minute debounce

    chatNotificationDebounce.set(email + chatId, {
      timeout,
      count: 1,
      chatId,
      senderName
    });
  }
}

export interface BugReport {
  action: string;
  expected: string;
  actual: string;
  errorMessage?: string;
  steps: string;
  reporterName: string;
  reporterRole: string;
  browser: string;
  device: string;
  urgency: 'blocking' | 'annoying' | 'minor';
  screenshotUrl?: string;
}

export async function sendBugReportEmail(report: BugReport) {
  if (!resend) {
    console.log('Bug report email not sent - Resend not configured');
    return;
  }

  const urgencyColors: Record<string, string> = {
    blocking: '#e53e3e',
    annoying: '#dd6b20',
    minor: '#38a169'
  };

  const urgencyLabels: Record<string, string> = {
    blocking: 'BLOCKING - Cannot do work',
    annoying: 'ANNOYING - Can work around it',
    minor: 'MINOR - Just noticed it'
  };

  const safeAction = escapeHtml(report.action);
  const safeExpected = escapeHtml(report.expected);
  const safeActual = escapeHtml(report.actual);
  const safeError = escapeHtml(report.errorMessage);
  const safeSteps = escapeHtml(report.steps);
  const safeName = escapeHtml(report.reporterName);
  const safeRole = escapeHtml(report.reporterRole);
  const safeBrowser = escapeHtml(report.browser);
  const safeDevice = escapeHtml(report.device);

  try {
    await sendWithRateLimit(
      ADMIN_EMAIL,
      `[Bug Report] ${report.urgency.toUpperCase()}: ${safeAction.substring(0, 50)}`,
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: ${urgencyColors[report.urgency]}; color: white; padding: 12px 20px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">Bug Report</h2>
            <p style="margin: 4px 0 0 0; font-size: 14px;">${urgencyLabels[report.urgency]}</p>
          </div>

          <div style="background: #f7fafc; padding: 20px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
            <h3 style="color: #2d3748; margin-top: 0;">What were they trying to do?</h3>
            <p style="color: #4a5568; background: white; padding: 12px; border-radius: 4px; border: 1px solid #e2e8f0;">${safeAction}</p>

            <h3 style="color: #2d3748;">What happened instead?</h3>
            <p style="color: #4a5568; background: white; padding: 12px; border-radius: 4px; border: 1px solid #e2e8f0;">${safeActual}</p>

            ${safeError ? `
              <h3 style="color: #2d3748;">Error Message</h3>
              <p style="color: #e53e3e; background: #fff5f5; padding: 12px; border-radius: 4px; border: 1px solid #feb2b2; font-family: monospace;">${safeError}</p>
            ` : ''}

            <h3 style="color: #2d3748;">Steps to Reproduce</h3>
            <p style="color: #4a5568; background: white; padding: 12px; border-radius: 4px; border: 1px solid #e2e8f0; white-space: pre-wrap;">${safeSteps}</p>

            ${report.screenshotUrl ? `
              <h3 style="color: #2d3748;">Screenshot</h3>
              <p><a href="${report.screenshotUrl}" style="color: #3182ce;">View Screenshot</a></p>
            ` : ''}

            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />

            <h3 style="color: #2d3748;">Reporter Info</h3>
            <table style="color: #4a5568; font-size: 14px;">
              <tr><td style="padding: 4px 12px 4px 0; font-weight: bold;">Name:</td><td>${safeName}</td></tr>
              <tr><td style="padding: 4px 12px 4px 0; font-weight: bold;">Role:</td><td>${safeRole}</td></tr>
              <tr><td style="padding: 4px 12px 4px 0; font-weight: bold;">Browser:</td><td>${safeBrowser}</td></tr>
              <tr><td style="padding: 4px 12px 4px 0; font-weight: bold;">Device:</td><td>${safeDevice}</td></tr>
            </table>
          </div>
        </div>
      `
    );
  } catch (error) {
    console.error('Failed to send bug report email:', error);
    throw error;
  }
}
