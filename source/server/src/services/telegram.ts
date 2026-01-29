import crypto from 'crypto';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME;
const SECRET = process.env.SESSION_SECRET || 'development-secret';

// In-memory store for link tokens (userId -> { token, expires })
// In production, you might want to use Redis or database
const linkTokens = new Map<string, { userId: string; expires: number }>();

/**
 * Check if Telegram is configured
 */
export function isTelegramConfigured(): boolean {
  return !!(TELEGRAM_BOT_TOKEN && TELEGRAM_BOT_USERNAME);
}

/**
 * Send a message to a Telegram chat
 */
export async function sendTelegramMessage(
  chatId: string,
  text: string,
  options?: { parseMode?: 'HTML' | 'Markdown' }
): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.log('Telegram message not sent - bot not configured');
    return false;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: options?.parseMode || 'HTML',
          disable_web_page_preview: true,
        }),
      }
    );

    const result = await response.json() as { ok: boolean; description?: string };

    if (!result.ok) {
      console.error('Telegram API error:', result);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    return false;
  }
}

/**
 * Generate a link token for connecting a user's Telegram account
 * Token expires in 10 minutes
 */
export function generateTelegramLinkToken(userId: string): string {
  // Create a random token
  const randomPart = crypto.randomBytes(16).toString('hex');
  // Create signature with userId and timestamp
  const expires = Date.now() + 10 * 60 * 1000; // 10 minutes
  const data = `${userId}:${expires}:${randomPart}`;
  const signature = crypto
    .createHmac('sha256', SECRET)
    .update(data)
    .digest('hex')
    .slice(0, 16);

  const token = `${randomPart}${signature}`;

  // Store the mapping
  linkTokens.set(token, { userId, expires });

  // Cleanup expired tokens periodically
  cleanupExpiredTokens();

  return token;
}

/**
 * Verify a link token and return the user ID
 * Returns null if invalid or expired
 */
export function verifyTelegramLinkToken(token: string): string | null {
  const stored = linkTokens.get(token);

  if (!stored) {
    return null;
  }

  if (Date.now() > stored.expires) {
    linkTokens.delete(token);
    return null;
  }

  // Delete after use (one-time token)
  linkTokens.delete(token);

  return stored.userId;
}

/**
 * Clean up expired tokens
 */
function cleanupExpiredTokens(): void {
  const now = Date.now();
  for (const [token, data] of linkTokens.entries()) {
    if (now > data.expires) {
      linkTokens.delete(token);
    }
  }
}

/**
 * Generate the Telegram deep link URL for account linking
 */
export function getTelegramLinkUrl(token: string): string | null {
  if (!TELEGRAM_BOT_USERNAME) {
    return null;
  }
  return `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${token}`;
}

/**
 * Get the bot username for display purposes
 */
export function getTelegramBotUsername(): string | null {
  return TELEGRAM_BOT_USERNAME || null;
}

// Escape HTML for Telegram messages
export function escapeTelegramHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Send a photo to a Telegram chat
 */
export async function sendTelegramPhoto(
  chatId: string,
  photoUrl: string,
  caption?: string
): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.log('Telegram photo not sent - bot not configured');
    return false;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          photo: photoUrl,
          caption: caption || undefined,
          parse_mode: 'HTML',
        }),
      }
    );

    const result = await response.json() as { ok: boolean; description?: string };

    if (!result.ok) {
      console.error('Telegram sendPhoto error:', result);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending Telegram photo:', error);
    return false;
  }
}

/**
 * Send a document to a Telegram chat
 */
export async function sendTelegramDocument(
  chatId: string,
  documentUrl: string,
  fileName: string,
  caption?: string
): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.log('Telegram document not sent - bot not configured');
    return false;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          document: documentUrl,
          caption: caption || undefined,
          parse_mode: 'HTML',
        }),
      }
    );

    const result = await response.json() as { ok: boolean; description?: string };

    if (!result.ok) {
      console.error('Telegram sendDocument error:', result);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending Telegram document:', error);
    return false;
  }
}
