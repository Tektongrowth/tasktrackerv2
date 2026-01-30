import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboard, users } from '@/lib/api';
import { Task } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import { useFilters } from '@/hooks/useFilters';
import { useTheme } from '@/hooks/useTheme';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { UserAvatar } from '@/components/UserAvatar';
import { PageHeader } from '@/components/PageHeader';
import { TaskDetailPanel } from '@/components/TaskDetailPanel';
import {
  CheckCircle2,
  AlertCircle,
  Calendar,
  Users,
  ArrowRight,
  UserX,
  CalendarX,
  MessageSquare,
} from 'lucide-react';
import { formatDate, getTagColor, isOverdue, sanitizeText } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { darkenColor } from '@/lib/theme';

function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return formatDate(dateString);
}

// Dark header card component for consistent styling
function DashboardCard({
  title,
  badge,
  children,
  onClick,
  'data-guide': dataGuide,
}: {
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  'data-guide'?: string;
}) {
  return (
    <div className="rounded-lg overflow-hidden shadow-sm border border-slate-200 bg-white" data-guide={dataGuide}>
      <div className="bg-[var(--theme-primary-dark)] px-4 py-3 flex items-center justify-between">
        <h3 className="font-semibold text-white">{title}</h3>
        {badge}
      </div>
      <div className={cn("bg-white p-4", onClick && "cursor-pointer")} onClick={onClick}>
        {children}
      </div>
    </div>
  );
}

