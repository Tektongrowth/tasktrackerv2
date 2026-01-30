import { Router, Request, Response } from 'express';
import { prisma } from '../db/client.js';
import { isAuthenticated } from '../middleware/auth.js';
import {
  generateTelegramLinkToken,
  verifyTelegramLinkToken,
  getTelegramLinkUrl,
  getTelegramBotUsername,
  sendTelegramMessage,
  isTelegramConfigured,
  getTelegramMessageMapping,
  parseTelegramMentions,
  findUsersByName,
  escapeTelegramHtml,
  storeTelegramMessageMapping,
} from '../services/telegram.js';
import { sendMentionNotificationEmail } from '../services/email.js';

const router = Router();

// Type for Telegram webhook update
interface TelegramUpdate {
  message?: {
    message_id: number;
    chat: { id: number };
    from?: { id: number; first_name?: string; username?: string };
    text?: string;
    reply_to_message?: {
      message_id: number;
      text?: string;
    };
  };
}

/**
 * GET /api/telegram/link
 * Generate a link URL for connecting Telegram account
 */
router.get('/link', isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!isTelegramConfigured()) {
      return res.status(503).json({ error: 'Telegram integration not configured' });
    }

    const user = req.user as Express.User;
    const userId = user.id;

    // Check if already connected
    const userData = await prisma.user.findUnique({
      where: { id: userId },
      select: { telegramChatId: true, telegramLinkedAt: true },
    });

    if (userData?.telegramChatId) {
      return res.json({
        connected: true,
        linkedAt: userData.telegramLinkedAt,
        botUsername: getTelegramBotUsername(),
      });
    }

    // Generate new link token
    const token = generateTelegramLinkToken(userId);
    const url = getTelegramLinkUrl(token);

    res.json({
      connected: false,
      url,
      botUsername: getTelegramBotUsername(),
    });
  } catch (error) {
    console.error('Error generating Telegram link:', error);
    res.status(500).json({ error: 'Failed to generate link' });
  }
});

/**
 * DELETE /api/telegram/link
 * Disconnect Telegram account
 */
