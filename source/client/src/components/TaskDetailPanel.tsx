import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUpdateTask } from '@/hooks/useTasks';
import { useRunningTimer, useStartTimer, useStopTimer, useCreateTimeEntry, useDeleteTimeEntry } from '@/hooks/useTimeEntries';
import { useAuth } from '@/hooks/useAuth';
import { users, tasks as tasksApi, subtasks as subtasksApi, comments as commentsApi, roles as rolesApi } from '@/lib/api';
import { toast } from '@/components/ui/toaster';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Clock, Mail, Phone, Flag, Calendar, Plus, Trash2, CheckSquare, MessageSquare, Send, Play, Square, Timer } from 'lucide-react';
import { UserAvatar } from '@/components/UserAvatar';
import { MentionInput } from '@/components/MentionInput';
import { cn, formatDate, formatDuration, getTagColor, sanitizeText } from '@/lib/utils';
import type { Task, TaskPriority, TaskStatus } from '@/lib/types';
import { priorityConfig } from './TaskCard';

interface TaskDetailPanelProps {
  task: Task;
  onClose: () => void;
}

// Get date string for quick picks
const getQuickDate = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

// Format activity action for display
const formatActivityAction = (action: string, details?: Record<string, unknown>): string => {
  switch (action) {
    case 'created':
      return 'created this task';
    case 'status_changed':
    case 'bulk_status_changed':
      return `changed status to ${details?.to || 'unknown'}`;
    case 'updated':
      const changes = (details?.changes as string[]) || [];
      if (changes.length === 0) return 'made changes';
      return `updated ${changes.join(', ')}`;
    case 'commented':
      return 'added a comment';
    case 'priority_changed':
      return `changed priority to ${details?.to || 'unknown'}`;
    case 'role_changed':
      return `changed assigned role to ${details?.roleName || 'none'}`;
    case 'due_date_changed':
      return details?.to ? `set due date to ${details.to}` : 'removed due date';
    case 'subtask_added':
      return `added subtask "${details?.title || ''}"`;
    case 'subtask_completed':
      return `completed subtask "${details?.title || ''}"`;
    case 'subtask_uncompleted':
      return `uncompleted subtask "${details?.title || ''}"`;
    case 'subtask_deleted':
      return `deleted subtask "${details?.title || ''}"`;
    case 'time_logged':
      return `logged ${details?.minutes || 0} minutes`;
    case 'assignee_added':
      return `added ${details?.userName || 'someone'} as assignee`;
    case 'assignee_removed':
      return `removed ${details?.userName || 'someone'} from assignees`;
    default:
      return action.replace(/_/g, ' ');
  }
};