// Donut Chart Component - Larger with prominent display
function DonutChart({
  todo,
  inReview,
  completed,
  overdue,
  total: totalCount,
  colors,
}: {
  todo: number;
  inReview: number;
  completed: number;
  overdue: number;
  total: number;
  colors: { todo: string; inReview: string; completed: string; overdue: string; background: string };
}) {
  const total = todo + inReview + completed + overdue;
  if (total === 0) {
    return (
      <div className="flex flex-col items-center">
        <div className="relative w-32 h-32">
          <svg className="w-full h-full" viewBox="0 0 36 36">
            <circle
              cx="18" cy="18" r="14"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="5"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-slate-400">0</span>
          </div>
        </div>
      </div>
    );
  }

  const completedPercent = (completed / total) * 100;
  const inReviewPercent = (inReview / total) * 100;
  const todoPercent = (todo / total) * 100;
  const overduePercent = (overdue / total) * 100;

  const circumference = 2 * Math.PI * 14;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
          {/* Background circle */}
          <circle
            cx="18" cy="18" r="14"
            fill="none"
            stroke={colors.background}
            strokeWidth="5"
          />
          {/* Completed (darker) */}
          <circle
            cx="18" cy="18" r="14"
            fill="none"
            stroke={colors.completed}
            strokeWidth="5"
            strokeDasharray={`${(completedPercent / 100) * circumference} ${circumference}`}
            strokeDashoffset="0"
            strokeLinecap="round"
          />
          {/* In Review */}
          <circle
            cx="18" cy="18" r="14"
            fill="none"
            stroke={colors.inReview}
            strokeWidth="5"
            strokeDasharray={`${(inReviewPercent / 100) * circumference} ${circumference}`}
            strokeDashoffset={`${-((completedPercent / 100) * circumference)}`}
            strokeLinecap="round"
          />
          {/* To Do (lighter) */}
          <circle
            cx="18" cy="18" r="14"
            fill="none"
            stroke={colors.todo}
            strokeWidth="5"
            strokeDasharray={`${(todoPercent / 100) * circumference} ${circumference}`}
            strokeDashoffset={`${-(((completedPercent + inReviewPercent) / 100) * circumference)}`}
            strokeLinecap="round"
          />
          {/* Overdue */}
          {overduePercent > 0 && (
            <circle
              cx="18" cy="18" r="14"
              fill="none"
              stroke={colors.overdue}
              strokeWidth="5"
              strokeDasharray={`${(overduePercent / 100) * circumference} ${circumference}`}
              strokeDashoffset={`${-(((completedPercent + inReviewPercent + todoPercent) / 100) * circumference)}`}
              strokeLinecap="round"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold">{totalCount}</span>
        </div>
      </div>
    </div>
  );
}

// Lighten a hex color
function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min((num >> 16) + amt, 255);
  const G = Math.min((num >> 8 & 0x00FF) + amt, 255);
  const B = Math.min((num & 0x0000FF) + amt, 255);
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

export function DashboardPage() {
  const { isAdmin, user } = useAuth();
  const navigate = useNavigate();
  const { selectedProjectId, selectedClientId } = useFilters();
  const { theme } = useTheme();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Get theme-aware chart colors - use theme object directly to avoid race condition
  const chartColors = useMemo(() => {
    const colors = theme?.colors || {
      primary: '#8b0000',
      accent: '#f91a1a',
      error: '#ef4444',
    };
    const primaryDark = darkenColor(colors.primary, 30);
    const accentLight = lightenColor(colors.accent, 60);
    return {
      todo: colors.accent,
      inReview: colors.primary,
      completed: primaryDark,
      overdue: colors.error,
      background: accentLight,
    };
  }, [theme]);

  const params: Record<string, string> = {};
  if (selectedProjectId) params.projectId = selectedProjectId;
  if (selectedClientId) params.clientId = selectedClientId;

  const { data: stats } = useQuery({
    queryKey: ['dashboard', 'stats', params],
    queryFn: () => dashboard.stats(Object.keys(params).length > 0 ? params : undefined),
    enabled: !!user, // Wait for auth before fetching
  });

  const { data: upcomingTasks = [] } = useQuery({
    queryKey: ['dashboard', 'upcoming', params],
    queryFn: () => dashboard.upcoming(Object.keys(params).length > 0 ? params : undefined),
    enabled: !!user, // Wait for auth before fetching
  });

  const { data: completedTasks = [] } = useQuery({
    queryKey: ['dashboard', 'completed', params],
    queryFn: () => dashboard.completed(Object.keys(params).length > 0 ? params : undefined),
    enabled: !!user, // Wait for auth before fetching
  });

  const { data: timeSummary } = useQuery({
    queryKey: ['dashboard', 'time-summary', params],
    queryFn: () => dashboard.timeSummary(Object.keys(params).length > 0 ? params : undefined),
    enabled: !!user, // Wait for auth before fetching
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: users.list,
    enabled: isAdmin,
  });

  const { data: incompleteTasks } = useQuery({
    queryKey: ['dashboard', 'incomplete', params],
    queryFn: () => dashboard.incomplete(Object.keys(params).length > 0 ? params : undefined),
    enabled: isAdmin && !!user, // Wait for auth before fetching
  });

  const { data: recentActivity = [] } = useQuery({
    queryKey: ['dashboard', 'recent-activity', params],
    queryFn: () => dashboard.recentActivity(Object.keys(params).length > 0 ? params : undefined),
    enabled: !!user, // Wait for auth before fetching
  });

  const totalTasks = (stats?.tasks.todo || 0) + (stats?.tasks.inReview || 0) + (stats?.tasks.completed || 0);

  const overdueTasks = upcomingTasks.filter(t => t.dueDate && isOverdue(t.dueDate));
  const dueTodayTasks = upcomingTasks.filter(t => {
    if (!t.dueDate) return false;
    const due = new Date(t.dueDate);
    const today = new Date();
    return due.toDateString() === today.toDateString();
  });

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`Welcome back, ${user?.name?.split(' ')[0]}`}
      />

      <div className="p-6 space-y-6">
        {/* Task Progress with Donut + Tasks Needing Attention + Quick Stats - All 1/3 width */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Task Progress with Donut */}
          <DashboardCard title="Task Progress" data-guide="task-progress">
            <div className="flex items-center gap-6">
              <DonutChart
                todo={stats?.tasks.todo || 0}
                inReview={stats?.tasks.inReview || 0}
                completed={stats?.tasks.completed || 0}
                overdue={stats?.tasks.overdue || 0}
                total={totalTasks}
                colors={chartColors}
              />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: chartColors.todo }} />
                  <span className="text-sm text-muted-foreground">To Do</span>
                  <span className="ml-auto font-semibold">{stats?.tasks.todo || 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: chartColors.inReview }} />
                  <span className="text-sm text-muted-foreground">In Review</span>
                  <span className="ml-auto font-semibold">{stats?.tasks.inReview || 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: chartColors.completed }} />
                  <span className="text-sm text-muted-foreground">Completed</span>
                  <span className="ml-auto font-semibold">{stats?.tasks.completed || 0}</span>
                </div>
                {(stats?.tasks.overdue || 0) > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: chartColors.overdue }} />
                    <span className="text-sm text-muted-foreground">Overdue</span>
                    <span className="ml-auto font-semibold text-[var(--theme-error)]">{stats?.tasks.overdue || 0}</span>
                  </div>
                )}
              </div>
            </div>
          </DashboardCard>

          {/* Tasks Needing Attention */}
          {isAdmin && incompleteTasks && (incompleteTasks.counts.unassigned > 0 || incompleteTasks.counts.noDueDate > 0) ? (
            <DashboardCard title="Needs Attention">
              <div className="space-y-3">
                <div
                  className="flex items-center justify-between p-3 bg-orange-50 rounded-lg cursor-pointer hover:bg-orange-100 border border-orange-200 transition-colors"
                  onClick={() => navigate('/list?filter=unassigned')}
                >
                  <div className="flex items-center gap-3">
                    <UserX className="h-5 w-5 text-orange-600" />
                    <span className="text-sm font-medium">Unassigned Tasks</span>
                  </div>
                  <span className="text-lg font-bold text-orange-600">{incompleteTasks.counts.unassigned}</span>
                </div>
                <div
                  className="flex items-center justify-between p-3 bg-amber-50 rounded-lg cursor-pointer hover:bg-amber-100 border border-amber-200 transition-colors"
                  onClick={() => navigate('/list?filter=no-due-date')}
                >
                  <div className="flex items-center gap-3">
                    <CalendarX className="h-5 w-5 text-amber-600" />
                    <span className="text-sm font-medium">No Due Date</span>
                  </div>
                  <span className="text-lg font-bold text-amber-600">{incompleteTasks.counts.noDueDate}</span>
                </div>
              </div>
            </DashboardCard>
          ) : (
            <DashboardCard title="Tasks Status">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <span className="text-sm font-medium text-green-700">All tasks assigned</span>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <span className="text-sm font-medium text-green-700">All have due dates</span>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
              </div>
            </DashboardCard>
          )}

          {/* Quick Stats */}
          <DashboardCard title="Quick Stats" data-guide="quick-stats">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  <span className="text-sm font-medium">Overdue Tasks</span>
                </div>
                <span className="text-lg font-bold text-red-600">{overdueTasks.length}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-amber-500" />
                  <span className="text-sm font-medium">Due Today</span>
                </div>
                <span className="text-lg font-bold text-amber-600">{dueTodayTasks.length}</span>
              </div>
              {isAdmin && (
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-slate-500" />
                    <span className="text-sm font-medium">Team Members</span>
                  </div>
                  <span className="text-lg font-bold text-slate-600">{allUsers.length}</span>
                </div>
              )}
            </div>
          </DashboardCard>
        </div>

        {/* Upcoming Tasks + Activity Log - 1/3 + 2/3 for client dashboards, full width for all projects */}
        <div className={cn(
          "grid grid-cols-1 gap-4",
          (selectedProjectId || selectedClientId) ? "lg:grid-cols-3" : "lg:grid-cols-1"
        )}>
          {/* Upcoming Tasks - 1/3 width when client selected */}
          <DashboardCard
            title="Upcoming Tasks"
            data-guide="upcoming-tasks"
            badge={
              <button
                onClick={() => navigate('/kanban')}
                className="text-sm text-white/80 hover:text-white flex items-center gap-1 transition-colors"
              >
                View all <ArrowRight className="h-3 w-3" />
              </button>
            }
          >
            <div className="space-y-2 max-h-[1280px] overflow-y-auto">
              {upcomingTasks.slice(0, 8).map((task) => {
                const taskOverdue = task.dueDate && isOverdue(task.dueDate);
                return (
                  <div
                    key={task.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-slate-50 border border-transparent",
                      taskOverdue && "bg-red-50 hover:bg-red-100 border-red-200"
                    )}
                    onClick={() => setSelectedTask(task as Task)}
                  >
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        backgroundColor: task.status === 'todo' ? chartColors.todo :
                          task.status === 'in_review' ? chartColors.inReview : chartColors.completed
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{task.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {task.project?.client?.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {task.tags.slice(0, 1).map((tag) => (
                        <Badge key={tag} className={cn('text-xs', getTagColor(tag))} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                      {task.dueDate && (
                        <span className={cn(
                          "text-xs",
                          taskOverdue ? "text-red-600 font-medium" : "text-muted-foreground"
                        )}>
                          {formatDate(task.dueDate)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {upcomingTasks.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <p>All caught up!</p>
                </div>
              )}
            </div>
          </DashboardCard>

          {/* Activity Log - Only shown when a project or client is selected (2/3 width) */}
          {(selectedProjectId || selectedClientId) && (
            <div className="lg:col-span-2">
              <DashboardCard
                title="Activity Log"
                badge={
                  recentActivity.length > 0 && (
                    <span className="text-sm text-white/80">{recentActivity.length} updates</span>
                  )
                }
              >
              <div className="space-y-3 max-h-[1280px] overflow-y-auto">
                {recentActivity.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                    <p>No activity yet</p>
                    <p className="text-xs mt-1">Comments on tasks will appear here</p>
                  </div>
                ) : (
                  recentActivity.map((activity) => {
                    const timeAgo = getTimeAgo(activity.createdAt);
                    return (
                      <div
                        key={activity.id}
                        className="flex gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                      >
                        <UserAvatar
                          name={activity.user?.name || 'Unknown'}
                          avatarUrl={activity.user?.avatarUrl}
                          size="sm"
                          className="shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-xs">{activity.user?.name}</span>
                            <span className="text-xs text-muted-foreground">{timeAgo}</span>
                          </div>
                          <p
                            className="text-sm text-slate-700 line-clamp-2"
                            dangerouslySetInnerHTML={{ __html: sanitizeText(activity.content) }}
                          />
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {activity.task?.title}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </DashboardCard>
          </div>
        )}
        </div>

        {/* Recently Completed - Full width */}
        <DashboardCard
          title="Recently Completed"
          badge={<span className="text-sm text-white/80">{completedTasks.length} this month</span>}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {completedTasks.slice(0, 9).map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors border border-slate-100 cursor-pointer"
                onClick={() => setSelectedTask(task as Task)}
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: chartColors.completed }} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{task.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {task.project?.client?.name}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {task.completedAt && formatDate(task.completedAt)}
                </span>
              </div>
            ))}
            {completedTasks.length === 0 && (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                <p>No completed tasks yet</p>
              </div>
            )}
          </div>
        </DashboardCard>

        {/* Time Summary - Admin Only */}
        {isAdmin && timeSummary && (
          <DashboardCard
            title="Time Tracking Summary"
            badge={<span className="text-sm text-white/80">{timeSummary.totalHours}h total</span>}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-3">By Team Member</h4>
                <div className="space-y-3">
                  {timeSummary.byContractor.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <UserAvatar
                        name={item.name}
                        avatarUrl={item.avatarUrl}
                        size="md"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{item.name}</span>
                          <span className="text-sm text-muted-foreground">{item.totalHours}h</span>
                        </div>
                        <Progress
                          value={(item.totalMinutes / (timeSummary.totalMinutes || 1)) * 100}
                          className="h-1.5"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-3">By Project</h4>
                <div className="space-y-3">
                  {timeSummary.byProject.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                      <div>
                        <p className="text-sm font-medium">{item.clientName}</p>
                        <p className="text-xs text-muted-foreground">{item.projectName}</p>
                      </div>
                      <span className="font-semibold">{item.totalHours}h</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </DashboardCard>
        )}
      </div>

      {/* Task Detail Panel */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  );
}
