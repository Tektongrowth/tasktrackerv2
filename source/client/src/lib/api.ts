import type { NotificationPreferences, MentionNotification, TelegramStatus, TelegramLinkResponse, StripePricesResponse, WebhookUrlResponse, EmailTemplates, BugReportData, FeatureRequestData } from './types';

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.tektongrowth.com';

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: 'include',
    cache: 'no-store', // Prevent browser HTTP caching - let React Query handle caching
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return res.json();
}

// Fetch for multipart form data (file uploads)
async function fetchApiFormData<T>(endpoint: string, formData: FormData): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    body: formData,
    // Don't set Content-Type - browser will set it with boundary for multipart/form-data
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return res.json();
}

// Auth
export const auth = {
  me: () => fetchApi<{ user: import('./types').User }>('/auth/me'),
  logout: () => fetchApi<{ success: boolean }>('/auth/logout', { method: 'POST' }),
};

// Users
export const users = {
  list: () => fetchApi<import('./types').User[]>('/api/users'),
  listForChat: () => fetchApi<{ id: string; name: string; email: string; avatarUrl: string | null }[]>('/api/users/chat-list'),
  listMentionable: () => fetchApi<{ id: string; name: string; email: string; avatarUrl: string | null }[]>('/api/users/mentionable'),
  invite: (data: { email: string; name?: string; accessLevel?: import('./types').AccessLevel; projectIds?: string[]; jobRoleId?: string; permissions?: object }) =>
    fetchApi<import('./types').User>('/api/users/invite', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<import('./types').User>) =>
    fetchApi<import('./types').User>(`/api/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deactivate: (id: string) =>
    fetchApi<{ success: boolean }>(`/api/users/${id}`, { method: 'DELETE' }),
  delete: (id: string) =>
    fetchApi<{ success: boolean }>(`/api/users/${id}`, { method: 'DELETE' }),
  archive: (id: string) =>
    fetchApi<import('./types').User>(`/api/users/${id}/archive`, { method: 'POST' }),
  unarchive: (id: string) =>
    fetchApi<import('./types').User>(`/api/users/${id}/unarchive`, { method: 'POST' }),
  resendInvite: (id: string) =>
    fetchApi<{ success: boolean }>(`/api/users/${id}/resend-invite`, { method: 'POST' }),
};

// Clients
export const clients = {
  list: () => fetchApi<import('./types').Client[]>('/api/clients'),
  get: (id: string) => fetchApi<import('./types').Client>(`/api/clients/${id}`),
  create: (data: { name: string; email?: string; phone?: string; ghlLocationId?: string; gbpLocationId?: string; googleAdsCustomerId?: string }) =>
    fetchApi<import('./types').Client>('/api/clients', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: { name?: string; email?: string; phone?: string; ghlLocationId?: string; gbpLocationId?: string; googleAdsCustomerId?: string }) =>
    fetchApi<import('./types').Client>(`/api/clients/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    fetchApi<{ success: boolean }>(`/api/clients/${id}`, { method: 'DELETE' }),
  // Viewer management
  listViewers: (clientId: string) =>
    fetchApi<import('./types').ClientViewer[]>(`/api/clients/${clientId}/viewers`),
  addViewer: (clientId: string, data: { email: string; name?: string }) =>
    fetchApi<import('./types').ClientViewer>(`/api/clients/${clientId}/viewers`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  removeViewer: (clientId: string, viewerId: string) =>
    fetchApi<{ success: boolean }>(`/api/clients/${clientId}/viewers/${viewerId}`, {
      method: 'DELETE',
    }),
};

// Projects
export const projects = {
  list: () => fetchApi<import('./types').Project[]>('/api/projects'),
  get: (id: string) => fetchApi<import('./types').Project>(`/api/projects/${id}`),
  create: (data: { clientId: string; name: string; planType?: string }) =>
    fetchApi<import('./types').Project>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: { name?: string; planType?: string; subscriptionStatus?: string }) =>
    fetchApi<import('./types').Project>(`/api/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    fetchApi<{ success: boolean }>(`/api/projects/${id}`, { method: 'DELETE' }),
  upgrade: (id: string, planType: string) =>
    fetchApi<{
      success: boolean;
      previousPlanType: string | null;
      newPlanType: string;
      tasksCreated: number;
      skippedDuplicates: number;
      templateSetsProcessed: number;
    }>(`/api/projects/${id}/upgrade`, {
      method: 'POST',
      body: JSON.stringify({ planType }),
    }),
  offboard: (id: string) =>
    fetchApi<{
      success: boolean;
      previousStatus: string;
      newStatus: string;
      tasksCreated: number;
      skippedDuplicates: number;
      templateSetsProcessed: number;
    }>(`/api/projects/${id}/offboard`, {
      method: 'POST',
    }),
};

// Tasks
export const tasks = {
  list: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return fetchApi<import('./types').Task[]>(`/api/tasks${query}`);
  },
  get: (id: string) => fetchApi<import('./types').Task>(`/api/tasks/${id}`),
  create: (data: import('./types').TaskInput) =>
    fetchApi<import('./types').Task>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: import('./types').TaskInput) =>
    fetchApi<import('./types').Task>(`/api/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  updateStatus: (id: string, status: import('./types').TaskStatus) =>
    fetchApi<import('./types').Task>(`/api/tasks/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  delete: (id: string) =>
    fetchApi<{ success: boolean }>(`/api/tasks/${id}`, { method: 'DELETE' }),
  archiveCompleted: () =>
    fetchApi<{ success: boolean; count: number }>('/api/tasks/archive-completed', { method: 'POST' }),
  archive: (id: string) =>
    fetchApi<import('./types').Task>(`/api/tasks/${id}/archive`, { method: 'POST' }),
  unarchive: (id: string) =>
    fetchApi<import('./types').Task>(`/api/tasks/${id}/unarchive`, { method: 'POST' }),
  listArchived: () =>
    fetchApi<import('./types').Task[]>('/api/tasks/archived'),
  // Bulk actions
  bulkUpdateStatus: (taskIds: string[], status: import('./types').TaskStatus) =>
    fetchApi<{ success: boolean; count: number }>('/api/tasks/bulk/status', {
      method: 'POST',
      body: JSON.stringify({ taskIds, status }),
    }),
  bulkUpdateAssignees: (taskIds: string[], assigneeIds: string[]) =>
    fetchApi<{ success: boolean; count: number }>('/api/tasks/bulk/assignees', {
      method: 'POST',
      body: JSON.stringify({ taskIds, assigneeIds }),
    }),
  bulkDelete: (taskIds: string[]) =>
    fetchApi<{ success: boolean; count: number }>('/api/tasks/bulk/delete', {
      method: 'POST',
      body: JSON.stringify({ taskIds }),
    }),
  bulkArchive: (taskIds: string[]) =>
    fetchApi<{ success: boolean; count: number }>('/api/tasks/bulk/archive', {
      method: 'POST',
      body: JSON.stringify({ taskIds }),
    }),
};

// Task Watchers
export const watchers = {
  list: (taskId: string) =>
    fetchApi<import('./types').TaskWatcher[]>(`/api/tasks/${taskId}/watchers`),
  add: (taskId: string, userId?: string) =>
    fetchApi<import('./types').TaskWatcher>(`/api/tasks/${taskId}/watchers`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),
  remove: (taskId: string, userId: string) =>
    fetchApi<{ success: boolean }>(`/api/tasks/${taskId}/watchers/${userId}`, {
      method: 'DELETE',
    }),
  toggleMute: (taskId: string, muted: boolean) =>
    fetchApi<import('./types').TaskWatcher>(`/api/tasks/${taskId}/watchers/mute`, {
      method: 'PATCH',
      body: JSON.stringify({ muted }),
    }),
};

// Subtasks
export const subtasks = {
  list: (taskId: string) =>
    fetchApi<import('./types').Subtask[]>(`/api/tasks/${taskId}/subtasks`),
  create: (taskId: string, data: { title: string }) =>
    fetchApi<import('./types').Subtask>(`/api/tasks/${taskId}/subtasks`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (taskId: string, subtaskId: string, data: { title?: string; completed?: boolean; sortOrder?: number }) =>
    fetchApi<import('./types').Subtask>(`/api/tasks/${taskId}/subtasks/${subtaskId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (taskId: string, subtaskId: string) =>
    fetchApi<{ success: boolean }>(`/api/tasks/${taskId}/subtasks/${subtaskId}`, { method: 'DELETE' }),
};

// Comments
export const comments = {
  list: (taskId: string) =>
    fetchApi<import('./types').TaskComment[]>(`/api/tasks/${taskId}/comments`),
  create: (taskId: string, data: { content: string }) =>
    fetchApi<import('./types').TaskComment>(`/api/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  createWithAttachment: (taskId: string, content: string, files: File[]) => {
    const formData = new FormData();
    formData.append('content', content);
    for (const file of files) {
      formData.append('files', file);
    }
    return fetchApiFormData<import('./types').TaskComment>(`/api/tasks/${taskId}/comments-with-attachment`, formData);
  },
  update: (taskId: string, commentId: string, data: { content: string }) =>
    fetchApi<import('./types').TaskComment>(`/api/tasks/${taskId}/comments/${commentId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (taskId: string, commentId: string) =>
    fetchApi<{ success: boolean }>(`/api/tasks/${taskId}/comments/${commentId}`, { method: 'DELETE' }),
  toggleReaction: (taskId: string, commentId: string, emoji: import('./types').EmojiKey) =>
    fetchApi<{ reactions: import('./types').Reaction[] }>(`/api/tasks/${taskId}/comments/${commentId}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    }),
  getAttachmentUrl: (taskId: string, commentId: string, attachmentId: string) =>
    `${API_BASE}/api/tasks/${taskId}/comments/${commentId}/attachments/${attachmentId}`,
  getAttachmentSignedUrl: (taskId: string, commentId: string, attachmentId: string) =>
    fetchApi<{ url: string }>(`/api/tasks/${taskId}/comments/${commentId}/attachments/${attachmentId}/url`),
};

// Templates
export const templates = {
  list: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return fetchApi<import('./types').TaskTemplate[]>(`/api/templates${query}`);
  },
  create: (data: Partial<import('./types').TaskTemplate>) =>
    fetchApi<import('./types').TaskTemplate>('/api/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<import('./types').TaskTemplate>) =>
    fetchApi<import('./types').TaskTemplate>(`/api/templates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    fetchApi<{ success: boolean }>(`/api/templates/${id}`, { method: 'DELETE' }),
};

// Template Sets
export const templateSets = {
  list: () => fetchApi<import('./types').TemplateSet[]>('/api/template-sets'),
  get: (id: string) => fetchApi<import('./types').TemplateSet>(`/api/template-sets/${id}`),
  create: (data: {
    name: string;
    description?: string;
    triggerType?: import('./types').TriggerType;
    triggerRules?: Record<string, unknown>;
    planTypes?: import('./types').PlanType[];
  }) =>
    fetchApi<import('./types').TemplateSet>('/api/template-sets', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<import('./types').TemplateSet>) =>
    fetchApi<import('./types').TemplateSet>(`/api/template-sets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    fetchApi<{ success: boolean }>(`/api/template-sets/${id}`, { method: 'DELETE' }),
  trigger: (id: string, projectId: string) =>
    fetchApi<{ success: boolean; tasksCreated: number }>(`/api/template-sets/${id}/trigger`, {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    }),
};

// Time Entries
export const timeEntries = {
  list: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return fetchApi<import('./types').TimeEntry[]>(`/api/time-entries${query}`);
  },
  create: (data: {
    title: string;
    description?: string;
    durationMinutes: number;
    taskId?: string;
    projectId?: string;
    date?: string;
  }) =>
    fetchApi<import('./types').TimeEntry>('/api/time-entries', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  startTimer: (data: { title?: string; taskId?: string; projectId?: string }) =>
    fetchApi<import('./types').TimeEntry>('/api/time-entries/start', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getRunning: () =>
    fetchApi<import('./types').TimeEntry | null>('/api/time-entries/running'),
  stopTimer: (id: string, data?: { title?: string; taskId?: string; projectId?: string }) =>
    fetchApi<import('./types').TimeEntry>(`/api/time-entries/${id}/stop`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),
  update: (id: string, data: Partial<import('./types').TimeEntry>) =>
    fetchApi<import('./types').TimeEntry>(`/api/time-entries/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    fetchApi<{ success: boolean }>(`/api/time-entries/${id}`, { method: 'DELETE' }),
};

// Dashboard
export const dashboard = {
  stats: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return fetchApi<import('./types').DashboardStats>(`/api/dashboard/stats${query}`);
  },
  upcoming: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return fetchApi<import('./types').Task[]>(`/api/dashboard/upcoming${query}`);
  },
  completed: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return fetchApi<import('./types').Task[]>(`/api/dashboard/completed${query}`);
  },
  timeSummary: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return fetchApi<import('./types').TimeSummary>(`/api/dashboard/time-summary${query}`);
  },
  incomplete: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return fetchApi<import('./types').IncompleteTasks>(`/api/dashboard/incomplete${query}`);
  },
  recentActivity: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return fetchApi<import('./types').RecentActivity[]>(`/api/dashboard/recent-activity${query}`);
  },
  leaderboard: () => fetchApi<{
    month: string;
    leaderboard: {
      rank: number;
      id: string;
      name: string;
      email: string;
      avatarUrl: string | null;
      points: number;
      tasksCompleted: number;
      onTimeRate: number;
      completionRate: number;
      streak: number;
      hoursTracked: number;
      badges: { emoji: string; label: string; description: string }[];
    }[];
  }>('/api/dashboard/leaderboard'),
};

// Tags
export const tags = {
  list: () => fetchApi<import('./types').Tag[]>('/api/tags'),
  create: (data: { name: string; color: string }) =>
    fetchApi<import('./types').Tag>('/api/tags', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: { name?: string; color?: string }) =>
    fetchApi<import('./types').Tag>(`/api/tags/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    fetchApi<{ success: boolean }>(`/api/tags/${id}`, { method: 'DELETE' }),
};

// Roles (Job Roles for contractors)
export const roles = {
  list: () => fetchApi<import('./types').Role[]>('/api/roles'),
  create: (data: { name: string; color: string; description?: string }) =>
    fetchApi<import('./types').Role>('/api/roles', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: { name?: string; color?: string; description?: string }) =>
    fetchApi<import('./types').Role>(`/api/roles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    fetchApi<{ success: boolean }>(`/api/roles/${id}`, { method: 'DELETE' }),
};

// Project Access (Permissions)
export const projectAccess = {
  list: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return fetchApi<import('./types').ProjectAccess[]>(`/api/project-access${query}`);
  },
  getForUser: (userId: string) =>
    fetchApi<import('./types').ProjectAccess[]>(`/api/project-access/user/${userId}`),
  getForProject: (projectId: string) =>
    fetchApi<import('./types').ProjectAccess[]>(`/api/project-access/project/${projectId}`),
  create: (data: { userId: string; projectId: string; canView?: boolean; canEdit?: boolean; canDelete?: boolean }) =>
    fetchApi<import('./types').ProjectAccess>('/api/project-access', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateUserAccess: (userId: string, projectAccess: Array<{ projectId: string; canView?: boolean; canEdit?: boolean; canDelete?: boolean }>) =>
    fetchApi<import('./types').ProjectAccess[]>(`/api/project-access/user/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ projectAccess }),
    }),
  delete: (id: string) =>
    fetchApi<{ success: boolean }>(`/api/project-access/${id}`, { method: 'DELETE' }),
  deleteUserProject: (userId: string, projectId: string) =>
    fetchApi<{ success: boolean }>(`/api/project-access/user/${userId}/project/${projectId}`, { method: 'DELETE' }),
};

// Client Portal
export const clientPortal = {
  requestAccess: (email: string) =>
    fetchApi<{ success: boolean; message: string }>('/api/client-portal/request-access', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  verify: (token: string) =>
    fetchApi<{ success: boolean; client: { id: string; name: string } }>(`/api/client-portal/verify/${token}`),
  me: () =>
    fetchApi<{ client: { id: string; name: string; email?: string } }>('/api/client-portal/me'),
  logout: () =>
    fetchApi<{ success: boolean }>('/api/client-portal/logout', { method: 'POST' }),
  dashboard: () =>
    fetchApi<import('./types').ClientDashboard>('/api/client-portal/dashboard'),
  addViewer: (data: { email: string; name?: string }) =>
    fetchApi<import('./types').ClientViewer>('/api/client-portal/viewers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  removeViewer: (id: string) =>
    fetchApi<{ success: boolean }>(`/api/client-portal/viewers/${id}`, { method: 'DELETE' }),
  // Task submissions
  submitTask: (data: { title: string; description?: string; projectId?: string; priority?: string }) =>
    fetchApi<import('./types').TaskSubmission>('/api/client-portal/submissions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  listSubmissions: () =>
    fetchApi<import('./types').TaskSubmission[]>('/api/client-portal/submissions'),
};

// Search
export const search = {
  query: (q: string, limit = 10) =>
    fetchApi<import('./types').SearchResults>(`/api/search?q=${encodeURIComponent(q)}&limit=${limit}`),
};

// Task Submissions (Admin)
export const taskSubmissions = {
  list: (status?: string) => {
    const query = status ? `?status=${status}` : '';
    return fetchApi<import('./types').TaskSubmission[]>(`/api/task-submissions${query}`);
  },
  approve: (id: string, data: { projectId?: string; assigneeIds?: string[]; dueDate?: string }) =>
    fetchApi<{ success: boolean; task: import('./types').Task }>(`/api/task-submissions/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  reject: (id: string, reason?: string) =>
    fetchApi<{ success: boolean }>(`/api/task-submissions/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
};

// Audit Logs
export const auditLogs = {
  list: (params?: { page?: number; action?: string; entityType?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.action && params.action !== 'all') searchParams.set('action', params.action);
    if (params?.entityType && params.entityType !== 'all') searchParams.set('entityType', params.entityType);
    const query = searchParams.toString() ? '?' + searchParams.toString() : '';
    return fetchApi<{ logs: import('./types').AuditLog[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(`/api/audit-logs${query}`);
  },
  getActions: () => fetchApi<string[]>('/api/audit-logs/actions'),
  getEntityTypes: () => fetchApi<string[]>('/api/audit-logs/entity-types'),
};

// Backups
export const backups = {
  list: () => fetchApi<import('./types').DatabaseBackup[]>('/api/backups'),
  trigger: () => fetchApi<{ success: boolean; backup: import('./types').DatabaseBackup }>('/api/backups/trigger', { method: 'POST' }),
  delete: (id: string) => fetchApi<{ success: boolean }>(`/api/backups/${id}`, { method: 'DELETE' }),
  getStats: () => fetchApi<{ totalBackups: number; totalSizeBytes: number; lastBackupAt: string | null }>('/api/backups/stats'),
};

// Guide / Walkthrough
export const guide = {
  getState: () =>
    fetchApi<{ hasSeenWelcome: boolean; role: 'admin' | 'contractor'; completedGuides: string[] }>('/api/guide/state'),
  markWelcomeSeen: () =>
    fetchApi<{ success: boolean }>('/api/guide/welcome-seen', { method: 'POST' }),
  markComplete: (guideId: string) =>
    fetchApi<{ success: boolean }>(`/api/guide/complete/${guideId}`, { method: 'POST' }),
  reset: () =>
    fetchApi<{ success: boolean }>('/api/guide/reset', { method: 'POST' }),
};

export type { ChannelPrefs, NotificationPreferences, MentionNotification } from './types';

export const notifications = {
  getPreferences: () =>
    fetchApi<NotificationPreferences>('/api/users/me/notifications'),
  updatePreferences: (preferences: Partial<NotificationPreferences>) =>
    fetchApi<NotificationPreferences>('/api/users/me/notifications', {
      method: 'PATCH',
      body: JSON.stringify({ preferences }),
    }),
  getMentions: () => fetchApi<MentionNotification[]>('/api/notifications/mentions'),
  getUnreadMentionCount: () => fetchApi<{ unreadCount: number }>('/api/notifications/mentions/unread-count'),
  markMentionsAsRead: (mentionIds: string[]) =>
    fetchApi<{ success: boolean }>('/api/notifications/mentions/read', {
      method: 'POST',
      body: JSON.stringify({ mentionIds }),
    }),
  markAllMentionsAsRead: () =>
    fetchApi<{ success: boolean }>('/api/notifications/mentions/read-all', { method: 'POST' }),
};

export type { TelegramStatus, TelegramLinkResponse } from './types';

export const telegram = {
  getStatus: () => fetchApi<TelegramStatus>('/api/telegram/status'),
  getLink: () => fetchApi<TelegramLinkResponse>('/api/telegram/link'),
  disconnect: () => fetchApi<{ success: boolean }>('/api/telegram/link', { method: 'DELETE' }),
};

export type { StripePriceMapping, StripePricesResponse, WebhookUrlResponse } from './types';

export const settings = {
  getStripePrices: () => fetchApi<StripePricesResponse>('/api/settings/stripe-prices'),
  getWebhookUrl: () => fetchApi<WebhookUrlResponse>('/api/settings/webhook-url'),
  testStripeConnection: () => fetchApi<{ success: boolean; message: string }>('/api/settings/test-stripe', { method: 'POST' }),
};

export type { WelcomeEmailTemplate, EmailTemplates } from './types';

export const emailTemplates = {
  get: () => fetchApi<EmailTemplates>('/api/app-settings/email-templates'),
  update: (templates: Partial<EmailTemplates>) =>
    fetchApi<EmailTemplates>('/api/app-settings/email-templates', {
      method: 'PATCH',
      body: JSON.stringify({ templates }),
    }),
  reset: () =>
    fetchApi<EmailTemplates>('/api/app-settings/email-templates/reset', { method: 'POST' }),
};

// Chats
export const chats = {
  list: () => fetchApi<import('./types').Chat[]>('/api/chats'),
  getUnreadCount: () => fetchApi<{ unreadCount: number }>('/api/chats/unread-count'),
  get: (id: string) => fetchApi<import('./types').Chat>(`/api/chats/${id}`),
  create: (data: { name?: string; participantIds: string[]; isGroup?: boolean }) =>
    fetchApi<import('./types').Chat>('/api/chats', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getMessages: (chatId: string, cursor?: string, limit = 50) => {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (cursor) params.set('cursor', cursor);
    return fetchApi<{ messages: import('./types').ChatMessage[]; hasMore: boolean; nextCursor: string | null }>(
      `/api/chats/${chatId}/messages?${params.toString()}`
    );
  },
  sendMessage: (chatId: string, content: string) =>
    fetchApi<import('./types').ChatMessage>(`/api/chats/${chatId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
  markAsRead: (chatId: string) =>
    fetchApi<{ success: boolean; messagesRead: number }>(`/api/chats/${chatId}/read`, { method: 'POST' }),
  addParticipant: (chatId: string, userId: string) =>
    fetchApi<import('./types').ChatParticipant>(`/api/chats/${chatId}/participants`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),
  removeParticipant: (chatId: string, userId: string) =>
    fetchApi<{ success: boolean }>(`/api/chats/${chatId}/participants/${userId}`, { method: 'DELETE' }),
  uploadAttachment: (chatId: string, files: File[], messageContent?: string) => {
    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }
    if (messageContent) formData.append('messageContent', messageContent);
    return fetchApiFormData<import('./types').ChatMessage>(`/api/chats/${chatId}/attachments`, formData);
  },
  getAttachmentUrl: (storageKey: string) => `${API_BASE}/api/chats/attachments/${storageKey}`,
  getAttachmentSignedUrl: (storageKey: string) =>
    fetchApi<{ url: string }>('/api/chats/attachments/signed-url', {
      method: 'POST',
      body: JSON.stringify({ storageKey }),
    }),
  toggleReaction: (chatId: string, messageId: string, emoji: import('./types').EmojiKey) =>
    fetchApi<{ reactions: import('./types').Reaction[] }>(`/api/chats/${chatId}/messages/${messageId}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    }),
};

export type { BugReportData, FeatureRequestData } from './types';

export const support = {
  submitBugReport: (data: BugReportData) =>
    fetchApi<{ success: boolean; message: string }>('/api/support/bug-report', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  submitFeatureRequest: (data: FeatureRequestData) =>
    fetchApi<{ success: boolean; message: string }>('/api/support/feature-request', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// GIF API types
interface GifResult {
  id: string;
  title: string;
  images: {
    fixed_height: { url: string; width: string; height: string };
    fixed_height_small: { url: string; width: string; height: string };
    original: { url: string };
  };
}

interface GifResponse {
  data: GifResult[];
  pagination: { total_count: number; count: number; offset: number };
}

export const gifs = {
  trending: (limit = 20) =>
    fetchApi<GifResponse>(`/api/gifs/trending?limit=${limit}`),
  search: (query: string, limit = 20) =>
    fetchApi<GifResponse>(`/api/gifs/search?q=${encodeURIComponent(query)}&limit=${limit}`),
};

// SEO Intelligence
export const seo = {
  listDigests: (page = 1, limit = 10) =>
    fetchApi<{ digests: import('./types').SeoDigest[]; total: number }>(`/api/seo/digests?page=${page}&limit=${limit}`),
  getDigest: (id: string) =>
    fetchApi<import('./types').SeoDigest>(`/api/seo/digests/${id}`),
  runPipeline: () =>
    fetchApi<{ message: string; status: string }>('/api/seo/digests/run', { method: 'POST' }),
  retryDigest: (id: string) =>
    fetchApi<import('./types').SeoDigest>(`/api/seo/digests/${id}/retry`, { method: 'POST' }),
  getTaskDrafts: (digestId: string) =>
    fetchApi<import('./types').SeoTaskDraft[]>(`/api/seo/digests/${digestId}/task-drafts`),
  approveTaskDraft: (id: string, data: { projectId: string; assigneeIds?: string[]; dueDate?: string }) =>
    fetchApi<{ task: import('./types').Task; draft: import('./types').SeoTaskDraft }>(`/api/seo/task-drafts/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  rejectTaskDraft: (id: string) =>
    fetchApi<import('./types').SeoTaskDraft>(`/api/seo/task-drafts/${id}/reject`, { method: 'POST' }),
  bulkApproveTaskDrafts: (ids: string[], data: { projectId: string }) =>
    fetchApi<{ approved: import('./types').Task[] }>('/api/seo/task-drafts/bulk-approve', {
      method: 'POST',
      body: JSON.stringify({ ids, ...data }),
    }),
  getSopDrafts: (digestId: string) =>
    fetchApi<import('./types').SeoSopDraft[]>(`/api/seo/digests/${digestId}/sop-drafts`),
  applySopDraft: (id: string) =>
    fetchApi<import('./types').SeoSopDraft>(`/api/seo/sop-drafts/${id}/apply`, { method: 'POST' }),
  dismissSopDraft: (id: string) =>
    fetchApi<import('./types').SeoSopDraft>(`/api/seo/sop-drafts/${id}/dismiss`, { method: 'POST' }),
  getSettings: () =>
    fetchApi<import('./types').SeoSettings>('/api/seo/settings'),
  updateSettings: (data: Partial<import('./types').SeoSettings>) =>
    fetchApi<import('./types').SeoSettings>('/api/seo/settings', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  listSources: () =>
    fetchApi<import('./types').SeoSource[]>('/api/seo/sources'),
  createSource: (data: Partial<import('./types').SeoSource>) =>
    fetchApi<import('./types').SeoSource>('/api/seo/sources', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateSource: (id: string, data: Partial<import('./types').SeoSource>) =>
    fetchApi<import('./types').SeoSource>(`/api/seo/sources/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteSource: (id: string) =>
    fetchApi<void>(`/api/seo/sources/${id}`, { method: 'DELETE' }),
  getJobHistory: (limit = 20) =>
    fetchApi<import('./types').ScheduledJobRun[]>(`/api/seo/job-history?limit=${limit}`),
  testSource: (id: string) =>
    fetchApi<{ source: string; method: string; articlesFound: number; articles: { title: string; url: string; contentPreview: string; publishedAt?: string }[] }>(`/api/seo/sources/${id}/test`, { method: 'POST' }),
  seedSources: () =>
    fetchApi<{ message: string; totalSources: number }>('/api/seo/sources/seed', { method: 'POST' }),
};

export { API_BASE, fetchApi };
