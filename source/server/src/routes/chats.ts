import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db/client.js';
import { isAuthenticated } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { uploadFile, getSignedDownloadUrl, generateStorageKey, isStorageConfigured } from '../services/storage.js';
import multer from 'multer';
import path from 'path';

const router = Router();

// Configure multer for memory storage (files uploaded to R2)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    // Allow common file types including HEIC/HEIF (iPhone photos)
    const allowedTypes = /jpeg|jpg|png|gif|webp|heic|heif|pdf|doc|docx|xls|xlsx|txt|csv/;
    const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mime = allowedTypes.test(file.mimetype);
    if (ext || mime) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Helper to safely get string from query param
function getQueryString(param: unknown): string | undefined {
  if (typeof param === 'string') return param;
  if (Array.isArray(param) && typeof param[0] === 'string') return param[0];
  return undefined;
}

// 30-day filter for messages
const thirtyDaysAgo = () => {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date;
};

// List user's chats with unread counts
router.get('/', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;

    const chats = await prisma.chat.findMany({
      where: {
        participants: {
          some: { userId: user.id }
        }
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true }
            }
          }
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: {
            sender: {
              select: { id: true, name: true }
            }
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Aggregate unread counts efficiently instead of per-chat queries
    const chatIds = chats.map(c => c.id);
    const participantsByChat = new Map(
      chats.map(chat => {
        const p = chat.participants.find(p => p.userId === user.id);
        return [chat.id, p?.lastReadAt || new Date(0)];
      })
    );

    const unreadCounts = chatIds.length > 0
      ? await prisma.chatMessage.groupBy({
          by: ['chatId'],
          where: {
            chatId: { in: chatIds },
            senderId: { not: user.id },
            OR: chatIds.map(chatId => ({
              chatId,
              createdAt: { gt: participantsByChat.get(chatId)! }
            }))
          },
          _count: { id: true }
        })
      : [];

    const unreadMap = new Map(unreadCounts.map(c => [c.chatId, c._count.id]));
    const chatsWithUnread = chats.map(chat => ({
      ...chat,
      unreadCount: unreadMap.get(chat.id) || 0
    }));

    res.json(chatsWithUnread);
  } catch (error) {
    next(error);
  }
});

// Get total unread count across all chats
router.get('/unread-count', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;

    const participants = await prisma.chatParticipant.findMany({
      where: { userId: user.id },
      select: { chatId: true, lastReadAt: true }
    });

    // Aggregate unread counts in a single query instead of per-chat
    const chatIds = participants.map(p => p.chatId);
    let totalUnread = 0;

    if (chatIds.length > 0) {
      const unreadCounts = await prisma.chatMessage.groupBy({
        by: ['chatId'],
        where: {
          chatId: { in: chatIds },
          senderId: { not: user.id },
          OR: participants.map(p => ({
            chatId: p.chatId,
            createdAt: { gt: p.lastReadAt || new Date(0) }
          }))
        },
        _count: { id: true }
      });
      totalUnread = unreadCounts.reduce((sum, c) => sum + c._count.id, 0);
    }

    res.json({ unreadCount: totalUnread });
  } catch (error) {
    next(error);
  }
});

// Create new chat (1:1 or group)
router.post('/', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;
    const { name, participantIds, isGroup } = req.body;

    if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
      throw new AppError('At least one participant is required', 400);
    }

    // For 1:1 chats, check if one already exists
    if (!isGroup && participantIds.length === 1) {
      const existingChat = await prisma.chat.findFirst({
        where: {
          isGroup: false,
          participants: {
            every: {
              userId: { in: [user.id, participantIds[0]] }
            }
          }
        },
        include: {
          participants: {
            include: {
              user: {
                select: { id: true, name: true, email: true, avatarUrl: true }
              }
            }
          }
        }
      });

      if (existingChat && existingChat.participants.length === 2) {
        return res.json(existingChat);
      }
    }

    // Create the chat
    const chat = await prisma.chat.create({
      data: {
        name: isGroup ? name : null,
        isGroup: isGroup || false,
        creatorId: user.id,
        participants: {
          create: [
            { userId: user.id },
            ...participantIds.map((id: string) => ({ userId: id }))
          ]
        }
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true }
            }
          }
        }
      }
    });

    // Notify participants via socket
    const io = req.app.get('io');
    if (io) {
      for (const participantId of participantIds) {
        io.to(`user:${participantId}`).emit('chat:new', chat);
      }
    }

    res.status(201).json(chat);
  } catch (error) {
    next(error);
  }
});

