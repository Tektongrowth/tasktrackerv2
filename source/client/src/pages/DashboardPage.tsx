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
  Trophy,
} from 'lucide-react';
import { formatDate, getTagColor, isOverdue, sanitizeText } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { darkenColor, lightenColor } from '@/lib/theme';

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
    <div className="glass-card-glow overflow-hidden" data-guide={dataGuide}>
      <div className="bg-white/[0.03] border-b border-white/[0.06] px-4 py-3 flex items-center justify-between relative z-10">
        <h3 className="font-semibold text-white">{title}</h3>
        {badge}
      </div>
      <div className={cn("p-4 relative z-10", onClick && "cursor-pointer")} onClick={onClick}>
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
            <span className="text-3xl font-bold text-white/40">0</span>
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

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard', 'stats', params],
    queryFn: () => dashboard.stats(Object.keys(params).length > 0 ? params : undefined),
    enabled: !!user, // Wait for auth before fetching
    placeholderData: (previousData) => previousData, // Keep previous data while refetching
  });

  const { data: upcomingTasks } = useQuery({
    queryKey: ['dashboard', 'upcoming', params],
    queryFn: () => dashboard.upcoming(Object.keys(params).length > 0 ? params : undefined),
    enabled: !!user, // Wait for auth before fetching
    placeholderData: (previousData) => previousData, // Keep previous data while refetching
  });
  const safeUpcomingTasks = upcomingTasks ?? [];

  const { data: completedTasks } = useQuery({
    queryKey: ['dashboard', 'completed', params],
    queryFn: () => dashboard.completed(Object.keys(params).length > 0 ? params : undefined),
    enabled: !!user, // Wait for auth before fetching
    placeholderData: (previousData) => previousData, // Keep previous data while refetching
  });
  const safeCompletedTasks = completedTasks ?? [];

  const { data: timeSummary } = useQuery({
    queryKey: ['dashboard', 'time-summary', params],
    queryFn: () => dashboard.timeSummary(Object.keys(params).length > 0 ? params : undefined),
    enabled: !!user, // Wait for auth before fetching
    placeholderData: (previousData) => previousData, // Keep previous data while refetching
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: users.list,
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

  const { data: leaderboardData } = useQuery({
    queryKey: ['dashboard', 'leaderboard'],
    queryFn: () => dashboard.leaderboard(),
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes - leaderboard doesn't need frequent updates
  });

  const totalTasks = (stats?.tasks.todo || 0) + (stats?.tasks.inReview || 0) + (stats?.tasks.completed || 0);

  const overdueTasks = safeUpcomingTasks.filter(t => t.dueDate && isOverdue(t.dueDate));
  const dueTodayTasks = safeUpcomingTasks.filter(t => {
    if (!t.dueDate) return false;
    const due = new Date(t.dueDate);
    const today = new Date();
    return due.toDateString() === today.toDateString();
  });

  // Show loading state if no data yet
  if (statsLoading && !stats) {
    return (
      <div>
        <PageHeader
          title="Dashboard"
          subtitle={`Welcome back, ${user?.name?.split(' ')[0]}`}
        />
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

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
                  <span className="text-sm text-white/60">To Do</span>
                  <span className="ml-auto font-semibold">{stats?.tasks.todo || 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: chartColors.inReview }} />
                  <span className="text-sm text-white/60">In Review</span>
                  <span className="ml-auto font-semibold">{stats?.tasks.inReview || 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: chartColors.completed }} />
                  <span className="text-sm text-white/60">Completed</span>
                  <span className="ml-auto font-semibold">{stats?.tasks.completed || 0}</span>
                </div>
                {(stats?.tasks.overdue || 0) > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: chartColors.overdue }} />
                    <span className="text-sm text-white/60">Overdue</span>
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
                  className="flex items-center justify-between p-3 bg-orange-500/10 rounded-lg cursor-pointer hover:bg-orange-500/15 border border-orange-500/20 transition-colors"
                  onClick={() => navigate('/list?filter=unassigned')}
                >
                  <div className="flex items-center gap-3">
                    <UserX className="h-5 w-5 text-orange-400" />
                    <span className="text-sm font-medium">Unassigned Tasks</span>
                  </div>
                  <span className="text-lg font-bold text-orange-400">{incompleteTasks.counts.unassigned}</span>
                </div>
                <div
                  className="flex items-center justify-between p-3 bg-amber-500/10 rounded-lg cursor-pointer hover:bg-amber-500/15 border border-amber-500/20 transition-colors"
                  onClick={() => navigate('/list?filter=no-due-date')}
                >
                  <div className="flex items-center gap-3">
                    <CalendarX className="h-5 w-5 text-amber-400" />
                    <span className="text-sm font-medium">No Due Date</span>
                  </div>
                  <span className="text-lg font-bold text-amber-400">{incompleteTasks.counts.noDueDate}</span>
                </div>
              </div>
            </DashboardCard>
          ) : (
            <DashboardCard title="Tasks Status">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg">
                  <span className="text-sm font-medium text-green-400">All tasks assigned</span>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
                <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg">
                  <span className="text-sm font-medium text-green-400">All have due dates</span>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
              </div>
            </DashboardCard>
          )}

          {/* Quick Stats */}
          <DashboardCard title="Quick Stats" data-guide="quick-stats">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-red-500/10 rounded-lg">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  <span className="text-sm font-medium">Overdue Tasks</span>
                </div>
                <span className="text-lg font-bold text-red-400">{overdueTasks.length}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-amber-500/10 rounded-lg">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-amber-500" />
                  <span className="text-sm font-medium">Due Today</span>
                </div>
                <span className="text-lg font-bold text-amber-400">{dueTodayTasks.length}</span>
              </div>
              {isAdmin && (
                <div className="flex items-center justify-between p-3 bg-white/[0.03] rounded-lg">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-white/50" />
                    <span className="text-sm font-medium">Team Members</span>
                  </div>
                  <span className="text-lg font-bold text-white/70">{allUsers.length}</span>
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
              {safeUpcomingTasks.slice(0, 8).map((task) => {
                const taskOverdue = task.dueDate && isOverdue(task.dueDate);
                return (
                  <div
                    key={task.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-white/[0.04] border border-transparent",
                      taskOverdue && "bg-red-500/10 hover:bg-red-500/15 border-red-500/20"
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
                      <p className="text-xs text-white/60 truncate">
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
                          taskOverdue ? "text-red-400 font-medium" : "text-white/60"
                        )}>
                          {formatDate(task.dueDate)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {safeUpcomingTasks.length === 0 && (
                <div className="text-center py-8 text-white/60">
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
                  <div className="text-center py-8 text-white/60">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 text-white/10" />
                    <p>No activity yet</p>
                    <p className="text-xs mt-1">Comments on tasks will appear here</p>
                  </div>
                ) : (
                  recentActivity.map((activity) => {
                    const timeAgo = getTimeAgo(activity.createdAt);
                    return (
                      <div
                        key={activity.id}
                        className="flex gap-3 p-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
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
                            <span className="text-xs text-white/60">{timeAgo}</span>
                          </div>
                          <p
                            className="text-sm text-white/80 line-clamp-2"
                            dangerouslySetInnerHTML={{ __html: sanitizeText(activity.content) }}
                          />
                          <p className="text-xs text-white/60 mt-1 truncate">
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
          badge={<span className="text-sm text-white/80">{safeCompletedTasks.length} this month</span>}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {safeCompletedTasks.slice(0, 9).map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/[0.04] transition-colors border border-white/[0.06] cursor-pointer"
                onClick={() => setSelectedTask(task as Task)}
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: chartColors.completed }} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{task.title}</p>
                  <p className="text-xs text-white/60 truncate">
                    {task.project?.client?.name}
                  </p>
                </div>
                <span className="text-xs text-white/60 shrink-0">
                  {task.completedAt && formatDate(task.completedAt)}
                </span>
              </div>
            ))}
            {safeCompletedTasks.length === 0 && (
              <div className="col-span-full text-center py-8 text-white/60">
                <p>No completed tasks yet</p>
              </div>
            )}
          </div>
        </DashboardCard>

        {/* Monthly Leaderboard */}
        {leaderboardData && leaderboardData.leaderboard.length > 0 && (
          <DashboardCard
            title="Monthly Leaderboard"
            badge={
              <span className="text-sm text-white/80 flex items-center gap-1">
                <Trophy className="h-4 w-4" />
                {leaderboardData.month}
              </span>
            }
          >
            <div className="space-y-3">
              {leaderboardData.leaderboard.map((entry, index) => {
                const isCurrentUser = entry.id === user?.id;
                const rankColors = ['bg-yellow-500/15 border-yellow-500/20', 'bg-white/[0.06] border-white/10', 'bg-amber-500/15 border-amber-500/20'];
                const rankBg = index < 3 ? rankColors[index] : 'bg-white/[0.03] border-white/[0.08]';
                const trophyColors = ['text-yellow-500', 'text-white/40', 'text-amber-400'];

                return (
                  <div
                    key={entry.id}
                    className={cn(
                      "flex items-center gap-4 p-3 rounded-lg border transition-colors",
                      rankBg,
                      isCurrentUser && "ring-2 ring-[var(--theme-primary)] ring-offset-1"
                    )}
                  >
                    {/* Rank */}
                    <div className="flex items-center justify-center w-8 h-8 shrink-0">
                      {index < 3 ? (
                        <Trophy className={cn("h-6 w-6", trophyColors[index])} />
                      ) : (
                        <span className="text-lg font-bold text-white/50">#{entry.rank}</span>
                      )}
                    </div>

                    {/* User info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <UserAvatar
                        name={entry.name}
                        avatarUrl={entry.avatarUrl}
                        size="md"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {entry.name}
                          {isCurrentUser && <span className="text-white/60 ml-1">(you)</span>}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-white/60">
                          <span>{entry.tasksCompleted} tasks</span>
                          <span>·</span>
                          <span>{entry.onTimeRate}% on time</span>
                          <span>·</span>
                          <span>{entry.completionRate}% done</span>
                          {entry.streak > 0 && (
                            <>
                              <span>·</span>
                              <span>{entry.streak} day streak</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Points */}
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold" style={{ color: 'var(--theme-primary)' }}>
                        {entry.points}
                      </p>
                      <p className="text-xs text-white/60">points</p>
                    </div>

                    {/* Badges */}
                    {entry.badges.length > 0 && (
                      <div className="flex items-center gap-1 shrink-0">
                        {entry.badges.slice(0, 3).map((badge, i) => (
                          <span
                            key={i}
                            className="text-xl cursor-help"
                            title={`${badge.label}: ${badge.description}`}
                          >
                            {badge.emoji}
                          </span>
                        ))}
                        {entry.badges.length > 3 && (
                          <span className="text-xs text-white/60">+{entry.badges.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </DashboardCard>
        )}

        {/* Time Summary - Admin Only */}
        {isAdmin && timeSummary && (
          <DashboardCard
            title="Time Tracking Summary"
            badge={<span className="text-sm text-white/80">{timeSummary.totalHours}h total</span>}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-sm text-white/60 mb-3">By Team Member</h4>
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
                          <span className="text-sm text-white/60">{item.totalHours}h</span>
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
                <h4 className="font-medium text-sm text-white/60 mb-3">By Project</h4>
                <div className="space-y-3">
                  {timeSummary.byProject.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-2 bg-white/[0.03] rounded">
                      <div>
                        <p className="text-sm font-medium">{item.clientName}</p>
                        <p className="text-xs text-white/60">{item.projectName}</p>
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
