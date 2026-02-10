import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { tasks as tasksApi, projects, users } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useFilters } from '@/hooks/useFilters';
import { useTasks, useUpdateTaskStatus, useCreateTask } from '@/hooks/useTasks';
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
import { UserX, AlertTriangle, Square, Archive, Filter, Plus, Flag, User as UserIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toaster';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn, formatDuration } from '@/lib/utils';
import type { Task, TaskStatus, TaskPriority } from '@/lib/types';
import { priorityConfig } from '@/components/TaskCard';

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
  const { selectedProjectId, selectedClientId, showMyTasks, toggleMyTasks } = useFilters();
  const updateTaskStatus = useUpdateTaskStatus();
  const createTask = useCreateTask();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [quickFilter, setQuickFilter] = useState<FilterType>('all');
  const [showArchived, setShowArchived] = useState(false);

  // Create task dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskProjectId, setNewTaskProjectId] = useState('');
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('medium');

  // Fetch projects and users for create dialog
  const { data: allProjects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: projects.list,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: users.list,
  });

  const handleCreateTask = () => {
    if (!newTaskTitle.trim() || !newTaskProjectId) {
      toast({ title: 'Please enter a title and select a project', variant: 'destructive' });
      return;
    }

    createTask.mutate(
      {
        title: newTaskTitle.trim(),
        description: newTaskDescription.trim() || undefined,
        projectId: newTaskProjectId,
        assigneeIds: newTaskAssigneeId && newTaskAssigneeId !== 'none' ? [newTaskAssigneeId] : undefined,
        priority: newTaskPriority,
        status: 'todo',
      },
      {
        onSuccess: () => {
          toast({ title: 'Task created' });
          setShowCreateDialog(false);
          setNewTaskTitle('');
          setNewTaskDescription('');
          setNewTaskProjectId('');
          setNewTaskAssigneeId('');
          setNewTaskPriority('medium');
        },
      }
    );
  };

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

  const { data: activeTasks, isLoading: isLoadingTasks } = useTasks(
    Object.keys(params).length > 0 ? params : undefined,
    { enabled: !!user }
  );
  const safeActiveTasks = activeTasks ?? [];

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
    return safeActiveTasks;
  }, [safeActiveTasks, archivedTasks, showArchived]);

  // Apply quick filters and sort by due date
  const filteredTasks = useMemo(() => {
    let tasks = [...allTasks];

    // My Tasks filter
    if (showMyTasks && user) {
      tasks = tasks.filter(t => t.assignees?.some(a => a.userId === user.id));
    }

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
  }, [allTasks, quickFilter, showMyTasks, user]);

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
      <div className="bg-white/[0.06] border-b px-6 py-4 sticky top-0 z-40 min-h-[73px]">
        <div className="flex items-center justify-between">
          {/* Left: Title + Description */}
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Task List</h1>
            <p className="text-white/60 text-sm hidden md:block">
              View and manage all tasks across projects
            </p>
          </div>

          {/* Right: Filters + Actions */}
          <div className="flex items-center gap-2">
            {/* Mobile Filter Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "h-8 px-3 text-sm border rounded-md transition-colors flex md:hidden items-center gap-1.5",
                    (quickFilter !== 'all' || showArchived || statusFilter !== 'all' || showMyTasks)
                      ? "bg-[var(--theme-accent)] text-white border-[var(--theme-accent)]"
                      : "bg-white/[0.06] text-white border-white/10"
                  )}
                >
                  <Filter className="h-4 w-4" />
                  Filters
                  {(quickFilter !== 'all' || showArchived || statusFilter !== 'all' || showMyTasks) && (
                    <span className="ml-1 w-2 h-2 bg-white rounded-full" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Quick Filters</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={quickFilter === 'all' && !showArchived && !showMyTasks}
                  onCheckedChange={() => {
                    setQuickFilter('all');
                    setShowArchived(false);
                    if (showMyTasks) toggleMyTasks();
                  }}
                >
                  All Tasks
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={showMyTasks}
                  onCheckedChange={() => toggleMyTasks()}
                >
                  <UserIcon className="h-4 w-4 mr-2" />
                  My Tasks
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={quickFilter === 'unassigned' && !showArchived}
                  onCheckedChange={() => {
                    setQuickFilter('unassigned');
                    setShowArchived(false);
                  }}
                >
                  <UserX className="h-4 w-4 mr-2" />
                  Unassigned {counts.unassigned > 0 && `(${counts.unassigned})`}
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={quickFilter === 'overdue' && !showArchived}
                  onCheckedChange={() => {
                    setQuickFilter('overdue');
                    setShowArchived(false);
                  }}
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Overdue {counts.overdue > 0 && `(${counts.overdue})`}
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={showArchived}
                  onCheckedChange={() => {
                    setShowArchived((prev) => !prev);
                    setQuickFilter('all');
                    setStatusFilter('all');
                  }}
                >
                  <Archive className="h-4 w-4 mr-2" />
                  Archived
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs">Status</DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={statusFilter === 'all'}
                  onCheckedChange={() => setStatusFilter('all')}
                >
                  All Statuses
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={statusFilter === 'todo'}
                  onCheckedChange={() => setStatusFilter('todo')}
                >
                  To Do
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={statusFilter === 'in_review'}
                  onCheckedChange={() => setStatusFilter('in_review')}
                >
                  In Review
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={statusFilter === 'completed'}
                  onCheckedChange={() => setStatusFilter('completed')}
                >
                  Completed
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Desktop Filters */}
            <button
              onClick={() => {
                setQuickFilter('all');
                setShowArchived(false);
                if (showMyTasks) toggleMyTasks();
              }}
              className={cn(
                "h-8 px-3 text-sm border rounded transition-colors hidden md:block",
                quickFilter === 'all' && !showArchived && !showMyTasks
                  ? "bg-[var(--theme-accent)] text-white border-[var(--theme-accent)]"
                  : "bg-white/[0.06] text-white border-white/10 hover:bg-[var(--theme-accent)] hover:border-[var(--theme-accent)]"
              )}
            >
              All Tasks
            </button>
            <button
              onClick={() => toggleMyTasks()}
              className={cn(
                "h-8 px-3 text-sm border rounded transition-colors hidden md:flex items-center gap-1.5",
                showMyTasks
                  ? "bg-[var(--theme-accent)] text-white border-[var(--theme-accent)]"
                  : "bg-white/[0.06] text-white border-white/10 hover:bg-[var(--theme-accent)] hover:border-[var(--theme-accent)]"
              )}
            >
              <UserIcon className="h-4 w-4" />
              My Tasks
            </button>
            <button
              onClick={() => {
                setQuickFilter('unassigned');
                setShowArchived(false);
              }}
              className={cn(
                "h-8 px-3 text-sm border rounded transition-colors hidden md:flex items-center gap-1.5",
                quickFilter === 'unassigned' && !showArchived
                  ? "bg-[var(--theme-accent)] text-white border-[var(--theme-accent)]"
                  : "bg-white/[0.06] text-white border-white/10 hover:bg-[var(--theme-accent)] hover:border-[var(--theme-accent)]"
              )}
            >
              <UserX className="h-4 w-4" />
              Unassigned
              {counts.unassigned > 0 && (
                <Badge variant="secondary" className={cn(
                  "ml-1 h-5 px-1.5",
                  quickFilter === 'unassigned' && !showArchived ? "bg-white/20 text-white" : "bg-orange-500/15 text-orange-400"
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
                "h-8 px-3 text-sm border rounded transition-colors hidden md:flex items-center gap-1.5",
                quickFilter === 'overdue' && !showArchived
                  ? "bg-[var(--theme-accent)] text-white border-[var(--theme-accent)]"
                  : "bg-white/[0.06] text-white border-white/10 hover:bg-[var(--theme-accent)] hover:border-[var(--theme-accent)]"
              )}
            >
              <AlertTriangle className="h-4 w-4" />
              Overdue
              {counts.overdue > 0 && (
                <Badge variant="secondary" className={cn(
                  "ml-1 h-5 px-1.5",
                  quickFilter === 'overdue' && !showArchived ? "bg-white/20 text-white" : "bg-red-500/15 text-red-400"
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
                "h-8 px-3 text-sm border rounded transition-colors hidden md:flex items-center gap-1.5",
                showArchived
                  ? "bg-amber-500 text-white border-amber-500"
                  : "bg-white/[0.06] text-white border-white/10 hover:bg-amber-500 hover:border-amber-500"
              )}
            >
              <Archive className="h-4 w-4" />
              Archived
            </button>

            {/* Status Dropdown - hidden on mobile */}
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as TaskStatus | 'all')}>
              <SelectTrigger className="w-36 h-8 hidden md:flex">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="todo">To Do</SelectItem>
                <SelectItem value="in_review">In Review</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>

            {/* Running Timer - hidden on mobile */}
            <div className="hidden md:block">
              <RunningTimer />
            </div>

            {/* Create Task Button */}
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button size="sm" className="shadow-sm transition-all hover:shadow-md">
                  <Plus className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">New Task</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create New Task</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Title *</Label>
                    <Input
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="Task title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={newTaskDescription}
                      onChange={(e) => setNewTaskDescription(e.target.value)}
                      placeholder="Task description"
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Project *</Label>
                    {allProjects.length === 0 ? (
                      <p className="text-sm text-white/60 py-2">No projects available. Create a project first.</p>
                    ) : (
                      <Select value={newTaskProjectId} onValueChange={setNewTaskProjectId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a project" />
                        </SelectTrigger>
                        <SelectContent>
                          {allProjects.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Assignee</Label>
                    <Select value={newTaskAssigneeId} onValueChange={setNewTaskAssigneeId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select assignee" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {allUsers.filter(u => u.active && !u.archived).map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select value={newTaskPriority} onValueChange={(v) => setNewTaskPriority(v as TaskPriority)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(priorityConfig).map(([key, config]) => (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <Flag className={cn('h-3 w-3', config.color)} />
                              {config.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateTask}
                      disabled={!newTaskTitle.trim() || !newTaskProjectId || createTask.isPending}
                    >
                      {createTask.isPending ? 'Creating...' : 'Create Task'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Task List */}
      <div className="p-6">
        {isLoadingTasks && !activeTasks ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <TaskListView
            tasks={filteredTasks}
            onTaskClick={handleTaskClick}
            onStatusChange={handleStatusChange}
          />
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
