import { useState, useRef, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';
import type { TaskStatus } from '@/lib/types';

interface KanbanColumnProps {
  id: TaskStatus;
  title: string;
  count: number;
  children: React.ReactNode;
  onAddTask?: (title: string, status: TaskStatus) => void;
  isActiveDropTarget?: boolean;
  headerAction?: React.ReactNode;
}

export function KanbanColumn({ id, title, count, children, onAddTask, isActiveDropTarget, headerAction }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const showHighlight = isOver || isActiveDropTarget;
  const [isAdding, setIsAdding] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  const handleSubmit = () => {
    if (newTaskTitle.trim() && onAddTask) {
      onAddTask(newTaskTitle.trim(), id);
      setNewTaskTitle('');
      // Keep input open for rapid task entry
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newTaskTitle.trim()) {
      handleSubmit();
    } else if (e.key === 'Escape') {
      setIsAdding(false);
      setNewTaskTitle('');
    }
  };

  const handleBlur = () => {
    if (!newTaskTitle.trim()) {
      setIsAdding(false);
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex-shrink-0 w-80 flex flex-col transition-all duration-200',
        showHighlight && 'scale-[1.02]'
      )}
    >
      <div className={cn(
        'bg-[var(--theme-primary-dark)] rounded-t-xl p-3 transition-all duration-200',
        showHighlight && 'shadow-md brightness-125'
      )}>
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-xs font-bold px-2 py-0.5 rounded transition-colors duration-200',
            count > 0 ? 'bg-white/20 text-white' : 'bg-white/10 text-white/60'
          )}>
            {count}
          </span>
          <h3 className="font-semibold text-sm text-white uppercase tracking-wide">{title}</h3>
          {headerAction && <div className="ml-auto">{headerAction}</div>}
        </div>
      </div>

      <div
        className={cn(
          'flex-1 bg-slate-100/80 rounded-b-xl border border-slate-200 border-t-0 p-2 space-y-2 min-h-[200px] overflow-y-auto',
          'transition-all duration-200 ease-out',
          showHighlight && 'bg-[var(--theme-accent)]/10 border-[var(--theme-accent)]/40 ring-2 ring-[var(--theme-accent)]/20 ring-inset'
        )}
      >
        {children}

        {count === 0 && !isAdding && (
          <div className="flex flex-col items-center justify-center h-24 text-sm text-muted-foreground">
            <div className="w-12 h-12 rounded-full bg-slate-200/50 flex items-center justify-center mb-2">
              <Plus className="h-5 w-5 text-slate-400" />
            </div>
            <span>No tasks yet</span>
          </div>
        )}

        {/* Inline Add Task */}
        {onAddTask && (
          <div className="pt-1">
            {isAdding ? (
              <div className="bg-white rounded-lg border border-[var(--theme-accent)]/30 shadow-md p-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <input
                  ref={inputRef}
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleBlur}
                  placeholder="What needs to be done?"
                  className="w-full text-sm border-0 focus:outline-none focus:ring-0 placeholder:text-slate-400 font-medium"
                />
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
                  <span className="text-xs text-muted-foreground">
                    <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-mono">Enter</kbd> to add
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setIsAdding(false);
                        setNewTaskTitle('');
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={!newTaskTitle.trim()}
                      className="text-xs font-medium text-white bg-primary hover:bg-primary/90 px-3 py-1 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsAdding(true)}
                className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground hover:bg-white rounded-lg p-2.5 transition-all duration-200 border border-transparent hover:border-slate-200 hover:shadow-sm group"
              >
                <Plus className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                <span>Add task</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