// Get chat details
router.get('/:id', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;
    const id = req.params.id as string;

    // Verify participation
    const participant = await prisma.chatParticipant.findUnique({
      where: {
        chatId_userId: { chatId: id, userId: user.id }
      }
    });

    if (!participant) {
      throw new AppError('Not a participant of this chat', 403);
    }

    const chat = await prisma.chat.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, name: true, email: true }
        },
        participants: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true }
            }
          }
        }
      }
    });

    if (!chat) {
      throw new AppError('Chat not found', 404);
    }

    res.json(chat);
  } catch (error) {
    next(error);
  }
});

// Get chat messages (paginated, 30-day limit)
router.get('/:id/messages', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;
    const id = req.params.id as string;
    const cursor = getQueryString(req.query.cursor);
    const limitStr = getQueryString(req.query.limit) || '50';
    const limit = parseInt(limitStr, 10);

    // Verify participation
    const participant = await prisma.chatParticipant.findUnique({
      where: {
        chatId_userId: { chatId: id, userId: user.id }
      }
    });

    if (!participant) {
      throw new AppError('Not a participant of this chat', 403);
    }

    const messages = await prisma.chatMessage.findMany({
      where: {
        chatId: id,
        createdAt: { gte: thirtyDaysAgo() }
      },
      include: {
        sender: {
          select: { id: true, name: true, email: true, avatarUrl: true }
        },
        attachments: true,
        readReceipts: {
          select: { userId: true, readAt: true }
        },
        reactions: {
          include: {
            user: {
              select: { id: true, name: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 })
    });

    const hasMore = messages.length > limit;
    if (hasMore) messages.pop();

    res.json({
      messages: messages.reverse(),
      hasMore,
      nextCursor: hasMore ? messages[0]?.id : null
    });
  } catch (error) {
    next(error);
  }
});

// Send message (REST fallback, primarily use WebSocket)
router.post('/:id/messages', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;
    const id = req.params.id as string;
    const { content } = req.body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      throw new AppError('Message content is required', 400);
    }

    // Verify participation
    const participant = await prisma.chatParticipant.findUnique({
      where: {
        chatId_userId: { chatId: id, userId: user.id }
      }
    });

    if (!participant) {
      throw new AppError('Not a participant of this chat', 403);
    }

    const message = await prisma.chatMessage.create({
      data: {
        chatId: id,
        senderId: user.id,
        content: content.trim()
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
        userId: user.id
      }
    });

    // Update chat's updatedAt and get participants for notifications
    const chatWithParticipants = await prisma.chat.update({
      where: { id },
      data: { updatedAt: new Date() },
      select: { participants: { select: { userId: true } } }
    });

    // Broadcast via socket to chat room and individual participants
    const io = req.app.get('io');
    if (io) {
      // Broadcast to chat room
      io.to(`chat:${id}`).emit('message:new', message);

      // Also notify all participants via their personal rooms (for reliability)
      for (const p of chatWithParticipants.participants) {
        io.to(`user:${p.userId}`).emit('message:new', message);
      }
    }

    res.status(201).json(message);
  } catch (error) {
    next(error);
  }
});

// Mark chat as read
router.post('/:id/read', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;
    const id = req.params.id as string;

    // Verify participation
    const participant = await prisma.chatParticipant.findUnique({
      where: {
        chatId_userId: { chatId: id, userId: user.id }
      }
    });

    if (!participant) {
      throw new AppError('Not a participant of this chat', 403);
    }

    // Get all unread messages
    const unreadMessages = await prisma.chatMessage.findMany({
      where: {
        chatId: id,
        senderId: { not: user.id },
        readReceipts: {
          none: { userId: user.id }
        }
      },
      select: { id: true }
    });

    // Create read receipts
    if (unreadMessages.length > 0) {
      await prisma.chatReadReceipt.createMany({
        data: unreadMessages.map(m => ({
          messageId: m.id,
          userId: user.id
        })),
        skipDuplicates: true
      });
    }

    // Update lastReadAt
    await prisma.chatParticipant.update({
      where: {
        chatId_userId: { chatId: id, userId: user.id }
      },
      data: { lastReadAt: new Date() }
    });

    // Broadcast read receipts
    const io = req.app.get('io');
    if (io) {
      io.to(`chat:${id}`).emit('message:read', {
        chatId: id,
        userId: user.id,
        messageIds: unreadMessages.map(m => m.id),
        readAt: new Date().toISOString()
      });
    }

    res.json({ success: true, messagesRead: unreadMessages.length });
  } catch (error) {
    next(error);
  }
});

