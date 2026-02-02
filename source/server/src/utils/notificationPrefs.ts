import { prisma } from '../db/client.js';

export type NotificationType = 'taskAssignment' | 'mentions' | 'chatMessages';
export type NotificationChannel = 'email' | 'push' | 'telegram';

export interface ChannelPrefs {
  email: boolean;
  push: boolean;
  telegram: boolean;
}

export interface NotificationChannelPreferences {
  taskAssignment: ChannelPrefs;
  mentions: ChannelPrefs;
  chatMessages: ChannelPrefs;
}

// Default preferences for new users
export const defaultChannelPrefs: NotificationChannelPreferences = {
  taskAssignment: { email: true, push: true, telegram: true },
  mentions: { email: true, push: true, telegram: true },
  chatMessages: { email: false, push: true, telegram: true },
};

/**
 * Normalize notification preferences from the database.
 * Handles migration from old boolean format to new channel format.
 */
export function normalizePreferences(
  prefs: unknown
): NotificationChannelPreferences {
  if (!prefs || typeof prefs !== 'object') {
    return { ...defaultChannelPrefs };
  }

  const p = prefs as Record<string, unknown>;
  const result: NotificationChannelPreferences = { ...defaultChannelPrefs };

  for (const type of ['taskAssignment', 'mentions', 'chatMessages'] as const) {
    const value = p[type];

    if (value === undefined) {
      // Use default
      continue;
    } else if (typeof value === 'boolean') {
      // Old format: boolean - convert to all channels enabled/disabled
      result[type] = {
        email: value,
        push: value,
        telegram: value,
      };
    } else if (value && typeof value === 'object') {
      // New format: channel object
      const channelValue = value as Record<string, unknown>;
      result[type] = {
        email: typeof channelValue.email === 'boolean' ? channelValue.email : defaultChannelPrefs[type].email,
        push: typeof channelValue.push === 'boolean' ? channelValue.push : defaultChannelPrefs[type].push,
        telegram: typeof channelValue.telegram === 'boolean' ? channelValue.telegram : defaultChannelPrefs[type].telegram,
      };
    }
  }

  return result;
}

/**
 * Check if a notification should be sent to a user via a specific channel.
 */
export async function shouldNotify(
  userId: string,
  type: NotificationType,
  channel: NotificationChannel
): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPreferences: true },
    });

    if (!user) {
      return false;
    }

    const prefs = normalizePreferences(user.notificationPreferences);
    return prefs[type][channel];
  } catch (error) {
    console.error('Error checking notification preferences:', error);
    // Default to sending on error to avoid missing important notifications
    return true;
  }
}

/**
 * Get all notification preferences for a user.
 */
export async function getUserNotificationPreferences(
  userId: string
): Promise<NotificationChannelPreferences> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPreferences: true },
    });

    return normalizePreferences(user?.notificationPreferences);
  } catch (error) {
    console.error('Error getting notification preferences:', error);
    return { ...defaultChannelPrefs };
  }
}
