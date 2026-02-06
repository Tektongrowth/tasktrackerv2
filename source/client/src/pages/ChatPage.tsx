import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MessageCircle, Plus, Search, Users, Paperclip, Send, File, X, Check, CheckCheck, AtSign, ChevronDown, ChevronRight, ListPlus, ArrowLeft } from 'lucide-react';
import { useIsMobile } from '@/hooks/useIsMobile';
import { Chat, ChatMessage } from '../lib/types';
import { chats as chatsApi, users as usersApi, notifications as notificationsApi, projects as projectsApi, type MentionNotification } from '../lib/api';
import { useCreateTask } from '../hooks/useTasks';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from '../components/ui/toaster';
import { UserAvatar } from '../components/UserAvatar';
import { GifPicker } from '../components/GifPicker';
import { linkifyText } from '../lib/utils';

// Minimal user type for chat list (returned by /api/users/chat-list)
type ChatUser = { id: string; name: string; email: string; avatarUrl: string | null };

// Component to display chat attachments with signed URLs
function ChatAttachmentDisplay({
  attachment,
}: {
  attachment: { id: string; fileName: string; fileType: string; storageKey: string };
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const isImage = attachment.fileType.startsWith('image/');
  const isPdf = attachment.fileType === 'application/pdf';

  useEffect(() => {
    if (!isImage) {
      setLoading(false);
      return;
    }

    // Get signed URL from API
    chatsApi.getAttachmentSignedUrl(attachment.storageKey)
      .then(({ url }) => {
        setImageUrl(url);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [attachment.storageKey, isImage]);

  const handleClick = async () => {
    if (isImage && imageUrl) {
      window.open(imageUrl, '_blank');
    } else {
      // For non-images or if URL not loaded yet, fetch and open
      try {
        const { url } = await chatsApi.getAttachmentSignedUrl(attachment.storageKey);
        window.open(url, '_blank');
      } catch {
        // Fallback to redirect URL
        window.open(chatsApi.getAttachmentUrl(attachment.storageKey), '_blank');
      }
    }
  };

  if (isImage) {
    return (
      <div className="cursor-pointer" onClick={handleClick}>
        {loading ? (
          <div className="w-48 h-32 bg-black/10 rounded animate-pulse flex items-center justify-center">
            <File className="h-6 w-6 opacity-50" />
          </div>
        ) : error ? (
          <div className="w-48 h-32 bg-black/10 rounded flex items-center justify-center">
            <span className="text-sm opacity-70">Failed to load image</span>
          </div>
        ) : (
          <img
            src={imageUrl || ''}
            alt={attachment.fileName}
            className="max-w-full max-h-64 rounded cursor-pointer hover:opacity-90 transition-opacity"
          />
        )}
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-2 p-2 bg-black/10 rounded hover:bg-black/20 transition-colors text-left"
    >
      <File className={`w-4 h-4 ${isPdf ? 'text-red-500' : ''}`} />
      <span className="text-sm truncate">{attachment.fileName}</span>
      {isPdf && <span className="text-xs opacity-70">(click to view)</span>}
    </button>
  );
}

import { useChat } from '../hooks/useChat';
import { useAuth } from '../hooks/useAuth';
import { ReactionPicker, ReactionDisplay } from '../components/reactions';
import { formatDistanceToNow } from 'date-fns';

export default function ChatPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const [chatList, setChatList] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(searchParams.get('id'));
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [allUsers, setAllUsers] = useState<ChatUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typingUsers, setTypingUsers] = useState<Record<string, Set<string>>>({});
  const [mentions, setMentions] = useState<MentionNotification[]>([]);
  const [showMentions, setShowMentions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Create task from message state
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);
  const [createTaskContent, setCreateTaskContent] = useState('');
  const [createTaskTitle, setCreateTaskTitle] = useState('');
  const [createTaskProjectId, setCreateTaskProjectId] = useState('');
  const [createTaskAssigneeIds, setCreateTaskAssigneeIds] = useState<string[]>([]);
  const createTask = useCreateTask();

  // Fetch all projects for task creation
  const { data: allProjects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
    enabled: showCreateTaskDialog,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    isConnected,
    joinChat,
    leaveChat,
    sendMessage: sendSocketMessage,
    markAsRead,
    startTyping,
    stopTyping,
    toggleReaction,
    decreaseUnreadCount,
  } = useChat({
    onNewMessage: (message) => {
      // Update messages if in the active chat
      if (message.chatId === activeChatId) {
        setMessages((prev) => {
          // Check if message already exists by ID (prevents duplicates from socket + API)
          const existsById = prev.some((m) => m.id === message.id);
          if (existsById) {
            return prev; // Already have this message, ignore
          }
          // Check for optimistic update by tempId
          const existsByTempId = message.tempId && prev.some((m) => m.tempId === message.tempId);
          if (existsByTempId) {
            return prev.map((m) => (m.tempId === message.tempId ? message : m));
          }
          return [...prev, message];
        });
        // Mark as read if from another user
        if (message.senderId !== user?.id) {
          markAsRead(message.chatId, [message.id]);
        }
      }
      // Update chat list preview
      setChatList((prev) =>
        prev.map((chat) =>
          chat.id === message.chatId
            ? {
                ...chat,
                messages: [message],
                updatedAt: message.createdAt,
                unreadCount: message.chatId === activeChatId && message.senderId !== user?.id
                  ? 0
                  : (chat.unreadCount || 0) + (message.senderId !== user?.id ? 1 : 0),
              }
            : chat
        ).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      );
    },
    onMessageRead: (data) => {
      if (data.chatId === activeChatId) {
        setMessages((prev) =>
          prev.map((m) =>
            data.messageIds.includes(m.id)
              ? {
                  ...m,
                  readReceipts: [
                    ...(m.readReceipts || []),
                    { userId: data.userId, readAt: data.readAt },
                  ],
                }
              : m
          )
        );
      }
    },
    onNewChat: (chat) => {
      setChatList((prev) => [chat, ...prev]);
    },
    onChatRemoved: (data) => {
      setChatList((prev) => prev.filter((c) => c.id !== data.chatId));
      if (activeChatId === data.chatId) {
        setActiveChatId(null);
        setActiveChat(null);
        setMessages([]);
      }
    },
    onTypingStart: (data) => {
      if (data.userId !== user?.id) {
        setTypingUsers((prev) => ({
          ...prev,
          [data.chatId]: new Set([...(prev[data.chatId] || []), data.userId]),
        }));
      }
    },
    onTypingStop: (data) => {
      setTypingUsers((prev) => {
        const chatTypers = new Set(prev[data.chatId]);
        chatTypers.delete(data.userId);
        return { ...prev, [data.chatId]: chatTypers };
      });
    },
    onReactionUpdated: (data) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.messageId
            ? { ...m, reactions: data.reactions }
            : m
        )
      );
    },
  });

  // Load chat list
  useEffect(() => {
    async function loadChats() {
      try {
        const chats = await chatsApi.list();
        console.log('Loaded chats with unread counts:', chats.map(c => ({ name: c.name, unreadCount: c.unreadCount })));
        // Sort chats: unread first, then by updatedAt
        const sortedChats = [...chats].sort((a, b) => {
          const aUnread = a.unreadCount || 0;
          const bUnread = b.unreadCount || 0;
          // If one has unread and other doesn't, unread comes first
          if (aUnread > 0 && bUnread === 0) return -1;
          if (bUnread > 0 && aUnread === 0) return 1;
          // Otherwise sort by date
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });
        setChatList(sortedChats);
      } catch (error) {
        console.error('Failed to load chats:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadChats();
  }, [user?.id]);

  // Load users for new chat dialog
  useEffect(() => {
    async function loadUsers() {
      try {
        const users = await usersApi.listForChat();
        setAllUsers(users);
      } catch (error) {
        console.error('Could not load users list:', error);
      }
    }
    loadUsers();
  }, [user?.id]);

  // Load task mentions
  useEffect(() => {
    async function loadMentions() {
      try {
        const mentionsList = await notificationsApi.getMentions();
        setMentions(mentionsList);
      } catch (error) {
        console.error('Failed to load mentions:', error);
      }
    }
    loadMentions();
  }, []);

  // Load active chat
  useEffect(() => {
    if (!activeChatId) {
      setActiveChat(null);
      setMessages([]);
      return;
    }

    async function loadChat() {
      try {
        const [chat, messagesData] = await Promise.all([
          chatsApi.get(activeChatId!),
          chatsApi.getMessages(activeChatId!),
        ]);
        setActiveChat(chat);
        setMessages(messagesData.messages);
        joinChat(activeChatId!);

        // Mark all as read
        const unreadMessages = messagesData.messages.filter(
          (m) => m.senderId !== user?.id && !m.readReceipts?.some((r) => r.userId === user?.id)
        );
        if (unreadMessages.length > 0) {
          markAsRead(activeChatId!, unreadMessages.map((m) => m.id));
          decreaseUnreadCount(unreadMessages.length);
          setChatList((prev) =>
            prev.map((c) => (c.id === activeChatId ? { ...c, unreadCount: 0 } : c))
          );
        }
      } catch (error) {
        console.error('Failed to load chat:', error);
      }
    }
    loadChat();

    return () => {
      if (activeChatId) {
        leaveChat(activeChatId);
      }
    };
  }, [activeChatId, joinChat, leaveChat, markAsRead, user?.id, decreaseUnreadCount]);

  // Re-join chat room when socket connects/reconnects
  useEffect(() => {
    if (isConnected && activeChatId) {
      joinChat(activeChatId);
    }
  }, [isConnected, activeChatId, joinChat]);

  // Poll for new messages as fallback (in case socket delivery fails)
  useEffect(() => {
    if (!activeChatId) return;

    const pollInterval = setInterval(async () => {
      try {
        const messagesData = await chatsApi.getMessages(activeChatId);
        setMessages((prev) => {
          // Only update if there are new messages
          if (messagesData.messages.length > prev.length) {
            // Merge new messages, avoiding duplicates
            const existingIds = new Set(prev.map((m) => m.id));
            const newMessages = messagesData.messages.filter((m) => !existingIds.has(m.id));
            if (newMessages.length > 0) {
              return [...prev, ...newMessages];
            }
          }
          return prev;
        });
      } catch (error) {
        // Silently fail - socket should handle most updates
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [activeChatId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Update URL when active chat changes
  useEffect(() => {
    if (activeChatId) {
      setSearchParams({ id: activeChatId });
    } else {
      setSearchParams({});
    }
  }, [activeChatId, setSearchParams]);

  const handleSendMessage = useCallback(async () => {
    if (!messageInput.trim() || !activeChatId || isSending) return;

    const content = messageInput.trim();
    setMessageInput('');
    setIsSending(true);

    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: ChatMessage = {
      id: tempId,
      tempId,
      chatId: activeChatId,
      senderId: user!.id,
      content,
      createdAt: new Date().toISOString(),
      sender: { id: user!.id, name: user!.name, email: user!.email, avatarUrl: user!.avatarUrl },
    };
    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      sendSocketMessage(activeChatId, content, tempId);
    } catch (error) {
      console.error('Failed to send message:', error);
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.tempId !== tempId));
    } finally {
      setIsSending(false);
    }
  }, [messageInput, activeChatId, isSending, user, sendSocketMessage]);

  const handleGifSelect = useCallback(async (gifUrl: string) => {
    if (!activeChatId || isSending) return;

    setShowGifPicker(false);
    setIsSending(true);

    // Send GIF URL as message content
    const content = gifUrl;

    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: ChatMessage = {
      id: tempId,
      tempId,
      chatId: activeChatId,
      senderId: user!.id,
      content,
      createdAt: new Date().toISOString(),
      sender: { id: user!.id, name: user!.name, email: user!.email, avatarUrl: user!.avatarUrl },
    };
    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      sendSocketMessage(activeChatId, content, tempId);
    } catch (error) {
      console.error('Failed to send GIF:', error);
      setMessages((prev) => prev.filter((m) => m.tempId !== tempId));
    } finally {
      setIsSending(false);
    }
  }, [activeChatId, isSending, user, sendSocketMessage]);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !activeChatId) return;

    try {
      const message = await chatsApi.uploadAttachment(activeChatId, file);
      // Add locally for immediate feedback - onNewMessage will ignore duplicates by ID
      setMessages((prev) => {
        const exists = prev.some((m) => m.id === message.id);
        if (exists) return prev;
        return [...prev, message];
      });
    } catch (error) {
      console.error('Failed to upload file:', error);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [activeChatId]);

  const handleTyping = useCallback(() => {
    if (!activeChatId) return;

    startTyping(activeChatId);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      stopTyping(activeChatId);
    }, 2000);
  }, [activeChatId, startTyping, stopTyping]);

  const createNewChat = useCallback(async (participantIds: string[], isGroup: boolean, name?: string) => {
    try {
      const chat = await chatsApi.create({ participantIds, isGroup, name });
      setChatList((prev) => [chat, ...prev]);
      setActiveChatId(chat.id);
      setShowNewChatDialog(false);
    } catch (error) {
      console.error('Failed to create chat:', error);
    }
  }, []);

  const getChatName = (chat: Chat) => {
    if (chat.name) return chat.name;
    const otherParticipants = chat.participants?.filter((p) => p.userId !== user?.id) || [];
    return otherParticipants.map((p) => p.user?.name || p.user?.email).join(', ') || 'Chat';
  };

  const getChatAvatar = (chat: Chat) => {
    if (chat.isGroup) {
      return (
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
          <Users className="w-5 h-5 text-primary" />
        </div>
      );
    }
    const otherParticipant = chat.participants?.find((p) => p.userId !== user?.id);
    if (otherParticipant?.user?.avatarUrl) {
      return (
        <img
          src={otherParticipant.user.avatarUrl}
          alt={otherParticipant.user.name}
          className="w-10 h-10 rounded-full object-cover"
        />
      );
    }
    return (
      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
        <span className="text-primary font-medium">
          {(otherParticipant?.user?.name || otherParticipant?.user?.email || 'U')[0].toUpperCase()}
        </span>
      </div>
    );
  };

  const filteredChats = chatList.filter((chat) => {
    if (!searchQuery) return true;
    const name = getChatName(chat).toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  const handleMentionClick = useCallback(async (mention: MentionNotification) => {
    // Mark as read if not already
    if (!mention.readAt) {
      try {
        await notificationsApi.markMentionsAsRead([mention.id]);
        setMentions((prev) =>
          prev.map((m) => (m.id === mention.id ? { ...m, readAt: new Date().toISOString() } : m))
        );
      } catch (error) {
        console.error('Failed to mark mention as read:', error);
      }
    }
    // Navigate to the task in the kanban view
    navigate(`/kanban?taskId=${mention.task.id}`);
  }, [navigate]);

  // Handler to open create task dialog from a message
  const handleCreateTaskFromMessage = useCallback((message: ChatMessage) => {
    const authorName = message.sender?.name || 'Unknown';
    const content = message.content || '';
    // Generate a title from the first line or first ~50 chars
    const firstLine = content.split('\n')[0].slice(0, 50);
    const suggestedTitle = firstLine.length < content.length ? `${firstLine}...` : firstLine;

    setCreateTaskTitle(suggestedTitle);
    setCreateTaskContent(`From chat message by ${authorName}:\n\n${content}`);
    setCreateTaskProjectId('');
    setCreateTaskAssigneeIds([]);
    setShowCreateTaskDialog(true);
  }, []);

  // Handle creating the task from message
  const handleCreateTask = useCallback(() => {
    if (!createTaskTitle.trim() || !createTaskProjectId) {
      toast({ title: 'Please enter a title and select a project', variant: 'destructive' });
      return;
    }

    createTask.mutate(
      {
        title: createTaskTitle.trim(),
        description: createTaskContent.trim(),
        projectId: createTaskProjectId,
        status: 'todo',
        priority: 'medium',
        assigneeIds: createTaskAssigneeIds.length > 0 ? createTaskAssigneeIds : undefined,
      },
      {
        onSuccess: () => {
          toast({ title: 'Task created successfully' });
          setShowCreateTaskDialog(false);
          setCreateTaskTitle('');
          setCreateTaskContent('');
          setCreateTaskProjectId('');
          setCreateTaskAssigneeIds([]);
        },
        onError: (error: Error) => {
          toast({ title: 'Failed to create task', description: error.message, variant: 'destructive' });
        },
      }
    );
  }, [createTaskTitle, createTaskContent, createTaskProjectId, createTaskAssigneeIds, createTask]);

  const unreadMentionCount = mentions.filter((m) => !m.readAt).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex bg-card rounded-lg border overflow-hidden relative">
      {/* Chat List Sidebar */}
      <div className={`w-full md:w-80 border-r flex flex-col ${isMobile && activeChat ? 'hidden' : ''}`}>
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              Messages
            </h2>
            <button
              onClick={() => setShowNewChatDialog(true)}
              className="p-2 hover:bg-muted rounded-full transition-colors"
              title="New chat"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-muted rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredChats.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              {searchQuery ? 'No chats found' : 'No conversations yet'}
            </div>
          ) : (
            filteredChats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => setActiveChatId(chat.id)}
                className={`w-full p-4 flex items-start gap-3 hover:bg-muted/50 transition-colors border-l-4 ${
                  activeChatId === chat.id
                    ? 'bg-muted border-l-transparent'
                    : (chat.unreadCount || 0) > 0
                      ? 'bg-red-50 border-l-red-500 dark:bg-red-900/30'
                      : 'border-l-transparent'
                }`}
              >
                {getChatAvatar(chat)}
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between">
                    <span className="font-medium truncate">{getChatName(chat)}</span>
                    {chat.messages?.[0] && (
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(chat.messages[0].createdAt), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-sm text-muted-foreground truncate">
                      {chat.messages?.[0]?.content || 'No messages yet'}
                    </p>
                    {(chat.unreadCount || 0) > 0 && (
                      <span className="ml-2 min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                        {chat.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Task Mentions Section */}
        <div className="border-t">
          <button
            onClick={() => setShowMentions(!showMentions)}
            className="w-full p-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <AtSign className="w-4 h-4 text-primary" />
              <span className="font-medium text-sm">Task Mentions</span>
              {unreadMentionCount > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {unreadMentionCount}
                </span>
              )}
            </div>
            {showMentions ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
          {showMentions && (
            <div className="max-h-60 overflow-y-auto">
              {mentions.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  No mentions yet
                </div>
              ) : (
                mentions.map((mention) => (
                  <button
                    key={mention.id}
                    onClick={() => handleMentionClick(mention)}
                    className={`w-full p-3 flex items-start gap-3 hover:bg-muted/50 transition-colors text-left ${
                      !mention.readAt ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    {mention.mentionedBy.avatarUrl ? (
                      <img
                        src={mention.mentionedBy.avatarUrl}
                        alt={mention.mentionedBy.name}
                        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-primary font-medium text-xs">
                          {mention.mentionedBy.name[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 text-xs">
                        <span className="font-medium truncate">{mention.mentionedBy.name}</span>
                        <span className="text-muted-foreground">mentioned you</span>
                      </div>
                      <p className="text-sm font-medium text-primary truncate mt-0.5">
                        {mention.task.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {mention.commentContent.length > 60
                          ? mention.commentContent.substring(0, 60) + '...'
                          : mention.commentContent}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(mention.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    {!mention.readAt && (
                      <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-2" />
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="p-2 border-t text-xs text-center text-muted-foreground">
          {isConnected ? (
            <span className="flex items-center justify-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              Connected
            </span>
          ) : (
            <span className="flex items-center justify-center gap-1">
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              Disconnected
            </span>
          )}
        </div>
      </div>

      {/* Chat Area */}
      {activeChat ? (
        <div className={`flex-1 flex flex-col ${isMobile ? 'fixed inset-0 z-50 bg-card pb-16' : ''}`}>
          {/* Chat Header */}
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Back button on mobile */}
              {isMobile && (
                <button
                  onClick={() => setActiveChatId(null)}
                  className="p-2 -ml-2 hover:bg-muted rounded-full transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              {getChatAvatar(activeChat)}
              <div>
                <h3 className="font-medium">{getChatName(activeChat)}</h3>
                <p className="text-xs text-muted-foreground">
                  {activeChat.participants?.length} participants
                </p>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => {
              const isOwn = message.senderId === user?.id;
              const isRead = message.readReceipts && message.readReceipts.length > 1;
              return (
                <div
                  key={message.id}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[70%] group/message ${isOwn ? 'order-2' : ''}`}>
                    {!isOwn && (
                      <div className="flex items-center gap-2 mb-1">
                        {message.sender?.avatarUrl ? (
                          <img
                            src={message.sender.avatarUrl}
                            alt={message.sender.name}
                            className="w-6 h-6 rounded-full"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs">
                            {(message.sender?.name || 'U')[0].toUpperCase()}
                          </div>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {message.sender?.name}
                        </span>
                      </div>
                    )}
                    <div
                      className={`rounded-lg px-4 py-2 ${
                        isOwn
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p
                        className="whitespace-pre-wrap break-words"
                        dangerouslySetInnerHTML={{ __html: linkifyText(message.content || '') }}
                      />
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {message.attachments.map((attachment) => (
                            <ChatAttachmentDisplay
                              key={attachment.id}
                              attachment={attachment}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Reaction picker and create task - shows on hover */}
                    <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : ''}`}>
                      <div className="opacity-0 group-hover/message:opacity-100 transition-opacity flex items-center gap-1">
                        <button
                          onClick={() => handleCreateTaskFromMessage(message)}
                          className="p-1 hover:bg-muted rounded transition-colors"
                          title="Create task from message"
                        >
                          <ListPlus className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                        </button>
                        <ReactionPicker
                          onSelect={(emoji) => activeChatId && toggleReaction(activeChatId, message.id, emoji)}
                          className="h-5 w-5"
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                      </span>
                      {isOwn && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          {isRead ? (
                            <CheckCheck className="w-3 h-3 text-primary" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                        </span>
                      )}
                    </div>
                    {/* Message reactions */}
                    {message.reactions && message.reactions.length > 0 && user && (
                      <ReactionDisplay
                        reactions={message.reactions}
                        currentUserId={user.id}
                        onToggle={(emoji) => activeChatId && toggleReaction(activeChatId, message.id, emoji)}
                        className={`mt-1 ${isOwn ? 'justify-end' : ''}`}
                      />
                    )}
                  </div>
                </div>
              );
            })}
            {typingUsers[activeChatId!]?.size > 0 && (
              <div className="text-sm text-muted-foreground italic">
                Someone is typing...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="p-2 md:p-4 border-t">
            <div className="flex items-center gap-1 md:gap-2 relative">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept="image/*,.heic,.heif,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 md:p-2 hover:bg-muted rounded-full transition-colors flex-shrink-0"
                title="Attach file"
              >
                <Paperclip className="w-4 h-4 md:w-5 md:h-5" />
              </button>
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => setShowGifPicker(!showGifPicker)}
                  className="p-1.5 md:p-2 hover:bg-muted rounded-full transition-colors"
                  title="Send GIF"
                >
                  <span className="text-xs md:text-sm font-bold">GIF</span>
                </button>
                {showGifPicker && (
                  <GifPicker
                    onSelect={handleGifSelect}
                    onClose={() => setShowGifPicker(false)}
                  />
                )}
              </div>
              <input
                type="text"
                placeholder="Type a message..."
                value={messageInput}
                onChange={(e) => {
                  setMessageInput(e.target.value);
                  handleTyping();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                className="flex-1 min-w-0 px-3 md:px-4 py-2 bg-muted rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-base"
              />
              <button
                onClick={handleSendMessage}
                disabled={!messageInput.trim() || isSending}
                className="p-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
                <Send className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 hidden md:flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Select a chat or start a new conversation</p>
          </div>
        </div>
      )}

      {/* New Chat Dialog */}
      {showNewChatDialog && (
        <NewChatDialog
          users={allUsers}
          onClose={() => setShowNewChatDialog(false)}
          onCreate={createNewChat}
        />
      )}

      {/* Create Task from Message Dialog */}
      <Dialog open={showCreateTaskDialog} onOpenChange={setShowCreateTaskDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListPlus className="h-5 w-5" />
              Create Task from Message
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="newTaskTitle">Task Title</Label>
              <Input
                id="newTaskTitle"
                value={createTaskTitle}
                onChange={(e) => setCreateTaskTitle(e.target.value)}
                placeholder="Enter task title..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newTaskProject">Project</Label>
              <Select value={createTaskProjectId} onValueChange={setCreateTaskProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a project..." />
                </SelectTrigger>
                <SelectContent>
                  {allProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assign To</Label>
              <div className="border rounded-md p-2 max-h-32 overflow-y-auto space-y-1">
                {allUsers.map((chatUser) => (
                  <div key={chatUser.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`create-task-assignee-${chatUser.id}`}
                      checked={createTaskAssigneeIds.includes(chatUser.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setCreateTaskAssigneeIds(prev => [...prev, chatUser.id]);
                        } else {
                          setCreateTaskAssigneeIds(prev => prev.filter(id => id !== chatUser.id));
                        }
                      }}
                    />
                    <label
                      htmlFor={`create-task-assignee-${chatUser.id}`}
                      className="flex items-center gap-2 text-sm cursor-pointer flex-1"
                    >
                      <UserAvatar name={chatUser.name} avatarUrl={chatUser.avatarUrl} size="sm" />
                      {chatUser.name}
                    </label>
                  </div>
                ))}
                {allUsers.length === 0 && (
                  <p className="text-sm text-muted-foreground">No users available</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="newTaskDescription">Description</Label>
              <Textarea
                id="newTaskDescription"
                value={createTaskContent}
                onChange={(e) => setCreateTaskContent(e.target.value)}
                rows={4}
                className="text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowCreateTaskDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateTask}
                disabled={!createTaskTitle.trim() || !createTaskProjectId || createTask.isPending}
              >
                {createTask.isPending ? 'Creating...' : 'Create Task'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NewChatDialog({
  users,
  onClose,
  onCreate,
}: {
  users: ChatUser[];
  onClose: () => void;
  onCreate: (participantIds: string[], isGroup: boolean, name?: string) => void;
}) {
  const [isGroup, setIsGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = () => {
    if (selectedUsers.length === 0) return;
    onCreate(selectedUsers, isGroup, isGroup ? groupName : undefined);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg shadow-lg w-full max-w-md mx-4">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold">New Chat</h3>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isGroup}
              onChange={(e) => setIsGroup(e.target.checked)}
              className="rounded"
            />
            <span>Create group chat</span>
          </label>

          {isGroup && (
            <input
              type="text"
              placeholder="Group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full px-4 py-2 bg-muted rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-muted rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1">
            {filteredUsers.map((u) => (
              <label
                key={u.id}
                className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                  selectedUsers.includes(u.id) ? 'bg-primary/10' : 'hover:bg-muted'
                }`}
              >
                <input
                  type={isGroup ? 'checkbox' : 'radio'}
                  name="participant"
                  checked={selectedUsers.includes(u.id)}
                  onChange={(e) => {
                    if (isGroup) {
                      setSelectedUsers((prev) =>
                        e.target.checked
                          ? [...prev, u.id]
                          : prev.filter((id) => id !== u.id)
                      );
                    } else {
                      setSelectedUsers([u.id]);
                    }
                  }}
                  className="rounded"
                />
                {u.avatarUrl ? (
                  <img
                    src={u.avatarUrl}
                    alt={u.name}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-primary font-medium text-sm">
                      {u.name[0].toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{u.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="p-4 border-t flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm hover:bg-muted rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={selectedUsers.length === 0 || (isGroup && !groupName.trim())}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Chat
          </button>
        </div>
      </div>
    </div>
  );
}
