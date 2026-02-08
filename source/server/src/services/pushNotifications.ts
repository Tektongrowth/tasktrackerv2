import webpush from 'web-push';
import { prisma } from '../db/client.js';

// VAPID keys should be generated once and stored as environment variables
// Generate with: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@tektongrowth.com';

// Initialize web-push with VAPID keys
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  console.log('Web Push configured successfully');
} else {
  console.warn('VAPID keys not configured - push notifications disabled');
}

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}

export function isPushEnabled(): boolean {
  return !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
}

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: {
    url?: string;
    type?: 'chat' | 'mention' | 'task';
    chatId?: string;
    taskId?: string;
  };
}

/**
 * Send a push notification to a specific user
 */
export async function sendPushNotification(userId: string, payload: PushPayload): Promise<void> {
  if (!isPushEnabled()) {
    console.log('Push notifications not enabled - skipping');
    return;
  }

  try {
    // Get all push subscriptions for this user
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
    });

    if (subscriptions.length === 0) {
      console.warn(`No push subscriptions found for user ${userId} — push notification skipped (tag: ${payload.tag || 'none'})`);
      return;
    }

    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/icon-192.png',
      badge: payload.badge || '/badge-72.png',
      tag: payload.tag,
      data: payload.data,
    });

    // Send to all subscriptions for this user
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            notificationPayload
          );
          return { success: true, subscriptionId: sub.id };
        } catch (error: any) {
          // If subscription is invalid (410 Gone or 404), remove it
          if (error.statusCode === 410 || error.statusCode === 404) {
            console.log(`Removing invalid subscription ${sub.id}`);
            await prisma.pushSubscription.delete({ where: { id: sub.id } });
          }
          throw error;
        }
      })
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    if (failed > 0) {
      console.log(`Push notification: ${succeeded} sent, ${failed} failed for user ${userId}`);
    }
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
}

/**
 * Send push notification for a new chat message
 */
export async function sendChatMessagePush(
  recipientId: string,
  senderName: string,
  messageContent: string,
  chatId: string,
  chatName?: string
): Promise<void> {
  const title = chatName ? `${senderName} in ${chatName}` : senderName;
  const body = messageContent.length > 100
    ? messageContent.substring(0, 100) + '...'
    : messageContent;

  await sendPushNotification(recipientId, {
    title,
    body,
    tag: `chat-${chatId}`, // Group notifications from same chat
    data: {
      type: 'chat',
      chatId,
      url: `/chat?id=${chatId}`,
    },
  });
}

/**
 * Send push notification for a task mention
 */
export async function sendMentionPush(
  recipientId: string,
  mentionerName: string,
  taskTitle: string,
  taskId: string,
  commentContent: string
): Promise<void> {
  const body = commentContent.length > 100
    ? commentContent.substring(0, 100) + '...'
    : commentContent;

  await sendPushNotification(recipientId, {
    title: `${mentionerName} mentioned you`,
    body: `In "${taskTitle}": ${body}`,
    tag: `mention-${taskId}`,
    data: {
      type: 'mention',
      taskId,
      url: `/kanban?taskId=${taskId}`,
    },
  });
}

/**
 * Send push notification for task assignment
 */
export async function sendTaskAssignmentPush(
  recipientId: string,
  assignerName: string,
  taskTitle: string,
  taskId: string
): Promise<void> {
  await sendPushNotification(recipientId, {
    title: 'New Task Assigned',
    body: `${assignerName} assigned you to "${taskTitle}"`,
    tag: `task-${taskId}`,
    data: {
      type: 'task',
      taskId,
      url: `/kanban?taskId=${taskId}`,
    },
  });
}

/**
 * Send push notification for task updates (for watchers)
 */
export async function sendTaskUpdatePush(
  recipientId: string,
  actorName: string,
  taskTitle: string,
  taskId: string,
  updateType: 'comment' | 'status' | 'assignee',
  details?: string
): Promise<void> {
  let body: string;
  switch (updateType) {
    case 'comment':
      body = details
        ? `${actorName} commented: ${details.length > 80 ? details.substring(0, 80) + '...' : details}`
        : `${actorName} commented on "${taskTitle}"`;
      break;
    case 'status':
      body = `${actorName} changed status to ${details || 'unknown'}`;
      break;
    case 'assignee':
      body = `${actorName} updated assignees`;
      break;
    default:
      body = `${actorName} updated "${taskTitle}"`;
  }

  await sendPushNotification(recipientId, {
    title: `Task Update: ${taskTitle}`,
    body,
    tag: `task-update-${taskId}`,
    data: {
      type: 'task',
      taskId,
      url: `/kanban?taskId=${taskId}`,
    },
  });
}
