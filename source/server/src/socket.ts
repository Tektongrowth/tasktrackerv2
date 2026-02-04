import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { prisma } from './db/client.js';
import { sendChatNotificationEmail } from './services/email.js';
import { sendTelegramMessage, escapeTelegramHtml, storeTelegramChatMapping } from './services/telegram.js';
import { sendChatMessagePush } from './services/pushNotifications.js';
import { shouldNotify } from './utils/notificationPrefs.js';

// Track connected users: Map<userId, Set<socketId>>
const connectedUsers = new Map<string, Set<string>>();

export function initializeSocket(httpServer: HttpServer, corsOrigins: string | string[]) {
  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigins,
      credentials: true
    }
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    const userId = socket.handshake.auth.userId;
    if (!userId) {
      return next(new Error('Authentication required'));
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || !user.active) {
      return next(new Error('Invalid user'));
    }

    socket.data.userId = userId;
    next();
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId;
    console.log(`User ${userId} connected via WebSocket`);

    // Track this connection
    if (!connectedUsers.has(userId)) {
      connectedUsers.set(userId, new Set());
    }
    connectedUsers.get(userId)!.add(socket.id);

    // Join user's personal room for direct notifications
    socket.join(`user:${userId}`);

    // Handle joining a chat room
    socket.on('chat:join', async (chatId: string) => {
      // Verify user is a participant
      const participant = await prisma.chatParticipant.findUnique({
        where: {
          chatId_userId: { chatId, userId }
        }
      });

      if (participant) {
        socket.join(`chat:${chatId}`);
        console.log(`User ${userId} joined chat ${chatId}`);
      }
    });

    // Handle leaving a chat room
    socket.on('chat:leave', (chatId: string) => {
      socket.leave(`chat:${chatId}`);
      console.log(`User ${userId} left chat ${chatId}`);
    });

    // Handle sending a message
    socket.on('message:send', async (data: { chatId: string; content: string; tempId?: string }) => {
      try {
        const { chatId, content, tempId } = data;

        // Verify user is a participant
        const participant = await prisma.chatParticipant.findUnique({
          where: {
            chatId_userId: { chatId, userId }
          }
        });

        if (!participant) {
          socket.emit('error', { message: 'Not a participant of this chat' });
          return;
        }

        // Create the message
        const message = await prisma.chatMessage.create({
          data: {
            chatId,
            senderId: userId,
            content
          },
          include: {
            sender: {
              select: { id: true, name: true, email: true, avatarUrl: true }
            }
          }
        });

        // Create read receipt for sender
        await prisma.chatReadReceipt.create({
          data: {
            messageId: message.id,
            userId
          }
        });

        // Update chat's updatedAt and get participants for notifications
        const chat = await prisma.chat.update({
          where: { id: chatId },
          data: { updatedAt: new Date() },
          include: {
            participants: {
              include: {
                user: { select: { id: true, email: true, name: true, telegramChatId: true } }
              }
            }
          }
        });

        const messageWithTempId = { ...message, tempId };

        // Broadcast to chat room (for users actively viewing the chat)
        io.to(`chat:${chatId}`).emit('message:new', messageWithTempId);

        if (chat) {
          // Also notify all participants via their personal rooms (for reliability)
          for (const p of chat.participants) {
            io.to(`user:${p.userId}`).emit('message:new', messageWithTempId);
          }

          // Send push notifications to all participants (even if online, check preferences)
          for (const p of chat.participants) {
            if (p.userId !== userId) {
              const senderName = message.sender.name || 'Someone';
              // Check push preference for chat messages
              const shouldPush = await shouldNotify(p.userId, 'chatMessages', 'push');
              if (shouldPush) {
                sendChatMessagePush(
                  p.userId,
                  senderName,
                  content,
                  chatId,
                  chat.name || undefined
                );
              }
            }
          }

          // Notify offline users via email and Telegram (check preferences)
          for (const p of chat.participants) {
            if (p.userId !== userId && !isUserOnline(p.userId)) {
              const senderName = message.sender.name || 'Someone';

              // Send email notification (check preference)
              if (p.user.email && await shouldNotify(p.userId, 'chatMessages', 'email')) {
                sendChatNotificationEmail(
                  p.user.email,
                  senderName,
                  chat.name,
                  content.substring(0, 100),
                  chatId
                );
              }
              // Send Telegram notification with reply support (check preference)
              if (p.user.telegramChatId && await shouldNotify(p.userId, 'chatMessages', 'telegram')) {
                const chatTitle = chat.name || 'Direct message';
                const telegramMessage = `💬 <b>${escapeTelegramHtml(senderName)}</b> in "${escapeTelegramHtml(chatTitle)}":\n\n${escapeTelegramHtml(content)}\n\n<i>Reply to this message to respond</i>`;

                const result = await sendTelegramMessage(p.user.telegramChatId, telegramMessage);

                // Store mapping for reply tracking
                if (result.success && result.messageId) {
                  await storeTelegramChatMapping(
                    result.messageId,
                    chatId,
                    p.userId,
                    userId // The sender becomes the replyToUser
                  );
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle marking messages as read
    socket.on('message:read', async (data: { chatId: string; messageIds: string[] }) => {
      try {
        const { chatId, messageIds } = data;

        // Verify participation
        const participant = await prisma.chatParticipant.findUnique({
          where: {
            chatId_userId: { chatId, userId }
          }
        });

        if (!participant) return;

        // Create read receipts (ignore duplicates)
        await prisma.chatReadReceipt.createMany({
          data: messageIds.map(messageId => ({
            messageId,
            userId
          })),
          skipDuplicates: true
        });

        // Update lastReadAt for the participant
        await prisma.chatParticipant.update({
          where: {
            chatId_userId: { chatId, userId }
          },
          data: {
            lastReadAt: new Date()
          }
        });

        // Broadcast read receipts to the chat
        io.to(`chat:${chatId}`).emit('message:read', {
          chatId,
          userId,
          messageIds,
          readAt: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    });

    // Handle typing indicator (optional but nice to have)
    socket.on('typing:start', (chatId: string) => {
      socket.to(`chat:${chatId}`).emit('typing:start', { chatId, userId });
    });

    socket.on('typing:stop', (chatId: string) => {
      socket.to(`chat:${chatId}`).emit('typing:stop', { chatId, userId });
    });

    // Valid emoji keys for reactions
    const VALID_EMOJIS = ['thumbsup', 'thumbsdown', 'heart', 'laugh', 'surprised', 'sad', 'party'];

    // Handle reaction toggle
    socket.on('reaction:toggle', async (data: { chatId: string; messageId: string; emoji: string }) => {
      try {
        const { chatId, messageId, emoji } = data;

        // Validate emoji
        if (!emoji || !VALID_EMOJIS.includes(emoji)) {
          socket.emit('error', { message: 'Invalid emoji' });
          return;
        }

        // Verify participation
        const participant = await prisma.chatParticipant.findUnique({
          where: {
            chatId_userId: { chatId, userId }
          }
        });

        if (!participant) {
          socket.emit('error', { message: 'Not a participant of this chat' });
          return;
        }

        // Verify message exists
        const message = await prisma.chatMessage.findUnique({
          where: { id: messageId }
        });

        if (!message || message.chatId !== chatId) {
          socket.emit('error', { message: 'Message not found' });
          return;
        }

        // Check if reaction exists
        const existingReaction = await prisma.messageReaction.findUnique({
          where: {
            messageId_userId_emoji: {
              messageId,
              userId,
              emoji
            }
          }
        });

        let action: 'added' | 'removed';

        if (existingReaction) {
          await prisma.messageReaction.delete({
            where: { id: existingReaction.id }
          });
          action = 'removed';
        } else {
          await prisma.messageReaction.create({
            data: {
              messageId,
              userId,
              emoji
            }
          });
          action = 'added';
        }

        // Get updated reactions
        const reactions = await prisma.messageReaction.findMany({
          where: { messageId },
          include: {
            user: {
              select: { id: true, name: true }
            }
          }
        });

        // Broadcast to chat room
        io.to(`chat:${chatId}`).emit('reaction:updated', {
          messageId,
          reactions,
          action,
          userId,
          emoji
        });
      } catch (error) {
        console.error('Error toggling reaction:', error);
        socket.emit('error', { message: 'Failed to toggle reaction' });
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User ${userId} disconnected`);

      const userSockets = connectedUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          connectedUsers.delete(userId);
        }
      }
    });
  });

  return io;
}

// Check if a user is currently online
export function isUserOnline(userId: string): boolean {
  const sockets = connectedUsers.get(userId);
  return sockets !== undefined && sockets.size > 0;
}

// Get all online user IDs
export function getOnlineUsers(): string[] {
  return Array.from(connectedUsers.keys());
}
