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
} from '../services/telegram.js';

const router = Router();

// Type for Telegram webhook update
interface TelegramUpdate {
  message?: {
    chat: { id: number };
    from?: { id: number; first_name?: string; username?: string };
    text?: string;
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

    // Acknowledge other messages silently
    res.sendStatus(200);
  } catch (error) {
    console.error('Error handling Telegram webhook:', error);
    res.sendStatus(200); // Always return 200 to Telegram
  }
}

export default router;