// Add participant (creator only, groups only)
router.post('/:id/participants', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;
    const id = req.params.id as string;
    const { userId: newUserId } = req.body;

    const chat = await prisma.chat.findUnique({
      where: { id },
      include: { participants: true }
    });

    if (!chat) {
      throw new AppError('Chat not found', 404);
    }

    if (!chat.isGroup) {
      throw new AppError('Cannot add participants to a direct message', 400);
    }

    if (chat.creatorId !== user.id) {
      throw new AppError('Only the chat creator can add participants', 403);
    }

    // Check if already a participant
    const existing = chat.participants.find(p => p.userId === newUserId);
    if (existing) {
      throw new AppError('User is already a participant', 400);
    }

    const participantRecord = await prisma.chatParticipant.create({
      data: {
        chatId: id,
        userId: newUserId
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true }
        }
      }
    });

    // Notify via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`chat:${id}`).emit('chat:participant-added', participantRecord);
      io.to(`user:${newUserId}`).emit('chat:new', chat);
    }

    res.status(201).json(participantRecord);
  } catch (error) {
    next(error);
  }
});

// Remove participant (creator only)
router.delete('/:id/participants/:userId', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;
    const id = req.params.id as string;
    const targetUserId = req.params.userId as string;

    const chat = await prisma.chat.findUnique({ where: { id } });

    if (!chat) {
      throw new AppError('Chat not found', 404);
    }

    if (!chat.isGroup) {
      throw new AppError('Cannot remove participants from a direct message', 400);
    }

    // Creator can remove anyone; users can remove themselves
    if (chat.creatorId !== user.id && user.id !== targetUserId) {
      throw new AppError('Only the chat creator can remove other participants', 403);
    }

    await prisma.chatParticipant.delete({
      where: {
        chatId_userId: { chatId: id, userId: targetUserId }
      }
    });

    // Notify via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`chat:${id}`).emit('chat:participant-removed', { chatId: id, userId: targetUserId });
      io.to(`user:${targetUserId}`).emit('chat:removed', { chatId: id });
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Upload attachment
router.post('/:id/attachments', isAuthenticated, upload.array('files', 10), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;
    const id = req.params.id as string;
    const messageContent = typeof req.body.messageContent === 'string' ? req.body.messageContent : undefined;

    // Support both multi-file (files) and legacy single-file (file)
    const files = req.files as Express.Multer.File[] | undefined;
    const singleFile = req.file;
    const uploadFiles = files?.length ? files : singleFile ? [singleFile] : [];

    if (uploadFiles.length === 0) {
      throw new AppError('No file uploaded', 400);
    }

    if (!isStorageConfigured()) {
      throw new AppError('Cloud storage not configured', 500);
    }

    // Verify participation
    const participant = await prisma.chatParticipant.findUnique({
      where: {
        chatId_userId: { chatId: id, userId: user.id }
      }
    });

    if (!participant) {
      throw new AppError('Not a participant of this chat', 403);
    }

    // Upload all files to R2
    const uploadedFiles: { fileName: string; fileSize: number; fileType: string; storageKey: string }[] = [];
    for (const file of uploadFiles) {
      const storageKey = generateStorageKey('chat', file.originalname);
      await uploadFile(storageKey, file.buffer, file.mimetype);
      uploadedFiles.push({
        fileName: file.originalname,
        fileSize: file.size,
        fileType: file.mimetype,
        storageKey
      });
    }

    // Create message with attachments
    const fileNames = uploadFiles.map(f => f.originalname).join(', ');
    const message = await prisma.chatMessage.create({
      data: {
        chatId: id,
        senderId: user.id,
        content: messageContent || `Shared ${uploadFiles.length === 1 ? 'a file' : `${uploadFiles.length} files`}: ${fileNames}`,
        attachments: {
          create: uploadedFiles
        }
      },
      include: {
        sender: {
          select: { id: true, name: true, email: true, avatarUrl: true }
        },
        attachments: true
      }
    });

    // Create read receipt for sender
    await prisma.chatReadReceipt.create({
      data: {
        messageId: message.id,
        userId: user.id
      }
    });

    // Update chat's updatedAt and get participants for notifications
    const chatWithParticipants = await prisma.chat.update({
      where: { id },
      data: { updatedAt: new Date() },
      select: { participants: { select: { userId: true } } }
    });

    // Broadcast via socket to chat room and individual participants
    const io = req.app.get('io');
    if (io) {
      // Broadcast to chat room (for users actively viewing the chat)
      io.to(`chat:${id}`).emit('message:new', message);

      // Also notify all participants via their personal rooms (for reliability)
      for (const p of chatWithParticipants.participants) {
        io.to(`user:${p.userId}`).emit('message:new', message);
      }
    }

    res.status(201).json(message);
  } catch (error) {
    next(error);
  }
});

