import { useState, useRef, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserAvatar } from '@/components/UserAvatar';
import { cn, formatDate, getTagColor, isOverdue, formatDuration } from '@/lib/utils';
import { Calendar, AlertTriangle, ChevronRight, Play, Square } from 'lucide-react';
import { useRunningTimer, useStartTimer, useStopTimer } from '@/hooks/useTimeEntries';
import { toast } from '@/components/ui/toaster';
import type { Task, TaskStatus } from '@/lib/types';

// Store column widths outside component to persist across renders
const storedColumnWidths = {
  task: 280,
  progress: 120,
  tags: 120,
  status: 120,
  dueDate: 120,
  assignee: 100,
  timer: 100,
};

// Column order for adjacent resize logic
const columnOrder = ['task', 'progress', 'tags', 'status', 'dueDate', 'assignee', 'timer'] as const;

interface TaskListViewProps {
  tasks: Task[];
  onTaskClick: (taskId: string) => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
}

const statusOptions: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_review', label: 'In Review' },
  { value: 'completed', label: 'Completed' },
];

export function TaskListView({ tasks, onTaskClick, onStatusChange }: TaskListViewProps) {
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [columnWidths, setColumnWidths] = useState(storedColumnWidths);
  const [resizing, setResizing] = useState<string | null>(null);
  const startX = useRef(0);
  const startLeftWidth = useRef(0);
  const startRightWidth = useRef(0);
  const rightColumn = useRef<string | null>(null);

  // Time tracking hooks
  const { data: runningTimer } = useRunningTimer();
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();

  // Column resize handlers
  const handleMouseDown = (e: React.MouseEvent, column: string) => {
    e.preventDefault();
    const colIndex = columnOrder.indexOf(column as typeof columnOrder[number]);
    const nextCol = columnOrder[colIndex + 1];
    if (!nextCol) return;

    setResizing(column);
    startX.current = e.clientX;
    startLeftWidth.current = columnWidths[column as keyof typeof columnWidths];
    startRightWidth.current = columnWidths[nextCol as keyof typeof columnWidths];
    rightColumn.current = nextCol;
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizing || !rightColumn.current) return;
      const diff = e.clientX - startX.current;

      const newLeftWidth = Math.max(60, startLeftWidth.current + diff);
      const newRightWidth = Math.max(60, startRightWidth.current - diff);

      if (newLeftWidth >= 60 && newRightWidth >= 60) {
        setColumnWidths(prev => {
          const updated = {
            ...prev,
            [resizing]: newLeftWidth,
            [rightColumn.current!]: newRightWidth
          };
          Object.assign(storedColumnWidths, updated);
          return updated;
        });
      }
    };

    const handleMouseUp = () => {
      setResizing(null);
      rightColumn.current = null;
    };

    if (resizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing]);

  const ResizeHandle = ({ column }: { column: string }) => (
    <div
      className="absolute right-0 top-0 bottom-0 flex items-center cursor-col-resize group"
      onMouseDown={(e) => handleMouseDown(e, column)}
    >
      <div className="w-px h-4 bg-white/40" />
      <div
        className={cn(
          "absolute -left-1 -right-1 top-0 bottom-0 transition-colors",
          resizing === column ? "bg-white/20" : "group-hover:bg-white/10"
        )}
      />
    </div>
  );

  const handleTimerToggle = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    const isTimerRunningForTask = runningTimer?.taskId === task.id;

    if (isTimerRunningForTask && runningTimer) {
      stopTimer.mutate(
        { id: runningTimer.id, data: { taskId: task.id, projectId: task.projectId } },
        { onSuccess: () => toast({ title: 'Timer stopped' }) }
      );
    } else if (runningTimer) {
      stopTimer.mutate(
        { id: runningTimer.id },
        {
          onSuccess: () => {
            startTimer.mutate(
              { title: task.title, taskId: task.id, projectId: task.projectId },
              { onSuccess: () => toast({ title: 'Timer started' }) }
            );
          },
        }
      );
    } else {
      startTimer.mutate(
        { title: task.title, taskId: task.id, projectId: task.projectId },
        { onSuccess: () => toast({ title: 'Timer started' }) }
      );
    }
  };

  const getTimerDuration = (taskId: string) => {
    if (runningTimer?.taskId === taskId && runningTimer?.startTime) {
      return Math.floor((Date.now() - new Date(runningTimer.startTime).getTime()) / 60000);
    }
    return 0;
  };

  // Group tasks by client
  const tasksByClient = tasks.reduce((acc, task) => {
    const clientName = task.project?.client?.name || 'No Client';
    if (!acc[clientName]) {
      acc[clientName] = [];
    }
    acc[clientName].push(task);
    return acc;
  }, {} as Record<string, Task[]>);

  const toggleClient = (clientName: string) => {
    setExpandedClients((prev) => {
      const next = new Set(prev);
      if (next.has(clientName)) {
        next.delete(clientName);
      } else {
        next.add(clientName);
      }
      return next;
    });
  };

  // Start with all clients expanded - Set tracks COLLAPSED clients
  const isExpanded = (clientName: string) =>
    !expandedClients.has(clientName);

  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      <table className="w-full md:table-fixed">
        {/* Colgroup only on desktop - mobile uses auto layout */}
        <colgroup className="hidden md:table-column-group">
          <col style={{ width: columnWidths.task }} />
          <col style={{ width: columnWidths.progress }} />
          <col style={{ width: columnWidths.tags }} />
          <col style={{ width: columnWidths.status }} />
          <col style={{ width: columnWidths.dueDate }} />
          <col style={{ width: columnWidths.assignee }} />
          <col style={{ width: columnWidths.timer }} />
        </colgroup>
        <colgroup className="md:hidden">
          <col style={{ width: '100%' }} />
        </colgroup>
        <thead>
          <tr className="bg-[var(--theme-primary-dark)]">
            <th className="text-center px-4 py-3 text-xs font-semibold text-white uppercase tracking-wider relative">
              Task
              <ResizeHandle column="task" />
            </th>
            <th className="text-center px-4 py-3 text-xs font-semibold text-white uppercase tracking-wider relative hidden md:table-cell">
              Progress
              <ResizeHandle column="progress" />
            </th>
            <th className="text-center px-4 py-3 text-xs font-semibold text-white uppercase tracking-wider relative hidden md:table-cell">
              Tags
              <ResizeHandle column="tags" />
            </th>
            <th className="text-center px-4 py-3 text-xs font-semibold text-white uppercase tracking-wider relative hidden md:table-cell">
              Status
              <ResizeHandle column="status" />
            </th>
            <th className="text-center px-4 py-3 text-xs font-semibold text-white uppercase tracking-wider relative hidden md:table-cell">
              Due Date
              <ResizeHandle column="dueDate" />
            </th>
            <th className="text-center px-4 py-3 text-xs font-semibold text-white uppercase tracking-wider relative hidden md:table-cell">
              Assignee
              <ResizeHandle column="assignee" />
            </th>
            <th className="text-center px-4 py-3 text-xs font-semibold text-white uppercase tracking-wider hidden md:table-cell">
              Timer
            </th>
          </tr>
        </thead>
        <tbody>
          {/* Task Groups */}
          {Object.entries(tasksByClient).map(([clientName, clientTasks]) => (
            <>
              {/* Client Header */}
              <tr key={`header-${clientName}`}>
                <td colSpan={7} className="p-0">
                  <button
                    className="w-full flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-slate-50 to-transparent border-b hover:from-slate-100 transition-all text-left group"
                    onClick={() => toggleClient(clientName)}
                  >
                    <div className={cn(
                      "transition-transform duration-200",
                      isExpanded(clientName) && "rotate-90"
                    )}>
                      <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600" />
                    </div>
                    <span className="font-semibold text-sm text-slate-700">{clientName}</span>
                    <Badge variant="secondary" className="text-xs bg-slate-200/50 text-slate-600">
                      {clientTasks.length} task{clientTasks.length !== 1 ? 's' : ''}
                    </Badge>
                  </button>
                </td>
              </tr>

              {/* Tasks */}
              {isExpanded(clientName) && clientTasks.map((task) => {
                const overdue = task.dueDate && task.status !== 'completed' && isOverdue(task.dueDate);

                return (
                  <tr
                    key={task.id}
                    className={cn(
                      'border-b last:border-b-0 hover:bg-blue-50/50 cursor-pointer transition-all duration-150 group',
                      task.status === 'completed' && 'bg-slate-50/50',
                      runningTimer?.taskId === task.id && 'bg-[var(--theme-accent)]/5 ring-1 ring-inset ring-[var(--theme-accent)]/20'
                    )}
                    onClick={() => onTaskClick(task.id)}
                  >
                    {/* Task Title */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Checkbox
                          checked={task.status === 'completed'}
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            onStatusChange(task.id, task.status === 'completed' ? 'todo' : 'completed');
                          }}
                          className="shrink-0"
                        />
                        <div className="min-w-0">
                          <p
                            className={cn(
                              'font-medium text-sm truncate',
                              task.status === 'completed' && 'line-through text-muted-foreground'
                            )}
                          >
                            {task.title}
                          </p>
                          {task.project?.name && (
                            <p className="text-xs text-muted-foreground truncate">
                              {task.project.name}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Progress - hidden on mobile */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      {(() => {
                        const subtasks = task.subtasks || [];
                        const total = subtasks.length;
                        const completed = subtasks.filter(s => s.completed).length;
                        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

                        if (total === 0) {
                          return <span className="text-xs text-muted-foreground">—</span>;
                        }

                        return (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all duration-300",
                                  percentage === 100
                                    ? "bg-green-500"
                                    : percentage >= 50
                                    ? "bg-[var(--theme-accent)]"
                                    : "bg-amber-500"
                                )}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-slate-600 w-10 text-right">
                              {percentage}%
                            </span>
                          </div>
                        );
                      })()}
                    </td>

                    {/* Tags - hidden on mobile */}
                    <td className="px-4 py-3 overflow-hidden hidden md:table-cell">
                      <div className="flex items-center gap-1 flex-wrap">
                        {task.tags.length > 0 ? (
                          <>
                            {task.tags.slice(0, 2).map((tag) => (
                              <Badge
                                key={tag}
                                className={cn('text-xs px-1.5 py-0', getTagColor(tag))}
                                variant="secondary"
                              >
                                {tag}
                              </Badge>
                            ))}
                            {task.tags.length > 2 && (
                              <Badge variant="outline" className="text-xs px-1.5 py-0">
                                +{task.tags.length - 2}
                              </Badge>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>

                    {/* Status - hidden on mobile */}
                    <td className="px-4 py-3 hidden md:table-cell" onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={task.status}
                        onValueChange={(v) => onStatusChange(task.id, v as TaskStatus)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>

                    {/* Due Date - hidden on mobile */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div
                        className={cn(
                          'flex items-center gap-1 text-xs',
                          overdue ? 'text-red-600 font-medium' : 'text-muted-foreground'
                        )}
                      >
                        {task.dueDate && (
                          <>
                            {overdue && <AlertTriangle className="h-3 w-3" />}
                            <Calendar className="h-3 w-3" />
                            {formatDate(task.dueDate)}
                          </>
                        )}
                      </div>
                    </td>

                    {/* Assignees - hidden on mobile */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex items-center">
                        {task.assignees && task.assignees.length > 0 ? (
                          <div className="flex -space-x-2">
                            {task.assignees.slice(0, 3).map((assignee) => (
                              <UserAvatar
                                key={assignee.id}
                                name={assignee.user?.name || '?'}
                                avatarUrl={assignee.user?.avatarUrl}
                                size="sm"
                                className="ring-2 ring-white"
                              />
                            ))}
                            {task.assignees.length > 3 && (
                              <div className="h-6 w-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium ring-2 ring-white">
                                +{task.assignees.length - 3}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="h-6 w-6 rounded-full border-2 border-dashed border-slate-200" />
                        )}
                      </div>
                    </td>

                    {/* Timer - hidden on mobile */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex items-center">
                        <Button
                          variant={runningTimer?.taskId === task.id ? 'default' : 'ghost'}
                          size="sm"
                          className={cn(
                            'h-7 px-2 text-xs',
                            runningTimer?.taskId === task.id && 'bg-[var(--theme-accent)] hover:bg-[var(--theme-primary)]'
                          )}
                          onClick={(e) => handleTimerToggle(task, e)}
                        >
                          {runningTimer?.taskId === task.id ? (
                            <>
                              <Square className="h-3 w-3 mr-1" />
                              {formatDuration(getTimerDuration(task.id))}
                            </>
                          ) : (
                            <>
                              <Play className="h-3 w-3 mr-1" />
                              Start
                            </>
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </>
          ))}
        </tbody>
      </table>

      {tasks.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
            <Calendar className="h-8 w-8 text-slate-400" />
          </div>
          <p className="text-muted-foreground font-medium">No tasks found</p>
          <p className="text-sm text-slate-400 mt-1">Try adjusting your filters</p>
        </div>
      )}
    </div>
  );
}
