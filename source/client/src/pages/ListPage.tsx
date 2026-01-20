import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { tasks as tasksApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useFilters } from '@/hooks/useFilters';
import { useUpdateTaskStatus } from '@/hooks/useTasks';
import { useRunningTimer, useStopTimer } from '@/hooks/useTimeEntries';
import { TaskListView } from '@/components/TaskListView';
import { TaskDetailPanel } from '@/components/TaskDetailPanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserX, AlertTriangle, Square, Archive } from 'lucide-react';
import { cn, formatDuration } from '@/lib/utils';
import type { Task, TaskStatus } from '@/lib/types';

type FilterType = 'all' | 'unassigned' | 'overdue';

function RunningTimer() {
  const { data: runningTimer } = useRunningTimer();
  const stopTimer = useStopTimer();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!runningTimer?.startTime) {
      setElapsed(0);
      return;
    }

    const updateElapsed = () => {
      const start = new Date(runningTimer.startTime!).getTime();
      const now = Date.now();
      setElapsed(Math.floor((now - start) / 60000));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [runningTimer?.startTime]);

  if (!runningTimer) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-[var(--theme-primary)]/10 border border-[var(--theme-primary)]/30 text-[var(--theme-primary)] rounded-lg">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-[var(--theme-accent)] rounded-full animate-pulse" />
        <span className="font-mono font-semibold">{formatDuration(elapsed)}</span>
      </div>
      <span className="text-[var(--theme-primary)] truncate max-w-[150px] text-sm font-medium">{runningTimer.title}</span>
      <Button
        size="sm"
        className="h-7 px-2 bg-[var(--theme-accent)] hover:bg-[var(--theme-primary)] text-white"
        onClick={() => stopTimer.mutate({ id: runningTimer.id })}
      >
        <Square className="h-3.5 w-3.5 fill-current" />
      </Button>
    </div>
  );
}

