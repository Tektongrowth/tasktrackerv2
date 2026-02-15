export type AccessLevel = 'viewer' | 'editor' | 'project_manager' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  role: 'admin' | 'contractor';
  accessLevel: AccessLevel;
  permissions: Permissions;
  active: boolean;
  archived: boolean;
  archivedAt?: string | null;
  googleId?: string;
  inviteToken?: string | null;
  jobRoleId?: string | null;
  jobRole?: Role;
  createdAt: string;
  updatedAt: string;
}

export interface Permissions {
  viewOwnTasksOnly?: boolean;
  viewAllTasks?: boolean;
  editOwnTasks?: boolean;
  editAllTasks?: boolean;
  viewOwnTimeEntries?: boolean;
  viewAllTimeEntries?: boolean;
  manageTemplates?: boolean;
}

export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  stripeCustomerId?: string;
  gbpLocationId?: string;
  googleAdsCustomerId?: string;
  contactName?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  websiteUrl?: string;
  serviceArea?: string;
  primaryServices?: string[];
  projects?: Project[];
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  clientId: string;
  name: string;
  planType?: PlanType;
  stripeSubscriptionId?: string;
  subscriptionStatus: 'active' | 'canceled' | 'past_due';
  billingDate?: string;
  driveFolderUrl?: string;
  cosmoSheetUrl?: string;
  client?: Client;
  tasks?: Task[];
  createdAt: string;
  updatedAt: string;
}

export type PlanType = 'package_one' | 'package_two' | 'package_three' | 'package_four' | 'facebook_ads_addon' | 'custom_website_addon';

export interface TaskAssignee {
  id: string;
  taskId: string;
  userId: string;
  assignedAt: string;
  user?: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'>;
}