router.delete('/link', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const user = req.user as Express.User;
    const userId = user.id;

    await prisma.user.update({
      where: { id: userId },
      data: {
        telegramChatId: null,
        telegramLinkedAt: null,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting Telegram:', error);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

/**
 * GET /api/telegram/status
 * Check if Telegram is configured and user's connection status
 */
router.get('/status', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const configured = isTelegramConfigured();

    if (!configured) {
      return res.json({ configured: false, connected: false });
    }

    const user = req.user as Express.User;
    const userId = user.id;
    const userData = await prisma.user.findUnique({
      where: { id: userId },
      select: { telegramChatId: true, telegramLinkedAt: true },
    });

    res.json({
      configured: true,
      connected: !!userData?.telegramChatId,
      linkedAt: userData?.telegramLinkedAt,
      botUsername: getTelegramBotUsername(),
    });
  } catch (error) {
    console.error('Error checking Telegram status:', error);
    res.status(500).json({ error: 'Failed to check status' });
  }
});

/**
 * POST /webhooks/telegram
 * Receive updates from Telegram
 * This endpoint is registered separately in index.ts without auth
 */
export async function handleTelegramWebhook(req: Request, res: Response) {
  try {
    const update: TelegramUpdate = req.body;

    // Handle /start command with token
    if (update.message?.text?.startsWith('/start ')) {
      const token = update.message.text.slice(7).trim();
      const chatId = update.message.chat.id.toString();
      const telegramName = update.message.from?.first_name || 'there';

      // Verify the token
      const userId = verifyTelegramLinkToken(token);

      if (!userId) {
        await sendTelegramMessage(
          chatId,
          '❌ This link has expired or is invalid.\n\nPlease go back to TaskTracker settings and click "Connect Telegram" again.'
        );
        return res.sendStatus(200);
      }

      // Link the account
      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          telegramChatId: chatId,
          telegramLinkedAt: new Date(),
        },
        select: { name: true },
      });

      // Send confirmation
      await sendTelegramMessage(
        chatId,
        `✅ Connected successfully!\n\nHey ${telegramName}, your Telegram is now linked to <b>${user.name}</b> in TaskTracker.\n\nYou'll receive notifications here when:\n• Someone mentions you in a comment\n• You're assigned to a task\n• Someone sends you a message\n\nTo disconnect, go to My Settings in TaskTracker.`
      );

      return res.sendStatus(200);
    }

    // Handle plain /start without token
    if (update.message?.text === '/start') {
      const chatId = update.message.chat.id.toString();
      await sendTelegramMessage(
        chatId,
        '👋 Welcome to TaskTracker Notifications!\n\nTo connect your account, go to <b>My Settings</b> in TaskTracker and click <b>Connect Telegram</b>.'
      );
      return res.sendStatus(200);
    }

    // Handle replies to notification messages
    if (update.message?.reply_to_message && update.message.text) {
      const chatId = update.message.chat.id.toString();
      const replyToMessageId = update.message.reply_to_message.message_id;
      const replyText = update.message.text.trim();

      // Find the user who sent this message
      const sender = await prisma.user.findFirst({
        where: { telegramChatId: chatId },
        select: { id: true, name: true },
      });

      if (!sender) {
        await sendTelegramMessage(
          chatId,
          '❌ Your Telegram account is not linked to TaskTracker.\n\nGo to My Settings to connect.'
        );
        return res.sendStatus(200);
      }

      // Look up the message mapping
      const mapping = await getTelegramMessageMapping(replyToMessageId);

      if (!mapping) {
        await sendTelegramMessage(
          chatId,
          '❌ Cannot find the original message. It may be too old (over 30 days) or was not a notification you can reply to.'
        );
        return res.sendStatus(200);
      }

      // Parse any explicit @mentions in the reply
      const explicitMentions = parseTelegramMentions(replyText);
      let mentionUserIds: string[] = [];
      let cleanedReplyText = replyText;

      if (explicitMentions.length > 0) {
        // Find users matching the @mentioned names
        const matchedUsers = await findUsersByName(explicitMentions);
        mentionUserIds = matchedUsers.map(u => u.id);

        // Keep the @mentions in the text for display, we'll convert them to proper format
      }

      // If no explicit mentions, use the auto-mention (the person who originally sent the notification)
      if (mentionUserIds.length === 0) {
        mentionUserIds = [mapping.replyToUserId];
      }

      // Build the comment content with proper mention format
      // The mention format is: @[Name](user:userId)
      let commentContent = '';

      for (const userId of mentionUserIds) {
        const mentionedUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true },
        });
        if (mentionedUser) {
          commentContent += `@[${mentionedUser.name}](user:${userId}) `;
        }
      }

      // Remove @mentions from the reply text to avoid duplication
      cleanedReplyText = replyText;
      for (const mention of explicitMentions) {
        cleanedReplyText = cleanedReplyText.replace(new RegExp(`@${mention}\\s*`, 'gi'), '');
      }
      cleanedReplyText = cleanedReplyText.trim();

      commentContent += cleanedReplyText;

      // Create the comment
      const comment = await prisma.taskComment.create({
        data: {
          taskId: mapping.taskId,
          userId: sender.id,
          content: commentContent,
        },
        include: {
          task: {
            select: {
              title: true,
              project: {
                include: { client: { select: { name: true } } }
              }
            },
          },
        },
      });

      // Create mention records and send notifications
      const usersToNotify = mentionUserIds.filter(id => id !== sender.id);

      for (const userId of usersToNotify) {
        // Create mention record
        await prisma.commentMention.create({
          data: {
            commentId: comment.id,
            userId: userId,
            notified: true, // We're about to notify them
          },
        }).catch(() => {}); // Ignore if mention already exists
      }

      // Get user details for notifications
      if (usersToNotify.length > 0) {
        const mentionedUsersDetails = await prisma.user.findMany({
          where: { id: { in: usersToNotify } },
          select: { id: true, email: true, name: true, telegramChatId: true },
        });

        const contentPreview = cleanedReplyText.substring(0, 100);
        const senderMentionName = sender.name.toLowerCase().replace(/\s+/g, '');
        const clientName = comment.task.project?.client?.name || 'Unknown Client';
        const projectName = comment.task.project?.name || 'Unknown Project';

        // Send email notifications
        for (const mentionedUser of mentionedUsersDetails) {
          sendMentionNotificationEmail(
            mentionedUser.email,
            sender.name,
            comment.task.title,
            mapping.taskId,
            contentPreview
          ).catch(err => console.error(`Failed to send mention email:`, err));
        }

        // Send Telegram notifications with reply instructions
        const telegramCaption = `💬 <b>${escapeTelegramHtml(sender.name)}</b> (@${escapeTelegramHtml(senderMentionName)}) replied in "${escapeTelegramHtml(comment.task.title)}":\n\n📁 <b>${escapeTelegramHtml(clientName)}</b> › ${escapeTelegramHtml(projectName)}\n\n"${escapeTelegramHtml(cleanedReplyText)}"\n\n<i>Reply to this message to respond, or use @${escapeTelegramHtml(senderMentionName)}</i>`;

        for (const mentionedUser of mentionedUsersDetails) {
          if (mentionedUser.telegramChatId) {
            const result = await sendTelegramMessage(mentionedUser.telegramChatId, telegramCaption);

            if (result.success && result.messageId) {
              await storeTelegramMessageMapping(
                result.messageId,
                mapping.taskId,
                mentionedUser.id,
                sender.id
              );
            }
          }
        }
      }

      // Log activity
      await prisma.taskActivity.create({
        data: {
          taskId: mapping.taskId,
          userId: sender.id,
          action: 'commented',
          details: { preview: commentContent.substring(0, 100), source: 'telegram' },
        },
      });

      // Send confirmation
      await sendTelegramMessage(
        chatId,
        `✅ Reply posted to "${escapeTelegramHtml(comment.task.title)}"`
      );

      return res.sendStatus(200);
    }

    // Handle non-reply messages (user just typing to the bot)
    if (update.message?.text && !update.message.text.startsWith('/')) {
      const chatId = update.message.chat.id.toString();
      await sendTelegramMessage(
        chatId,
        '💡 To reply to a comment, <b>swipe left</b> on the notification message and type your reply.\n\nYou can also use @name to mention specific people.'
      );
      return res.sendStatus(200);
    }

    // Acknowledge other messages silently
    res.sendStatus(200);
  } catch (error) {
    console.error('Error handling Telegram webhook:', error);
    res.sendStatus(200); // Always return 200 to Telegram
  }
}

export default router;
