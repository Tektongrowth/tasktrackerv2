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