export interface Task {
  id: string;
  projectId: string;
  templateId?: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  tags: string[];
  roleId?: string | null;
  sopUrl?: string;
  sortOrder?: number;
  assignedRole?: Role;
  completedAt?: string;
  project?: Project;
  assignees?: TaskAssignee[];
  template?: TaskTemplate;
  timeEntries?: TimeEntry[];
  activities?: TaskActivity[];
  subtasks?: Subtask[];
  comments?: TaskComment[];
  isOverdue?: boolean;
  _count?: { timeEntries: number };
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus = 'todo' | 'in_review' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

// Input types for creating/updating tasks
export interface TaskInput {
  title?: string;
  description?: string;
  projectId?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
  tags?: string[];
  roleId?: string | null;
  assigneeIds?: string[];
}

export type TriggerType = 'manual' | 'new_project' | 'subscription_change' | 'schedule' | 'offboard';

export interface TemplateSet {
  id: string;
  name: string;
  description?: string;
  triggerType: TriggerType;
  triggerRules: Record<string, unknown>;
  planTypes: PlanType[];
  active: boolean;
  isSystem: boolean;
  strategyDocUrl?: string;
  templates?: TaskTemplate[];
  _count?: { templates: number };
  createdAt: string;
  updatedAt: string;
}

export interface TemplateSubtask {
  id: string;
  templateId: string;
  title: string;
  sopUrl?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskTemplate {
  id: string;
  title: string;
  description?: string;
  templateType: 'onboarding' | 'recurring' | 'custom';
  templateSetId?: string;
  templateSet?: TemplateSet;
  planTypes: PlanType[];
  defaultAssigneeEmails?: string[];
  defaultRoleId?: string | null;
  defaultRole?: Role;
  dueInDays: number;
  tags: string[];
  sopUrl?: string;
  sortOrder: number;
  subtasks?: TemplateSubtask[];
  createdAt: string;
  updatedAt: string;
}

export interface TimeEntry {
  id: string;
  userId: string;
  taskId?: string;
  projectId?: string;
  title: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  isManual: boolean;
  isRunning: boolean;
  user?: Pick<User, 'id' | 'name' | 'email'>;
  task?: Pick<Task, 'id' | 'title'>;
  project?: Project;
  createdAt: string;
  updatedAt: string;
}

export interface TaskActivity {
  id: string;
  taskId: string;
  userId?: string;
  user?: { id: string; name: string };
  action: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  sopUrl?: string;
  completed: boolean;
  completedAt?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CommentAttachment {
  id: string;
  commentId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  storageKey: string;
  createdAt: string;
}

export type EmojiKey = 'thumbsup' | 'thumbsdown' | 'heart' | 'laugh' | 'surprised' | 'sad' | 'party';

export interface Reaction {
  id: string;
  emoji: EmojiKey;
  userId: string;
  user?: Pick<User, 'id' | 'name'>;
  createdAt: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId?: string;
  userName: string;
  content: string;
  user?: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'>;
  attachments?: CommentAttachment[];
  reactions?: Reaction[];
  createdAt: string;
  updatedAt: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface Role {
  id: string;
  name: string;
  color: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  tasks: {
    todo: number;
    inReview: number;
    completed: number;
    overdue: number;
  };
  clients: number;
  activeProjects: number;
}

export interface TimeSummary {
  totalMinutes: number;
  totalHours: string;
  byContractor: Array<{
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
    totalMinutes: number;
    totalHours: string;
  }>;
  byProject: Array<{
    id: string;
    projectName: string;
    clientName: string;
    totalMinutes: number;
    totalHours: string;
  }>;
}

export interface ClientViewer {
  id: string;
  email: string;
  name?: string;
  addedAt: string;
}

export interface ClientDashboard {
  client: {
    id: string;
    name: string;
    email?: string;
  };
  projects: Array<{
    id: string;
    name: string;
    planType?: PlanType;
    subscriptionStatus: 'active' | 'canceled' | 'past_due';
    tasks: Array<{
      id: string;
      title: string;
      description?: string;
      status: TaskStatus;
      dueDate?: string;
      tags: string[];
      completedAt?: string;
      createdAt: string;
    }>;
  }>;
  viewers: ClientViewer[];
  stats: {
    totalTasks: number;
    completedTasks: number;
    inReviewTasks: number;
    todoTasks: number;
    upcomingDue: number;
  };
}

export interface IncompleteTasks {
  unassigned: Task[];
  noDueDate: Task[];
  counts: {
    unassigned: number;
    noDueDate: number;
    total: number;
  };
}

export interface ProjectAccess {
  id: string;
  userId: string;
  projectId: string;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  user?: Pick<User, 'id' | 'name' | 'email' | 'role'>;
  project?: {
    id: string;
    name: string;
    client?: { id: string; name: string };
  };
  createdAt: string;
  updatedAt: string;
}

export interface RecentActivity {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  user?: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'>;
  task?: {
    id: string;
    title: string;
    projectId: string;
    project?: {
      id: string;
      name: string;
      client?: { id: string; name: string };
    };
  };
  createdAt: string;
  updatedAt: string;
}

export interface TaskSubmission {
  id: string;
  clientId: string;
  projectId?: string;
  title: string;
  description?: string;
  priority?: string;
  submittedBy: string;
  status: 'pending' | 'approved' | 'rejected';
  taskId?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  client?: Client;
  project?: Project;
  task?: Task;
  createdAt: string;
}

export interface SearchResults {
  tasks: Task[];
  projects: Project[];
  clients: Client[];
}

export interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  entityType: string;
  entityIds: string[];
  details?: Record<string, unknown>;
  ipAddress?: string;
  user?: Pick<User, 'id' | 'name' | 'email'>;
  createdAt: string;
}

export interface DatabaseBackup {
  id: string;
  filename: string;
  sizeBytes: number;
  path: string;
  createdAt: string;
  expiresAt: string;
}

export interface ScheduledJobRun {
  id: string;
  jobName: string;
  status: 'started' | 'completed' | 'failed';
  details?: Record<string, unknown>;
  startedAt: string;
  completedAt?: string;
}

// Chat Types
export interface ChatParticipant {
  id: string;
  chatId: string;
  userId: string;
  joinedAt: string;
  lastReadAt?: string;
  user?: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'>;
}

export interface ChatAttachment {
  id: string;
  messageId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  storageKey: string;
  createdAt: string;
}

export interface ChatReadReceipt {
  userId: string;
  readAt: string;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  createdAt: string;
  sender?: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'>;
  attachments?: ChatAttachment[];
  readReceipts?: ChatReadReceipt[];
  reactions?: Reaction[];
  tempId?: string; // For optimistic updates
}

export interface Chat {
  id: string;
  name?: string;
  isGroup: boolean;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
  creator?: Pick<User, 'id' | 'name' | 'email'>;
  participants?: ChatParticipant[];
  messages?: ChatMessage[];
  unreadCount?: number;
}

export interface TaskWatcher {
  id: string;
  taskId: string;
  userId: string;
  muted: boolean;
  createdAt: string;
  user?: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'>;
}

// Notification Channel Preferences (for core notification types)
export interface ChannelPrefs {
  email: boolean;
  push: boolean;
  telegram: boolean;
}

// Notification Preferences
export interface NotificationPreferences {
  // Legacy notification types (email-only, boolean)
  projectAssignment: boolean;
  taskMovedToReview: boolean;
  taskCompleted: boolean;
  taskOverdue: boolean;
  taskDueSoon: boolean;
  dailyDigest: boolean;
  weeklyDigest: boolean;
  // Core notification types with per-channel preferences
  taskAssignment: ChannelPrefs;
  mentions: ChannelPrefs;
  chatMessages: ChannelPrefs;
  taskUpdates: ChannelPrefs;
}

export interface MentionNotification {
  id: string;
  readAt: string | null;
  createdAt: string;
  commentId: string;
  commentContent: string;
  mentionedBy: { id: string; name: string; avatarUrl: string | null };
  task: {
    id: string;
    title: string;
    project: {
      id: string;
      name: string;
      client: { id: string; name: string } | null;
    } | null;
  };
}

// Telegram integration
export interface TelegramStatus {
  configured: boolean;
  connected: boolean;
  linkedAt?: string;
  botUsername?: string;
}

export interface TelegramLinkResponse {
  connected: boolean;
  url?: string;
  linkedAt?: string;
  botUsername?: string;
}

// Settings (admin only)
export interface StripePriceMapping {
  envVar: string;
  planType: string;
  label: string;
  priceId: string | null;
  isConfigured: boolean;
}

export interface StripePricesResponse {
  prices: StripePriceMapping[];
  summary: {
    total: number;
    configured: number;
    missing: number;
  };
}

export interface WebhookUrlResponse {
  url: string;
  events: string[];
}

// Email Templates (admin only)
export interface WelcomeEmailTemplate {
  subject: string;
  heading: string;
  body: string;
  buttonText: string;
  footer: string;
}

export interface EmailTemplates {
  welcome: WelcomeEmailTemplate;
}

// Support
export interface BugReportData {
  action: string;
  actual: string;
  errorMessage?: string;
  steps: string;
  browser: string;
  device: string;
  urgency: 'blocking' | 'annoying' | 'minor';
  screenshotUrl?: string;
}

export interface FeatureRequestData {
  title: string;
  description: string;
  useCase: string;
  priority: 'nice_to_have' | 'would_help' | 'important';
}

// SEO Intelligence Types
export type SourceTier = 'tier_1' | 'tier_2' | 'tier_3';
export type SeoDigestStatus = 'pending' | 'fetching' | 'analyzing' | 'generating' | 'delivering' | 'completed' | 'failed';
export type SeoRecommendationStatus = 'draft' | 'approved' | 'rejected' | 'actioned';
export type SeoTaskDraftStatus = 'pending' | 'approved' | 'rejected';

export interface SeoSettings {
  id: string;
  enabled: boolean;
  runDayOfMonth: number;
  telegramChatId?: string;
  driveFolderId?: string;
  sopFolderId?: string;
  tokenBudget: number;
  createdAt: string;
  updatedAt: string;
}

export interface SeoSource {
  id: string;
  name: string;
  url: string;
  tier: SourceTier;
  category: string;
  fetchMethod: string;
  fetchConfig: Record<string, unknown>;
  active: boolean;
  lastFetchedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SeoDigest {
  id: string;
  period: string;
  status: SeoDigestStatus;
  sourcesFetched: number;
  recommendationsGenerated: number;
  taskDraftsCreated: number;
  sopDraftsCreated: number;
  googleDocUrl?: string;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  recommendations?: SeoRecommendation[];
}

export interface SeoRecommendation {
  id: string;
  digestId: string;
  category: string;
  title: string;
  summary: string;
  details: string;
  impact: string;
  confidence: string;
  status: SeoRecommendationStatus;
  sourceCount: number;
  createdAt: string;
  citations?: SeoRecommendationCitation[];
  taskDrafts?: SeoTaskDraft[];
}

export interface SeoRecommendationCitation {
  id: string;
  recommendationId: string;
  fetchResultId: string;
  sourceUrl: string;
  sourceName: string;
  excerpt: string;
  createdAt: string;
}

export interface SeoTaskDraft {
  id: string;
  digestId: string;
  recommendationId?: string;
  title: string;
  description: string;
  suggestedProjectId?: string;
  suggestedPriority: string;
  suggestedDueInDays: number;
  status: SeoTaskDraftStatus;
  taskId?: string;
  reviewedAt?: string;
  createdAt: string;
  recommendation?: SeoRecommendation;
}

export interface SeoSopDraft {
  id: string;
  digestId: string;
  recommendationId?: string;
  templateSetId?: string;
  draftType: 'update' | 'new';
  sopDocId: string;
  sopTitle: string;
  description: string;
  beforeContent: string;
  afterContent: string;
  status: string;
  appliedAt?: string;
  createdAt: string;
  recommendation?: SeoRecommendation;
  templateSet?: {
    id: string;
    name: string;
    description?: string;
    templates?: { id: string; title: string; sortOrder: number }[];
  };
}

export interface SeoClientInsight {
  id: string;
  digestId: string;
  clientId: string;
  dataSource: string;
  metrics: Record<string, unknown>;
  period: string;
  createdAt: string;
}
