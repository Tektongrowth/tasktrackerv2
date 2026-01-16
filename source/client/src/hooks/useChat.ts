import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Chat, ChatMessage, ChatParticipant } from '../lib/types';
import { API_BASE, chats as chatsApi } from '../lib/api';
import { useAuth } from './useAuth';

interface UseChatOptions {
  onNewMessage?: (message: ChatMessage) => void;
  onMessageRead?: (data: { chatId: string; userId: string; messageIds: string[]; readAt: string }) => void;
  onNewChat?: (chat: Chat) => void;
  onChatRemoved?: (data: { chatId: string }) => void;
  onParticipantAdded?: (participant: ChatParticipant) => void;
  onParticipantRemoved?: (data: { chatId: string; userId: string }) => void;
  onTypingStart?: (data: { chatId: string; userId: string }) => void;
  onTypingStop?: (data: { chatId: string; userId: string }) => void;
}

export function useChat(options: UseChatOptions = {}) {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Use refs to store latest callbacks to avoid stale closure issues
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Connect to socket
  useEffect(() => {
    if (!user) return;

    // Socket.IO handles WebSocket upgrade internally - use HTTP(S) URL
    const socketUrl = API_BASE;
    const socket = io(socketUrl, {
      auth: { userId: user.id },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Chat connected');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Chat disconnected');
      setIsConnected(false);
    });

    socket.on('message:new', (message: ChatMessage) => {
      optionsRef.current.onNewMessage?.(message);
      // Update unread count if not from current user
      if (message.senderId !== user.id) {
        setUnreadCount((prev) => prev + 1);
      }
    });

    socket.on('message:read', (data: { chatId: string; userId: string; messageIds: string[]; readAt: string }) => {
      optionsRef.current.onMessageRead?.(data);
    });

    socket.on('chat:new', (chat: Chat) => {
      optionsRef.current.onNewChat?.(chat);
    });

    socket.on('chat:removed', (data: { chatId: string }) => {
      optionsRef.current.onChatRemoved?.(data);
    });

    socket.on('chat:participant-added', (participant: ChatParticipant) => {
      optionsRef.current.onParticipantAdded?.(participant);
    });

    socket.on('chat:participant-removed', (data: { chatId: string; userId: string }) => {
      optionsRef.current.onParticipantRemoved?.(data);
    });

    socket.on('typing:start', (data: { chatId: string; userId: string }) => {
      optionsRef.current.onTypingStart?.(data);
    });

    socket.on('typing:stop', (data: { chatId: string; userId: string }) => {
      optionsRef.current.onTypingStop?.(data);
    });

    socket.on('error', (error: { message: string }) => {
      console.error('Socket error:', error.message);
    });

    // Fetch initial unread count
    chatsApi.getUnreadCount().then((data) => {
      setUnreadCount(data.unreadCount);
    }).catch(console.error);

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user]);

  // Join a chat room
  const joinChat = useCallback((chatId: string) => {
    socketRef.current?.emit('chat:join', chatId);
  }, []);

  // Leave a chat room
  const leaveChat = useCallback((chatId: string) => {
    socketRef.current?.emit('chat:leave', chatId);
  }, []);

  // Send a message via socket (faster than REST)
  const sendMessage = useCallback((chatId: string, content: string, tempId?: string) => {
    socketRef.current?.emit('message:send', { chatId, content, tempId });
  }, []);

  // Mark messages as read
  const markAsRead = useCallback((chatId: string, messageIds: string[]) => {
    socketRef.current?.emit('message:read', { chatId, messageIds });
  }, []);

  // Start typing indicator
  const startTyping = useCallback((chatId: string) => {
    socketRef.current?.emit('typing:start', chatId);
  }, []);

  // Stop typing indicator
  const stopTyping = useCallback((chatId: string) => {
    socketRef.current?.emit('typing:stop', chatId);
  }, []);

  // Decrease unread count when chat is marked as read
  const decreaseUnreadCount = useCallback((count: number) => {
    setUnreadCount((prev) => Math.max(0, prev - count));
  }, []);

  // Refresh unread count
  const refreshUnreadCount = useCallback(async () => {
    try {
      const data = await chatsApi.getUnreadCount();
      setUnreadCount(data.unreadCount);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  }, []);

  return {
    isConnected,
    unreadCount,
    joinChat,
    leaveChat,
    sendMessage,
    markAsRead,
    startTyping,
    stopTyping,
    decreaseUnreadCount,
    refreshUnreadCount,
  };
}