export function TaskDetailPanel({ task: initialTask, onClose }: TaskDetailPanelProps) {
  const { isAdmin, isProjectManager } = useAuth();
  const queryClient = useQueryClient();
  const updateTask = useUpdateTask();

  // Subtask state
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);

  // Comment state
  const [newComment, setNewComment] = useState('');
  const [showAllComments, setShowAllComments] = useState(false);

  // Time tracking
  const { data: runningTimer } = useRunningTimer();
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();
  const createTimeEntry = useCreateTimeEntry();
  const deleteTimeEntry = useDeleteTimeEntry();
  const [, setTimerTick] = useState(0);

  // Manual time entry state
  const [isAddingTime, setIsAddingTime] = useState(false);
  const [manualTimeTitle, setManualTimeTitle] = useState('');
  const [manualTimeDescription, setManualTimeDescription] = useState('');
  const [manualTimeHours, setManualTimeHours] = useState('');
  const [manualTimeMinutes, setManualTimeMinutes] = useState('');

  const isTimerRunningForTask = runningTimer?.taskId === initialTask.id;
  const timerDuration = isTimerRunningForTask && runningTimer?.startTime
    ? Math.floor((Date.now() - new Date(runningTimer.startTime).getTime()) / 60000)
    : 0;

  // Update timer display every minute when running
  useEffect(() => {
    if (!isTimerRunningForTask) return;
    const interval = setInterval(() => {
      setTimerTick(t => t + 1);
    }, 60000);
    return () => clearInterval(interval);
  }, [isTimerRunningForTask]);

  const handleTimerToggle = () => {
    if (isTimerRunningForTask && runningTimer) {
      stopTimer.mutate(
        { id: runningTimer.id, data: { taskId: initialTask.id, projectId: initialTask.projectId } },
        {
          onSuccess: () => {
            toast({ title: 'Timer stopped' });
            queryClient.invalidateQueries({ queryKey: ['tasks', initialTask.id] });
          }
        }
      );
    } else if (runningTimer) {
      // Stop existing timer first, then start new one
      stopTimer.mutate(
        { id: runningTimer.id },
        {
          onSuccess: () => {
            startTimer.mutate(
              { title: initialTask.title, taskId: initialTask.id, projectId: initialTask.projectId },
              { onSuccess: () => toast({ title: 'Timer started' }) }
            );
          },
        }
      );
    } else {
      startTimer.mutate(
        { title: initialTask.title, taskId: initialTask.id, projectId: initialTask.projectId },
        { onSuccess: () => toast({ title: 'Timer started' }) }
      );
    }
  };

  const handleAddManualTime = () => {
    const hours = parseInt(manualTimeHours) || 0;
    const minutes = parseInt(manualTimeMinutes) || 0;
    const durationMinutes = hours * 60 + minutes;

    if (!manualTimeTitle.trim() || durationMinutes === 0) {
      toast({ title: 'Please enter a title and duration', variant: 'destructive' });
      return;
    }

    createTimeEntry.mutate(
      {
        title: manualTimeTitle.trim(),
        description: manualTimeDescription.trim() || undefined,
        durationMinutes,
        taskId: initialTask.id,
        projectId: initialTask.projectId,
      },
      {
        onSuccess: () => {
          toast({ title: 'Time entry added' });
          setManualTimeTitle('');
          setManualTimeDescription('');
          setManualTimeHours('');
          setManualTimeMinutes('');
          setIsAddingTime(false);
          queryClient.invalidateQueries({ queryKey: ['tasks', initialTask.id] });
        },
      }
    );
  };

  const handleDeleteTimeEntry = (entryId: string) => {
    deleteTimeEntry.mutate(entryId, {
      onSuccess: () => {
        toast({ title: 'Time entry deleted' });
        queryClient.invalidateQueries({ queryKey: ['tasks', initialTask.id] });
      },
    });
  };

  const { data: fetchedTask } = useQuery({
    queryKey: ['tasks', initialTask.id],
    queryFn: () => tasksApi.get(initialTask.id),
    staleTime: 0, // Always refetch to get latest activities
  });

  // Use fetched task if available, otherwise fall back to initial task
  const task = fetchedTask ?? initialTask;

  const { data: allUsers } = useQuery({
    queryKey: ['users'],
    queryFn: users.list,
    enabled: isAdmin,
  });

  const { data: allRoles } = useQuery({
    queryKey: ['roles'],
    queryFn: rolesApi.list,
  });

  // Subtask mutations
  const createSubtask = useMutation({
    mutationFn: (title: string) => subtasksApi.create(task.id, { title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', task.id] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setNewSubtaskTitle('');
      setIsAddingSubtask(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create subtask', description: error.message, variant: 'destructive' });
      setIsAddingSubtask(false);
    },
  });

  const updateSubtask = useMutation({
    mutationFn: ({ subtaskId, data }: { subtaskId: string; data: { title?: string; completed?: boolean } }) =>
      subtasksApi.update(task.id, subtaskId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', task.id] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update subtask', description: error.message, variant: 'destructive' });
    },
  });

  const deleteSubtask = useMutation({
    mutationFn: (subtaskId: string) => subtasksApi.delete(task.id, subtaskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', task.id] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete subtask', description: error.message, variant: 'destructive' });
    },
  });

  // Comment mutations
  const createComment = useMutation({
    mutationFn: (content: string) => commentsApi.create(task.id, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', task.id] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setNewComment('');
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to post comment', description: error.message, variant: 'destructive' });
    },
  });

  const deleteComment = useMutation({
    mutationFn: (commentId: string) => commentsApi.delete(task.id, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', task.id] });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete comment', description: error.message, variant: 'destructive' });
    },
  });

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [priority, setPriority] = useState<TaskPriority>(task.priority || 'medium');
  const [selectedRoleId, setSelectedRoleId] = useState<string>(task.roleId || '');
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>(
    task.assignees?.map(a => a.userId) || []
  );
  const [dueDate, setDueDate] = useState(task.dueDate?.split('T')[0] || '');
  const [editedTags, setEditedTags] = useState<string[]>(task.tags || []);
  const [newTagInput, setNewTagInput] = useState('');

  // Track if component mounted to prevent auto-save on initial render
  const [mounted, setMounted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-save with debounce
  const doSave = useCallback(() => {
    if (!mounted) return;

    const currentAssigneeIds = task.assignees?.map(a => a.userId) || [];
    const assigneesChanged =
      selectedAssigneeIds.length !== currentAssigneeIds.length ||
      selectedAssigneeIds.some(id => !currentAssigneeIds.includes(id));

    const currentTags = task.tags || [];
    const tagsChanged =
      editedTags.length !== currentTags.length ||
      editedTags.some(tag => !currentTags.includes(tag));

    const hasChanges =
      title !== task.title ||
      description !== (task.description || '') ||
      status !== task.status ||
      priority !== (task.priority || 'medium') ||
      selectedRoleId !== (task.roleId || '') ||
      assigneesChanged ||
      tagsChanged ||
      dueDate !== (task.dueDate?.split('T')[0] || '');

    if (!hasChanges) return;

    setIsSaving(true);
    updateTask.mutate(
      {
        id: task.id,
        data: {
          title,
          description: description || undefined,
          status,
          priority,
          roleId: selectedRoleId || null,
          assigneeIds: selectedAssigneeIds,
          tags: editedTags,
          dueDate: dueDate || undefined,
        },
      },
      {
        onSettled: () => {
          setIsSaving(false);
        },
      }
    );
  }, [task, title, description, status, priority, selectedRoleId, selectedAssigneeIds, editedTags, dueDate, updateTask, mounted]);

  // Auto-save on blur or after 1.5s of no typing
  useEffect(() => {
    if (!mounted) return;
    const timer = setTimeout(() => {
      doSave();
    }, 1500);
    return () => clearTimeout(timer);
  }, [title, description, status, priority, selectedRoleId, selectedAssigneeIds, editedTags, dueDate, doSave, mounted]);

  const totalTimeMinutes = task.timeEntries?.reduce((sum, e) => sum + (e.durationMinutes || 0), 0) || 0;

  const quickDates = [
    { label: 'Today', value: getQuickDate(0) },
    { label: 'Tomorrow', value: getQuickDate(1) },
    { label: 'Next Week', value: getQuickDate(7) },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-white shadow-2xl border-l z-50 flex flex-col animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-50/50">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-lg">Task Details</h2>
            {isSaving && (
              <span className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                Saving...
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Timer Button */}
            <Button
              variant={isTimerRunningForTask ? 'default' : 'outline'}
              size="sm"
              className={cn(
                'h-9 px-3 gap-2 font-medium transition-all',
                isTimerRunningForTask
                  ? 'bg-[var(--theme-accent)] hover:bg-[var(--theme-primary)] text-white shadow-md'
                  : 'hover:bg-slate-100 hover:border-[var(--theme-primary)]/30'
              )}
              onClick={handleTimerToggle}
            >
              {isTimerRunningForTask ? (
                <>
                  <Square className="h-3.5 w-3.5" />
                  <span className="tabular-nums">{formatDuration(timerDuration)}</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" />
                  <span>Start Timer</span>
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="hover:bg-slate-200 rounded-full transition-colors"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={doSave}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={doSave}
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todo">To Do</SelectItem>
                <SelectItem value="in_review">In Review</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
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
        </div>

        {/* Assigned Role */}
        <div className="space-y-2">
          <Label>Assigned Role</Label>
          <Select value={selectedRoleId || 'none'} onValueChange={(v) => setSelectedRoleId(v === 'none' ? '' : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select a role..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No role</SelectItem>
              {allRoles?.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: role.color }}
                    />
                    {role.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedRoleId && allRoles && (
            <p className="text-xs text-muted-foreground">
              All contractors with this role will be assigned to this task
            </p>
          )}
        </div>

        {/* Additional Assignees */}
        <div className="space-y-2">
          <Label>Additional Assignees</Label>
          <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
            {allUsers?.filter(u => u.active && !u.archived).map((user) => (
              <div key={user.id} className="flex items-center gap-2">
                <Checkbox
                  id={`assignee-${user.id}`}
                  checked={selectedAssigneeIds.includes(user.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedAssigneeIds(prev => [...prev, user.id]);
                    } else {
                      setSelectedAssigneeIds(prev => prev.filter(id => id !== user.id));
                    }
                  }}
                />
                <label
                  htmlFor={`assignee-${user.id}`}
                  className="flex items-center gap-2 text-sm cursor-pointer flex-1"
                >
                  <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size="sm" />
                  {user.name}
                </label>
              </div>
            ))}
            {(!allUsers || allUsers.filter(u => u.active && !u.archived).length === 0) && (
              <p className="text-sm text-muted-foreground">No users available</p>
            )}
          </div>
          {selectedAssigneeIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {selectedAssigneeIds.map(id => {
                const user = allUsers?.find(u => u.id === id);
                return user ? (
                  <Badge key={id} variant="secondary" className="flex items-center gap-1 pr-1">
                    {user.name}
                    <button
                      type="button"
                      onClick={() => setSelectedAssigneeIds(prev => prev.filter(i => i !== id))}
                      className="ml-1 hover:bg-slate-300 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ) : null;
              })}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="dueDate">Due Date</Label>
          <div className="flex gap-2 mb-2">
            {quickDates.map((qd) => (
              <Button
                key={qd.label}
                type="button"
                variant={dueDate === qd.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDueDate(qd.value)}
                className="text-xs"
              >
                <Calendar className="h-3 w-3 mr-1" />
                {qd.label}
              </Button>
            ))}
            {dueDate && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDueDate('')}
                className="text-xs text-muted-foreground"
              >
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
          </div>
          <Input
            id="dueDate"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        {/* Client Info */}
        {task.project?.client && (
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <h4 className="font-medium text-sm">Client</h4>
            <p className="font-semibold">{task.project.client.name}</p>
            {task.project.client.email && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-3 w-3" />
                <span data-sensitive>{task.project.client.email}</span>
              </div>
            )}
            {task.project.client.phone && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-3 w-3" />
                <span data-sensitive>{task.project.client.phone}</span>
              </div>
            )}
          </div>
        )}

        {/* Tags */}
        <div className="space-y-2">
          <Label>Tags</Label>
          <div className="flex flex-wrap gap-2">
            {editedTags.map((tag) => (
              <Badge key={tag} className={cn(getTagColor(tag), 'pr-1')} variant="secondary">
                {tag}
                <button
                  type="button"
                  onClick={() => setEditedTags(prev => prev.filter(t => t !== tag))}
                  className="ml-1 hover:bg-black/10 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Add a tag..."
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newTagInput.trim()) {
                  e.preventDefault();
                  const tag = newTagInput.trim().toLowerCase();
                  if (!editedTags.includes(tag)) {
                    setEditedTags(prev => [...prev, tag]);
                  }
                  setNewTagInput('');
                }
              }}
              className="h-8 text-sm"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              disabled={!newTagInput.trim()}
              onClick={() => {
                const tag = newTagInput.trim().toLowerCase();
                if (tag && !editedTags.includes(tag)) {
                  setEditedTags(prev => [...prev, tag]);
                }
                setNewTagInput('');
              }}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          </div>
        </div>

        {/* Subtasks / Checklist */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4" />
              Subtasks
              {task.subtasks && task.subtasks.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  ({task.subtasks.filter(s => s.completed).length}/{task.subtasks.length})
                </span>
              )}
            </Label>
            {!isAddingSubtask && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setIsAddingSubtask(true)}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            )}
          </div>

          {/* Progress bar */}
          {task.subtasks && task.subtasks.length > 0 && (
            <div className="w-full bg-slate-100 rounded-full h-1.5">
              <div
                className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: `${(task.subtasks.filter(s => s.completed).length / task.subtasks.length) * 100}%`
                }}
              />
            </div>
          )}

          {/* Subtask list */}
          <div className="space-y-1">
            {task.subtasks?.map((subtask) => (
              <div
                key={subtask.id}
                className="flex items-center gap-2 group p-2 -mx-2 rounded hover:bg-slate-50"
              >
                <Checkbox
                  checked={subtask.completed}
                  onCheckedChange={(checked: boolean | 'indeterminate') => {
                    updateSubtask.mutate({
                      subtaskId: subtask.id,
                      data: { completed: checked === true }
                    });
                  }}
                />
                <span
                  className={cn(
                    'flex-1 text-sm',
                    subtask.completed && 'line-through text-muted-foreground'
                  )}
                >
                  {subtask.title}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  onClick={() => deleteSubtask.mutate(subtask.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>

          {/* Add subtask input */}
          {isAddingSubtask && (
            <div className="flex items-center gap-2">
              <Input
                placeholder="New subtask..."
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newSubtaskTitle.trim()) {
                    createSubtask.mutate(newSubtaskTitle.trim());
                  }
                  if (e.key === 'Escape') {
                    setIsAddingSubtask(false);
                    setNewSubtaskTitle('');
                  }
                }}
                autoFocus
                className="h-8 text-sm"
              />
              <Button
                size="sm"
                className="h-8"
                disabled={!newSubtaskTitle.trim() || createSubtask.isPending}
                onClick={() => {
                  if (newSubtaskTitle.trim()) {
                    createSubtask.mutate(newSubtaskTitle.trim());
                  }
                }}
              >
                Add
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => {
                  setIsAddingSubtask(false);
                  setNewSubtaskTitle('');
                }}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>

        {/* Time Log Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Timer className="h-4 w-4" />
              Time Log
              {totalTimeMinutes > 0 && (
                <Badge variant="secondary" className="ml-1 font-mono">
                  {formatDuration(totalTimeMinutes)}
                </Badge>
              )}
            </Label>
            {!isAddingTime && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setIsAddingTime(true)}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Time
              </Button>
            )}
          </div>

          {/* Add manual time entry form */}
          {isAddingTime && (
            <div className="bg-slate-50 rounded-lg p-4 space-y-3 border">
              <div className="space-y-2">
                <Label className="text-xs">What did you work on?</Label>
                <Input
                  placeholder="e.g., Reviewed client feedback..."
                  value={manualTimeTitle}
                  onChange={(e) => setManualTimeTitle(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Description (optional)</Label>
                <Textarea
                  placeholder="Add more details..."
                  value={manualTimeDescription}
                  onChange={(e) => setManualTimeDescription(e.target.value)}
                  rows={2}
                  className="text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Hours</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={manualTimeHours}
                    onChange={(e) => setManualTimeHours(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Minutes</Label>
                  <Input
                    type="number"
                    min="0"
                    max="59"
                    placeholder="0"
                    value={manualTimeMinutes}
                    onChange={(e) => setManualTimeMinutes(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  className="flex-1"
                  disabled={createTimeEntry.isPending}
                  onClick={handleAddManualTime}
                >
                  {createTimeEntry.isPending ? 'Adding...' : 'Add Entry'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsAddingTime(false);
                    setManualTimeTitle('');
                    setManualTimeDescription('');
                    setManualTimeHours('');
                    setManualTimeMinutes('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Time entries list */}
          <div className="space-y-2">
            {task.timeEntries && task.timeEntries.length > 0 ? (
              task.timeEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg group hover:bg-slate-100 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                    <Clock className="h-4 w-4 text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">{entry.title}</p>
                        {entry.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {entry.description}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {entry.user?.name && <span>{entry.user.name} · </span>}
                          {formatDate(entry.startTime || entry.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono font-semibold text-sm">
                          {formatDuration(entry.durationMinutes || 0)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteTimeEntry(entry.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              !isAddingTime && (
                <div className="text-center py-6 text-muted-foreground border border-dashed rounded-lg">
                  <Clock className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm">No time logged yet</p>
                  <p className="text-xs mt-1">Use the timer or add time manually</p>
                </div>
              )
            )}
          </div>
        </div>

        {/* Comments */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Comments
            {task.comments && task.comments.length > 0 && (
              <span className="text-xs text-muted-foreground">({task.comments.length})</span>
            )}
          </Label>

          {/* Add comment input */}
          <div className="space-y-2">
            <MentionInput
              value={newComment}
              onChange={setNewComment}
              onSubmit={() => {
                if (newComment.trim()) {
                  createComment.mutate(newComment.trim());
                }
              }}
              placeholder="Add a comment... Use @name to mention someone"
              className="text-sm"
              disabled={createComment.isPending}
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                disabled={!newComment.trim() || createComment.isPending}
                onClick={() => {
                  if (newComment.trim()) {
                    createComment.mutate(newComment.trim());
                  }
                }}
              >
                <Send className="h-4 w-4 mr-2" />
                Send
              </Button>
            </div>
          </div>

          {/* Comments list */}
          <div className="space-y-3">
            {(() => {
              const allComments = task.comments || [];
              const totalComments = allComments.length;
              const displayedComments = showAllComments
                ? allComments
                : allComments.slice(-5); // Show last 5 (most recent)

              return (
                <>
                  {totalComments > 5 && !showAllComments && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-muted-foreground hover:text-foreground"
                      onClick={() => setShowAllComments(true)}
                    >
                      View all {totalComments} comments
                    </Button>
                  )}
                  {displayedComments.map((comment) => (
                    <div key={comment.id} className="flex gap-3 group">
                      <UserAvatar
                        name={comment.user?.name || '?'}
                        avatarUrl={comment.user?.avatarUrl}
                        size="sm"
                        className="shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{comment.user?.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(comment.createdAt)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
                            onClick={() => deleteComment.mutate(comment.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <p
                          className="text-sm text-muted-foreground whitespace-pre-wrap"
                          dangerouslySetInnerHTML={{ __html: sanitizeText(comment.content) }}
                        />
                      </div>
                    </div>
                  ))}
                  {totalComments > 5 && showAllComments && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-muted-foreground hover:text-foreground"
                      onClick={() => setShowAllComments(false)}
                    >
                      Show less
                    </Button>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        {/* Activity Log - Only visible to PM and admin */}
        {isProjectManager && task.activities && task.activities.length > 0 && (
          <div className="space-y-3 pt-4 border-t">
            <Label className="text-muted-foreground">Activity Log</Label>
            <div className="space-y-2">
              {task.activities.slice(0, 20).map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-2 text-xs text-muted-foreground py-1"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 shrink-0" />
                  <span>
                    <span className="font-medium text-foreground">
                      {activity.user?.name || 'System'}
                    </span>
                    {' '}{formatActivityAction(activity.action, activity.details)}
                    <span className="text-slate-400 ml-1">
                      · {formatDate(activity.createdAt)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