// Get signed URL for attachment (returns JSON)
router.post('/attachments/signed-url', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;
    const { storageKey } = req.body;

    if (!storageKey || typeof storageKey !== 'string') {
      throw new AppError('storageKey is required', 400);
    }

    // Find the attachment
    const attachment = await prisma.chatAttachment.findFirst({
      where: { storageKey },
      include: {
        message: {
          include: {
            chat: {
              include: {
                participants: true
              }
            }
          }
        }
      }
    });

    if (!attachment) {
      throw new AppError('Attachment not found', 404);
    }

    // Verify user is a participant
    const isParticipant = attachment.message.chat.participants.some(p => p.userId === user.id);
    if (!isParticipant) {
      throw new AppError('Not authorized to access this attachment', 403);
    }

    // Get signed URL from R2
    const signedUrl = await getSignedDownloadUrl(attachment.storageKey);
    res.json({ url: signedUrl });
  } catch (error) {
    next(error);
  }
});

// Serve attachment file (redirect to signed R2 URL) - fallback for direct links
// Use wildcard to capture storageKey with slashes (e.g., chat/1234-abc.jpg)
router.get('/attachments/*', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;
    const storageKey = req.params[0] as string;

    // Find the attachment
    const attachment = await prisma.chatAttachment.findFirst({
      where: { storageKey },
      include: {
        message: {
          include: {
            chat: {
              include: {
                participants: true
              }
            }
          }
        }
      }
    });

    if (!attachment) {
      throw new AppError('Attachment not found', 404);
    }

    // Verify user is a participant
    const isParticipant = attachment.message.chat.participants.some(p => p.userId === user.id);
    if (!isParticipant) {
      throw new AppError('Not authorized to access this attachment', 403);
    }

    // Get signed URL from R2 and redirect
    const signedUrl = await getSignedDownloadUrl(attachment.storageKey);
    res.redirect(signedUrl);
  } catch (error) {
    next(error);
  }
});

// Valid emoji keys for reactions
const VALID_EMOJIS = ['thumbsup', 'thumbsdown', 'heart', 'laugh', 'surprised', 'sad', 'party'];

// Toggle reaction on a message
router.post('/:id/messages/:messageId/reactions', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as Express.User;
    const chatId = req.params.id as string;
    const messageId = req.params.messageId as string;
    const { emoji } = req.body;

    // Validate emoji
    if (!emoji || !VALID_EMOJIS.includes(emoji)) {
      throw new AppError('Invalid emoji. Must be one of: ' + VALID_EMOJIS.join(', '), 400);
    }

    // Verify participation
    const participant = await prisma.chatParticipant.findUnique({
      where: {
        chatId_userId: { chatId, userId: user.id }
      }
    });

    if (!participant) {
      throw new AppError('Not a participant of this chat', 403);
    }

    // Verify message exists and belongs to this chat
    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId }
    });

    if (!message || message.chatId !== chatId) {
      throw new AppError('Message not found', 404);
    }

    // Check if reaction already exists
    const existingReaction = await prisma.messageReaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId: user.id,
          emoji
        }
      }
    });

    let action: 'added' | 'removed';

    if (existingReaction) {
      // Remove reaction
      await prisma.messageReaction.delete({
        where: { id: existingReaction.id }
      });
      action = 'removed';
    } else {
      // Add reaction
      await prisma.messageReaction.create({
        data: {
          messageId,
          userId: user.id,
          emoji
        }
      });
      action = 'added';
    }

    // Get updated reactions for this message
    const reactions = await prisma.messageReaction.findMany({
      where: { messageId },
      include: {
        user: {
          select: { id: true, name: true }
        }
      }
    });

    // Broadcast reaction update to chat room
    const io = req.app.get('io');
    if (io) {
      io.to(`chat:${chatId}`).emit('reaction:updated', {
        messageId,
        reactions,
        action,
        userId: user.id,
        emoji
      });
    }

    res.json({ reactions });
  } catch (error) {
    next(error);
  }
});

export default router;
