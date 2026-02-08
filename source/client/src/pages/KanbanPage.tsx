import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragOverlay,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useTasks, useTask, useUpdateTaskStatus, useCreateTask } from '@/hooks/useTasks';
import { useAuth } from '@/hooks/useAuth';
import { useFilters } from '@/hooks/useFilters';
import { useRunningTimer, useStopTimer } from '@/hooks/useTimeEntries';
import { users, tags as tagsApi, projects, clients, tasks as tasksApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toaster';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { KanbanColumn } from '@/components/KanbanColumn';
import { TaskCard } from '@/components/TaskCard';
import { TaskDetailPanel } from '@/components/TaskDetailPanel';
import { KanbanColumnSkeleton } from '@/components/TaskCardSkeleton';
import { Users, Tag, Plus, FolderPlus, Flag, User, Archive, Square, Filter, RefreshCw } from 'lucide-react';
// Note: List view removed from Kanban - use dedicated List page instead
import { cn, formatDuration } from '@/lib/utils';
import type { Task, TaskStatus, TaskPriority } from '@/lib/types';
import { priorityConfig } from '@/components/TaskCard';

const columns: { id: TaskStatus; title: string; color: string }[] = [
  { id: 'todo', title: 'To Do', color: 'bg-slate-500' },
  { id: 'in_review', title: 'In Review', color: 'bg-amber-500' },
  { id: 'completed', title: 'Completed', color: 'bg-green-500' },
];

export function KanbanPage() {
  const { isAdmin, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showMyTasks, setShowMyTasks] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeOverColumn, setActiveOverColumn] = useState<TaskStatus | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(searchParams.get('taskId'));
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Running timer
  const { data: runningTimer } = useRunningTimer();
  const stopTimer = useStopTimer();
  const [timerElapsed, setTimerElapsed] = useState(0);

  useEffect(() => {
    if (!runningTimer?.startTime) {
      setTimerElapsed(0);
      return;
    }
    const updateElapsed = () => {
      const start = new Date(runningTimer.startTime!).getTime();
      setTimerElapsed(Math.floor((Date.now() - start) / 60000));
    };
    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [runningTimer?.startTime]);

  // Create task form state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskProjectId, setNewTaskProjectId] = useState<string>('');
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState<string>('none');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('medium');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskTags, setNewTaskTags] = useState<string[]>([]);

  // Create project form state
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectClientId, setNewProjectClientId] = useState<string>('');
  const [newProjectPlanType, setNewProjectPlanType] = useState('lvl1_basic');

  const {
    selectedProjectId,
    selectedClientId,
    selectedAssignees,
    selectedTags,
    searchQuery,
    toggleAssignee,
    toggleTag,
  } = useFilters();

  // Build API params from filters
  const params: Record<string, string> = {};
  if (selectedProjectId) params.projectId = selectedProjectId;
  if (selectedClientId) params.clientId = selectedClientId;

  const { data: activeTasks, isLoading: isLoadingTasks } = useTasks(
    Object.keys(params).length > 0 ? params : undefined,
    { enabled: !!user }
  );
  // Use empty array as fallback only when we truly have no data (not during refetch)
  const safeActiveTasks = activeTasks ?? [];
  const { data: archivedTasks = [] } = useQuery({
    queryKey: ['tasks', 'archived'],
    queryFn: tasksApi.listArchived,
    enabled: showArchived,
  });
  const updateStatus = useUpdateTaskStatus();

  // Show ONLY archived tasks when archive toggle is on
  const tasks = useMemo(() => {
    if (showArchived) {
      return archivedTasks;
    }
    return safeActiveTasks;
  }, [safeActiveTasks, archivedTasks, showArchived]);

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: users.list,
  });

  const { data: allTags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: tagsApi.list,
  });

  const { data: allProjects = [], refetch: refetchProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: projects.list,
  });

  const { data: allClients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: clients.list,
  });

  const createTask = useCreateTask();
  const queryClient = useQueryClient();

  const archiveCompleted = useMutation({
    mutationFn: tasksApi.archiveCompleted,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: `Archived ${data.count} completed task${data.count !== 1 ? 's' : ''}` });
    },
  });

  const handleCreateTask = () => {
    if (!newTaskTitle.trim()) {
      toast({ title: 'Please enter a task title', variant: 'destructive' });
      return;
    }
    if (!newTaskProjectId) {
      toast({ title: 'Please select a project', variant: 'destructive' });
      return;
    }

    createTask.mutate(
      {
        title: newTaskTitle,
        description: newTaskDescription || undefined,
        projectId: newTaskProjectId,
        assigneeIds: newTaskAssigneeId !== 'none' ? [newTaskAssigneeId] : undefined,
        priority: newTaskPriority,
        dueDate: newTaskDueDate || undefined,
        tags: newTaskTags,
        status: 'todo',
      },
      {
        onSuccess: () => {
          setShowCreateDialog(false);
          setNewTaskTitle('');
          setNewTaskDescription('');
          setNewTaskProjectId('');
          setNewTaskAssigneeId('none');
          setNewTaskPriority('medium');
          setNewTaskDueDate('');
          setNewTaskTags([]);
          toast({ title: 'Task created' });
        },
      }
    );
  };

  const [isCreatingProject, setIsCreatingProject] = useState(false);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      toast({ title: 'Please enter a project name', variant: 'destructive' });
      return;
    }
    if (!newProjectClientId) {
      toast({ title: 'Please select a client', variant: 'destructive' });
      return;
    }

    setIsCreatingProject(true);
    try {
      await projects.create({
        clientId: newProjectClientId,
        name: newProjectName,
        planType: newProjectPlanType,
      });
      setShowProjectDialog(false);
      setNewProjectName('');
      setNewProjectClientId('');
      setNewProjectPlanType('lvl1_basic');
      refetchProjects();
      toast({ title: 'Project created' });
    } catch (error: any) {
      toast({ title: error.message || 'Failed to create project', variant: 'destructive' });
    } finally {
      setIsCreatingProject(false);
    }
  };

  // Inline task creation from column
  const handleInlineAddTask = (title: string, status: TaskStatus) => {
    // Use filtered project if selected, otherwise use first available project
    const projectId = selectedProjectId || allProjects[0]?.id;

    if (!projectId) {
      toast({ title: 'Please create a project first', variant: 'destructive' });
      return;
    }

    createTask.mutate(
      {
        title,
        projectId,
        status,
      },
      {
        onSuccess: () => {
          toast({ title: 'Task created' });
        },
      }
    );
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // 'n' - Open new task dialog
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setShowCreateDialog(true);
      }

      // 'Escape' - Close panels/dialogs
      if (e.key === 'Escape') {
        if (selectedTaskId) {
          setSelectedTaskId(null);
        } else if (showCreateDialog) {
          setShowCreateDialog(false);
        } else if (showProjectDialog) {
          setShowProjectDialog(false);
        }
      }

      // 'm' - Toggle My Tasks filter
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        setShowMyTasks((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTaskId, showCreateDialog, showProjectDialog]);

  // Sync URL with selected task
  useEffect(() => {
    if (selectedTaskId) {
      setSearchParams({ taskId: selectedTaskId });
    } else {
      setSearchParams({});
    }
  }, [selectedTaskId, setSearchParams]);

  // Apply client-side filters
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // My Tasks filter
      const taskAssigneeIds = task.assignees?.map(a => a.userId) || [];
      if (showMyTasks && user && !taskAssigneeIds.includes(user.id)) {
        return false;
      }
      // Assignee filter
      if (selectedAssignees.length > 0 && !selectedAssignees.some(id => taskAssigneeIds.includes(id))) {
        return false;
      }
      // Tag filter
      if (selectedTags.length > 0 && !task.tags.some((t) => selectedTags.includes(t))) {
        return false;
      }
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(query);
        const matchesClient = task.project?.client?.name?.toLowerCase().includes(query);
        const matchesProject = task.project?.name?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesClient && !matchesProject) {
          return false;
        }
      }
      return true;
    });
  }, [tasks, selectedAssignees, selectedTags, searchQuery, showMyTasks, user]);

  const getTasksByStatus = (status: TaskStatus) =>
    filteredTasks.filter((task) => task.status === status);

  const handleDragStart = (event: DragStartEvent) => {
    const task = filteredTasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (over) {
      const overId = over.id as string;
      // Check if hovering over a column directly
      const column = columns.find((col) => col.id === overId);
      if (column) {
        setActiveOverColumn(column.id);
      } else {
        // Check if hovering over a task, get its column
        const overTask = filteredTasks.find((t) => t.id === overId);
        if (overTask) {
          setActiveOverColumn(overTask.status);
        }
      }
    } else {
      setActiveOverColumn(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    setActiveOverColumn(null);

    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    // First check if dropped on a column directly
    let newStatus = columns.find((col) => col.id === overId)?.id;

    // If not dropped on a column, check if dropped on another task and get that task's column
    if (!newStatus) {
      const overTask = filteredTasks.find((t) => t.id === overId);
      if (overTask) {
        newStatus = overTask.status;
      }
    }

    if (newStatus) {
      const task = filteredTasks.find((t) => t.id === taskId);
      if (task && task.status !== newStatus) {
        updateStatus.mutate({ id: taskId, status: newStatus });
      }
    }
  };

  // Try to find the task in the loaded list first
  const taskInList = tasks.find((t) => t.id === selectedTaskId);

  // Fetch directly if task from URL is not in the current list (e.g., different project, archived)
  const { data: fetchedTask, error: taskFetchError } = useTask(
    selectedTaskId && !taskInList ? selectedTaskId : ''
  );

  // Use fetched task if not found in list, handle errors gracefully
  const selectedTask = taskInList || fetchedTask;

  // Clear selection if task couldn't be loaded (permission denied, not found)
  useEffect(() => {
    if (selectedTaskId && !taskInList && taskFetchError) {
      toast({
        title: 'Unable to load task',
        description: 'The task may have been deleted or you may not have permission to view it.',
        variant: 'destructive',
      });
      setSelectedTaskId(null);
    }
  }, [selectedTaskId, taskInList, taskFetchError]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white/[0.06] border-b px-6 py-4 sticky top-0 z-40 min-h-[73px]">
        <div className="flex items-center justify-between">
          {/* Left: Title + Description */}
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Kanban Board</h1>
            <p className="text-white/60 text-sm hidden md:block">
              Drag and drop tasks between columns
            </p>
          </div>

          {/* Right: Filters + Actions */}
          <div className="flex items-center gap-2" data-guide="kanban-filters">
            {/* Mobile Filter Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "h-8 px-3 text-sm border rounded-md transition-colors flex md:hidden items-center gap-1.5",
                    (showMyTasks || showArchived || selectedAssignees.length > 0 || selectedTags.length > 0)
                      ? "bg-[var(--theme-accent)] text-white border-[var(--theme-accent)]"
                      : "bg-white/[0.06] text-white border-white/10"
                  )}
                >
                  <Filter className="h-4 w-4" />
                  Filters
                  {(showMyTasks || showArchived || selectedAssignees.length > 0 || selectedTags.length > 0) && (
                    <span className="ml-1 w-2 h-2 bg-white rounded-full" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Filters</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={showMyTasks}
                  onCheckedChange={() => {
                    setShowMyTasks((prev) => !prev);
                    setShowArchived(false);
                  }}
                >
                  <User className="h-4 w-4 mr-2" />
                  My Tasks
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={showArchived}
                  onCheckedChange={() => {
                    setShowArchived((prev) => !prev);
                    setShowMyTasks(false);
                  }}
                >
                  <Archive className="h-4 w-4 mr-2" />
                  Archived
                </DropdownMenuCheckboxItem>
                {isAdmin && allUsers.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs">Assignees</DropdownMenuLabel>
                    {allUsers.map((filterUser) => (
                      <DropdownMenuCheckboxItem
                        key={filterUser.id}
                        checked={selectedAssignees.includes(filterUser.id)}
                        onCheckedChange={() => toggleAssignee(filterUser.id)}
                      >
                        {filterUser.name}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </>
                )}
                {allTags.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs">Tags</DropdownMenuLabel>
                    {allTags.map((tag) => (
                      <DropdownMenuCheckboxItem
                        key={tag.id}
                        checked={selectedTags.includes(tag.name)}
                        onCheckedChange={() => toggleTag(tag.name)}
                      >
                        <span
                          className="w-3 h-3 rounded-full mr-2"
                          style={{ backgroundColor: tag.color }}
                        />
                        {tag.name}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Desktop Filters */}
            <button
              onClick={() => {
                setShowMyTasks((prev) => !prev);
                setShowArchived(false);
              }}
              data-guide="filter-my-tasks"
              className={cn(
                "h-8 px-3 text-sm border rounded-md transition-colors hidden md:flex items-center gap-1.5",
                showMyTasks
                  ? "bg-[var(--theme-accent)] text-white border-[var(--theme-accent)]"
                  : "bg-white/[0.06] text-white border-white/10 hover:bg-[var(--theme-accent)] hover:border-[var(--theme-accent)]"
              )}
            >
              <User className="h-4 w-4" />
              My Tasks
            </button>

            <button
              onClick={() => {
                setShowArchived((prev) => !prev);
                setShowMyTasks(false);
              }}
              className={cn(
                "h-8 px-3 text-sm border rounded-md transition-colors hidden md:flex items-center gap-1.5",
                showArchived
                  ? "bg-amber-500 text-white border-amber-500"
                  : "bg-white/[0.06] text-white border-white/10 hover:bg-amber-500 hover:border-amber-500"
              )}
            >
              <Archive className="h-4 w-4" />
              Archived
            </button>

              {isAdmin && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={cn(
                        "h-8 px-3 text-sm border rounded-md transition-colors hidden md:flex items-center gap-1.5",
                        selectedAssignees.length > 0
                          ? "bg-[var(--theme-accent)] text-white border-[var(--theme-accent)]"
                          : "bg-white/[0.06] text-white border-white/10 hover:bg-[var(--theme-accent)] hover:border-[var(--theme-accent)]"
                      )}
                    >
                      <Users className="h-4 w-4" />
                      Assignee
                      {selectedAssignees.length > 0 && (
                        <Badge variant="secondary" className="ml-1 h-5 px-1.5 bg-white/20 text-white">
                          {selectedAssignees.length}
                        </Badge>
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuLabel>Filter by Assignee</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {allUsers.map((filterUser) => (
                      <DropdownMenuCheckboxItem
                        key={filterUser.id}
                        checked={selectedAssignees.includes(filterUser.id)}
                        onCheckedChange={() => toggleAssignee(filterUser.id)}
                      >
                        {filterUser.name}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      "h-8 px-3 text-sm border rounded-md transition-colors hidden md:flex items-center gap-1.5",
                      selectedTags.length > 0
                        ? "bg-[var(--theme-accent)] text-white border-[var(--theme-accent)]"
                        : "bg-white/[0.06] text-white border-white/10 hover:bg-[var(--theme-accent)] hover:border-[var(--theme-accent)]"
                    )}
                  >
                    <Tag className="h-4 w-4" />
                    Tags
                    {selectedTags.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5 bg-white/20 text-white">
                        {selectedTags.length}
                      </Badge>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuLabel>Filter by Tag</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {allTags.map((tag) => (
                    <DropdownMenuCheckboxItem
                      key={tag.id}
                      checked={selectedTags.includes(tag.name)}
                      onCheckedChange={() => toggleTag(tag.name)}
                    >
                      <span
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

            {/* Separator - hidden on mobile */}
            <div className="w-px h-6 bg-white/[0.08] mx-1 hidden md:block" />

            {runningTimer && (
              <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-[var(--theme-primary)]/10 border border-[var(--theme-primary)]/30 text-[var(--theme-primary)] rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[var(--theme-accent)] rounded-full animate-pulse" />
                  <span className="font-mono font-semibold">{formatDuration(timerElapsed)}</span>
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
            )}

            {/* Refresh Button */}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['tasks'] });
                toast({ title: 'Refreshing tasks...' });
              }}
              title="Refresh tasks"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>

            {/* Create Task Button */}
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog} modal={false}>
              <DialogTrigger asChild>
                <Button size="sm" className="shadow-sm transition-all hover:shadow-md" data-guide="new-task-button">
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
                        {allUsers.map((u) => (
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
                  <div className="space-y-2">
                    <Label>Due Date</Label>
                    <Input
                      type="date"
                      value={newTaskDueDate}
                      onChange={(e) => setNewTaskDueDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tags</Label>
                    <div className="flex flex-wrap gap-2">
                      {allTags.map((tag) => (
                        <Badge
                          key={tag.id}
                          variant={newTaskTags.includes(tag.name) ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => {
                            setNewTaskTags((prev) =>
                              prev.includes(tag.name)
                                ? prev.filter((t) => t !== tag.name)
                                : [...prev, tag.name]
                            );
                          }}
                        >
                          <span
                            className="w-2 h-2 rounded-full mr-1"
                            style={{ backgroundColor: tag.color }}
                          />
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button
                    onClick={handleCreateTask}
                    className="w-full"
                    disabled={createTask.isPending}
                  >
                    {createTask.isPending ? 'Creating...' : 'Create Task'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Create Project Button - hidden on mobile */}
            {isAdmin && (
              <Dialog open={showProjectDialog} onOpenChange={setShowProjectDialog} modal={false}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="h-9 hidden md:flex">
                    <FolderPlus className="h-4 w-4 mr-2" />
                    New Project
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create New Project</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Project Name *</Label>
                      <Input
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        placeholder="Project name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Client *</Label>
                      <Select value={newProjectClientId} onValueChange={setNewProjectClientId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a client" />
                        </SelectTrigger>
                        <SelectContent>
                          {allClients.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Plan Type</Label>
                      <Select value={newProjectPlanType} onValueChange={setNewProjectPlanType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lvl1_basic">Tier 1 (Entry)</SelectItem>
                          <SelectItem value="lvl1_advanced">Tier 2 (Standard)</SelectItem>
                          <SelectItem value="lvl2_basic">Tier 3 (Professional)</SelectItem>
                          <SelectItem value="lvl2_advanced">Tier 4 (Premium)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={handleCreateProject}
                      className="w-full"
                      disabled={isCreatingProject}
                    >
                      {isCreatingProject ? 'Creating...' : 'Create Project'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {isLoadingTasks && !activeTasks ? (
          /* Loading Skeletons - only show on initial load when we have no data */
          <div className="flex flex-col md:flex-row gap-4 p-4 md:p-6 md:overflow-x-auto min-h-[400px]">
            <KanbanColumnSkeleton />
            <KanbanColumnSkeleton />
            <KanbanColumnSkeleton />
          </div>
        ) : (
          <>
            {/* Kanban Board */}
            <DndContext
              sensors={sensors}
              collisionDetection={rectIntersection}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <div className="flex flex-col md:flex-row gap-4 p-4 md:p-6 md:overflow-x-auto min-h-[400px]" data-guide="kanban-columns">
                {columns.map((column) => {
                  const columnTasks = getTasksByStatus(column.id);
                  return (
                    <KanbanColumn
                      key={column.id}
                      id={column.id}
                      title={column.title}
                      count={columnTasks.length}
                      onAddTask={handleInlineAddTask}
                      isActiveDropTarget={activeOverColumn === column.id}
                      headerAction={column.id === 'completed' && isAdmin && columnTasks.length > 0 ? (
                        <button
                          onClick={() => archiveCompleted.mutate()}
                          disabled={archiveCompleted.isPending}
                          className="flex items-center gap-1 text-xs text-white/80 hover:text-white bg-white/10 hover:bg-white/20 px-2 py-1 rounded transition-colors"
                          title="Archive completed tasks"
                        >
                          <Archive className="h-3 w-3" />
                          <span>{archiveCompleted.isPending ? '...' : 'Archive'}</span>
                        </button>
                      ) : undefined}
                    >
                      <SortableContext
                        items={columnTasks.map((t) => t.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {columnTasks.map((task, idx) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            onClick={() => setSelectedTaskId(task.id)}
                            data-guide={idx === 0 && column.id === 'todo' ? 'task-card' : undefined}
                          />
                        ))}
                      </SortableContext>
                    </KanbanColumn>
                  );
                })}
              </div>

              <DragOverlay>
                {activeTask && <TaskCard task={activeTask} isDragging />}
              </DragOverlay>
            </DndContext>

          </>
        )}
      </div>

      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
    </div>
  );
}
