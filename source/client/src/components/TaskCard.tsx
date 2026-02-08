import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/UserAvatar';
import { cn, formatDate, getTagColor, isOverdue, formatDuration } from '@/lib/utils';
import { Calendar, AlertTriangle, GripVertical, Flag, Play, Square } from 'lucide-react';
import { useRunningTimer, useStartTimer, useStopTimer } from '@/hooks/useTimeEntries';
import { toast } from '@/components/ui/toaster';
import type { Task, TaskPriority } from '@/lib/types';

interface TaskCardProps {
  task: Task;
  isDragging?: boolean;
  onClick?: () => void;
  'data-guide'?: string;
}

const priorityConfig: Record<TaskPriority, { color: string; bgColor: string; borderColor: string; label: string }> = {
  urgent: { color: 'text-red-400', bgColor: 'bg-red-500/10', borderColor: 'border-l-red-500', label: 'Urgent' },
  high: { color: 'text-orange-400', bgColor: 'bg-orange-500/10', borderColor: 'border-l-orange-500', label: 'High' },
  medium: { color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-l-blue-500', label: 'Medium' },
  low: { color: 'text-white/50', bgColor: 'bg-white/[0.03]', borderColor: 'border-l-white/[0.12]', label: 'Low' },
};

// Tag border colors matching the tag badge colors
const tagBorderColors: Record<string, string> = {
  web: 'border-l-red-400',
  admin: 'border-l-yellow-400',
  gbp: 'border-l-green-400',
  ads: 'border-l-blue-400',
};

function getTagBorderColor(tags: string[]): string {
  if (tags.length === 0) return 'border-l-white/[0.12]';
  const firstTag = tags[0].toLowerCase();
  return tagBorderColors[firstTag] || 'border-l-white/[0.12]';
}

function SegmentedProgressBar({
  total,
  completed
}: {
  total: number;
  completed: number;
}) {
  if (total === 0) return null;

  return (
    <div className="flex gap-0.5 h-1.5 min-w-[40px] max-w-[60px]">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "flex-1 rounded-sm transition-colors",
            i < completed ? "bg-green-500" : "bg-white/[0.08]"
          )}
        />
      ))}
    </div>
  );
}

export function TaskCard({ task, isDragging, onClick, 'data-guide': dataGuide }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    touchAction: 'none' as const,
  };

  // Time tracking
  const { data: runningTimer } = useRunningTimer();
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();

  const isTimerRunningForTask = runningTimer?.taskId === task.id;
  const timerDuration = isTimerRunningForTask && runningTimer?.startTime
    ? Math.floor((Date.now() - new Date(runningTimer.startTime).getTime()) / 60000)
    : 0;

  const handleTimerToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isTimerRunningForTask && runningTimer) {
      stopTimer.mutate(
        { id: runningTimer.id, data: { taskId: task.id, projectId: task.projectId } },
        {
          onSuccess: () => toast({ title: 'Timer stopped' }),
        }
      );
    } else if (runningTimer) {
      // Stop existing timer first, then start new one
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

  const overdue = task.dueDate && task.status !== 'completed' && isOverdue(task.dueDate);
  const priority = task.priority || 'medium';
  const priorityStyle = priorityConfig[priority];
  const showPriorityIndicator = priority === 'high' || priority === 'urgent';

  const isCompleted = task.status === 'completed';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      data-guide={dataGuide}
      className={cn(
        'glass-card !rounded-lg cursor-pointer group border-l-4',
        'transition-all duration-200 ease-out',
        'hover:-translate-y-1',
        (isDragging || isSortableDragging) && 'opacity-60 shadow-xl rotate-2 scale-105 z-50',
        getTagBorderColor(task.tags),
        isCompleted && 'opacity-60',
        isTimerRunningForTask && 'ring-2 ring-[var(--theme-accent)]/30'
      )}
    >
      {/* Drag handle indicator */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <GripVertical className="h-4 w-4 text-white/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 shrink-0 cursor-grab active:cursor-grabbing" />
        <div className="flex-1 min-w-0">
          <h4 className={cn(
            'font-medium text-sm line-clamp-2 leading-tight transition-colors',
            isCompleted && 'line-through text-white/60'
          )}>
            {task.title}
          </h4>
        </div>
        {showPriorityIndicator && (
          <div className={cn(
            'p-1 rounded-full transition-colors',
            priority === 'urgent' && 'bg-red-500/15 animate-pulse',
            priority === 'high' && 'bg-orange-500/15'
          )}>
            <Flag className={cn('h-3.5 w-3.5 shrink-0', priorityStyle.color)} />
          </div>
        )}
      </div>

      <div className="px-3 pb-3 space-y-3">
        {task.project?.client?.name && (
          <p className="text-xs text-white/60 truncate">
            {task.project.client.name}
            {task.project?.name && <span className="text-white/30"> / </span>}
            {task.project?.name && <span>{task.project.name}</span>}
          </p>
        )}

        {(task.tags.length > 0 || task.assignedRole || (task.subtasks && task.subtasks.length > 0)) && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1">
              {task.assignedRole && (
                <Badge
                  className="text-xs px-1.5 py-0 text-white"
                  style={{ backgroundColor: task.assignedRole.color }}
                >
                  {task.assignedRole.name}
                </Badge>
              )}
              {task.tags.map((tag) => (
                <Badge key={tag} className={cn('text-xs px-1.5 py-0', getTagColor(tag))} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
            {task.subtasks && task.subtasks.length > 0 && (
              <SegmentedProgressBar
                total={task.subtasks.length}
                completed={task.subtasks.filter(s => s.completed).length}
              />
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-1 border-t border-white/[0.06]">
          <div className="flex items-center gap-2">
            {task.assignees && task.assignees.length > 0 ? (
              <div className="flex -space-x-2">
                {task.assignees.slice(0, 3).map((assignee) => (
                  <UserAvatar
                    key={assignee.id}
                    name={assignee.user?.name || '?'}
                    avatarUrl={assignee.user?.avatarUrl}
                    size="sm"
                    className="ring-2 ring-white/10"
                  />
                ))}
                {task.assignees.length > 3 && (
                  <div className="h-6 w-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-medium ring-2 ring-white/10">
                    +{task.assignees.length - 3}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-6 w-6 rounded-full border-2 border-dashed border-white/15" />
            )}
            {/* Timer Button */}
            <Button
              variant={isTimerRunningForTask ? 'default' : 'ghost'}
              size="sm"
              className={cn(
                'h-6 px-2 text-xs transition-all duration-200',
                isTimerRunningForTask
                  ? 'bg-[var(--theme-accent)] hover:bg-[var(--theme-primary)] shadow-sm shadow-[var(--theme-accent)]/25'
                  : 'opacity-0 group-hover:opacity-100 hover:bg-white/[0.06]'
              )}
              onClick={handleTimerToggle}
            >
              {isTimerRunningForTask ? (
                <>
                  <Square className="h-3 w-3 mr-1" />
                  <span className="font-mono">{formatDuration(timerDuration)}</span>
                </>
              ) : (
                <>
                  <Play className="h-3 w-3 mr-1" />
                  Start
                </>
              )}
            </Button>
          </div>
          {task.dueDate && (
            <div
              className={cn(
                'flex items-center gap-1 text-xs px-2 py-0.5 rounded',
                overdue
                  ? 'text-red-400 bg-red-500/10 font-medium'
                  : 'text-white/60 bg-white/[0.03]'
              )}
            >
              {overdue && <AlertTriangle className="h-3 w-3" />}
              <Calendar className="h-3 w-3" />
              {formatDate(task.dueDate)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { priorityConfig };