export function ListPage() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { selectedProjectId, selectedClientId } = useFilters();
  const updateTaskStatus = useUpdateTaskStatus();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [quickFilter, setQuickFilter] = useState<FilterType>('all');
  const [showArchived, setShowArchived] = useState(false);

  // Set initial filter from URL params
  useEffect(() => {
    const filterParam = searchParams.get('filter');
    if (filterParam === 'unassigned' || filterParam === 'overdue' || filterParam === 'incomplete') {
      if (filterParam === 'incomplete') {
        setQuickFilter('unassigned');
      } else {
        setQuickFilter(filterParam as FilterType);
      }
    }
  }, [searchParams]);

  const params: Record<string, string> = {};
  if (selectedProjectId) params.projectId = selectedProjectId;
  if (selectedClientId) params.clientId = selectedClientId;
  if (statusFilter !== 'all') params.status = statusFilter;

  const { data: activeTasks = [] } = useQuery({
    queryKey: ['tasks', params],
    queryFn: () => tasksApi.list(Object.keys(params).length > 0 ? params : undefined),
    enabled: !!user, // Wait for auth before fetching
  });

  const { data: archivedTasks = [] } = useQuery({
    queryKey: ['tasks', 'archived'],
    queryFn: tasksApi.listArchived,
    enabled: showArchived && !!user, // Wait for auth before fetching
  });

  // Show ONLY archived tasks when archive toggle is on
  const allTasks = useMemo(() => {
    if (showArchived) {
      return archivedTasks;
    }
    return activeTasks;
  }, [activeTasks, archivedTasks, showArchived]);

  // Apply quick filters and sort by due date
  const filteredTasks = useMemo(() => {
    let tasks = [...allTasks];

    // Apply quick filter
    if (quickFilter === 'unassigned') {
      tasks = tasks.filter(t => (!t.assignees || t.assignees.length === 0) && t.status !== 'completed');
    } else if (quickFilter === 'overdue') {
      const now = new Date();
      tasks = tasks.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== 'completed');
    }

    // Sort by due date: no due date first, then by due date ascending
    tasks.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return -1;
      if (!b.dueDate) return 1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

    return tasks;
  }, [allTasks, quickFilter]);

  const handleStatusChange = (taskId: string, status: TaskStatus) => {
    updateTaskStatus.mutate({ id: taskId, status });
  };

  const handleTaskClick = (taskId: string) => {
    const task = allTasks.find(t => t.id === taskId);
    if (task) setSelectedTask(task);
  };

  // Count tasks for quick filter badges
  const counts = useMemo(() => {
    const now = new Date();
    return {
      unassigned: allTasks.filter(t => (!t.assignees || t.assignees.length === 0) && t.status !== 'completed').length,
      overdue: allTasks.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== 'completed').length,
    };
  }, [allTasks]);

  return (
    <div>
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 sticky top-0 z-40 min-h-[73px]">
        <div className="flex items-center justify-between">
          {/* Left: Title + Description */}
          <div>
            <h1 className="text-2xl font-bold">Task List</h1>
            <p className="text-muted-foreground text-sm">
              View and manage all tasks across projects
            </p>
          </div>

          {/* Right: Filters + Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setQuickFilter('all');
                setShowArchived(false);
              }}
              className={cn(
                "h-8 px-3 text-sm border rounded transition-colors",
                quickFilter === 'all' && !showArchived
                  ? "bg-[var(--theme-accent)] text-white border-[var(--theme-accent)]"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-[var(--theme-accent)] hover:text-white hover:border-[var(--theme-accent)]"
              )}
            >
              All Tasks
            </button>
            <button
              onClick={() => {
                setQuickFilter('unassigned');
                setShowArchived(false);
              }}
              className={cn(
                "h-8 px-3 text-sm border rounded transition-colors flex items-center gap-1.5",
                quickFilter === 'unassigned' && !showArchived
                  ? "bg-[var(--theme-accent)] text-white border-[var(--theme-accent)]"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-[var(--theme-accent)] hover:text-white hover:border-[var(--theme-accent)]"
              )}
            >
              <UserX className="h-4 w-4" />
              Unassigned
              {counts.unassigned > 0 && (
                <Badge variant="secondary" className={cn(
                  "ml-1 h-5 px-1.5",
                  quickFilter === 'unassigned' && !showArchived ? "bg-white/20 text-white" : "bg-orange-100 text-orange-700"
                )}>
                  {counts.unassigned}
                </Badge>
              )}
            </button>
            <button
              onClick={() => {
                setQuickFilter('overdue');
                setShowArchived(false);
              }}
              className={cn(
                "h-8 px-3 text-sm border rounded transition-colors flex items-center gap-1.5",
                quickFilter === 'overdue' && !showArchived
                  ? "bg-[var(--theme-accent)] text-white border-[var(--theme-accent)]"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-[var(--theme-accent)] hover:text-white hover:border-[var(--theme-accent)]"
              )}
            >
              <AlertTriangle className="h-4 w-4" />
              Overdue
              {counts.overdue > 0 && (
                <Badge variant="secondary" className={cn(
                  "ml-1 h-5 px-1.5",
                  quickFilter === 'overdue' && !showArchived ? "bg-white/20 text-white" : "bg-red-100 text-red-700"
                )}>
                  {counts.overdue}
                </Badge>
              )}
            </button>

            <button
              onClick={() => {
                setShowArchived((prev) => !prev);
                setQuickFilter('all');
                setStatusFilter('all');
              }}
              className={cn(
                "h-8 px-3 text-sm border rounded transition-colors flex items-center gap-1.5",
                showArchived
                  ? "bg-amber-500 text-white border-amber-500"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-amber-500 hover:text-white hover:border-amber-500"
              )}
            >
              <Archive className="h-4 w-4" />
              Archived
            </button>

            {/* Status Dropdown */}
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as TaskStatus | 'all')}>
              <SelectTrigger className="w-36 h-8">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="todo">To Do</SelectItem>
                <SelectItem value="in_review">In Review</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>

            <RunningTimer />
          </div>
        </div>
      </div>

      {/* Task List */}
      <div className="p-6">
        <TaskListView
          tasks={filteredTasks}
          onTaskClick={handleTaskClick}
          onStatusChange={handleStatusChange}
        />
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
