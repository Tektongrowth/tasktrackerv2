import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { search } from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, FileText, Building2, FolderKanban, ArrowRight, Command } from 'lucide-react';
import type { Task, Project, Client } from '@/lib/types';

interface GlobalSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ResultItem =
  | { type: 'task'; data: Task }
  | { type: 'project'; data: Project }
  | { type: 'client'; data: Client };

export function GlobalSearchModal({ open, onOpenChange }: GlobalSearchModalProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const debouncedQuery = useDebounce(query, 300);

  const { data: results, isLoading } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => search.query(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
  });

  // Flatten results for keyboard navigation
  const flatResults: ResultItem[] = [];
  if (results) {
    results.tasks.forEach(task => flatResults.push({ type: 'task', data: task }));
    results.projects.forEach(project => flatResults.push({ type: 'project', data: project }));
    results.clients.forEach(client => flatResults.push({ type: 'client', data: client }));
  }

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [debouncedQuery]);

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQuery('');
    }
  }, [open]);

  const navigateToResult = useCallback((item: ResultItem) => {
    onOpenChange(false);
    switch (item.type) {
      case 'task':
        navigate(`/kanban?taskId=${item.data.id}`);
        break;
      case 'project':
        navigate(`/kanban?projectId=${item.data.id}`);
        break;
      case 'client':
        navigate(`/kanban?clientId=${item.data.id}`);
        break;
    }
  }, [navigate, onOpenChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && flatResults[selectedIndex]) {
      e.preventDefault();
      navigateToResult(flatResults[selectedIndex]);
    }
  }, [flatResults, selectedIndex, navigateToResult]);

  const statusColors: Record<string, string> = {
    todo: 'bg-white/[0.06] text-white/70',
    in_review: 'bg-amber-500/15 text-amber-400',
    completed: 'bg-green-500/15 text-green-400',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden">
        <div className="flex items-center border-b px-4 py-3 pr-12">
          <Search className="h-5 w-5 text-white/60 mr-3" />
          <Input
            ref={inputRef}
            placeholder="Search tasks, projects, clients..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="border-0 focus-visible:ring-0 text-base px-0"
          />
          <kbd className="ml-2 pointer-events-none inline-flex h-6 select-none items-center gap-1 rounded border bg-white/[0.04] px-2 font-mono text-xs text-white/60">
            esc
          </kbd>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {query.length < 2 ? (
            <div className="p-8 text-center text-white/60">
              <Command className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Type at least 2 characters to search</p>
              <p className="text-xs mt-1 opacity-70">
                Press <kbd className="px-1 py-0.5 rounded bg-white/[0.04] font-mono text-xs">Option</kbd> + <kbd className="px-1 py-0.5 rounded bg-white/[0.04] font-mono text-xs">Space</kbd> to open this dialog
              </p>
            </div>
          ) : isLoading ? (
            <div className="p-8 text-center text-white/60">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-sm">Searching...</p>
            </div>
          ) : flatResults.length === 0 ? (
            <div className="p-8 text-center text-white/60">
              <Search className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No results found for "{query}"</p>
            </div>
          ) : (
            <div className="py-2">
              {results?.tasks && results.tasks.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-semibold text-white/60 uppercase tracking-wider">
                    Tasks
                  </div>
                  {results.tasks.map((task, index) => {
                    const globalIndex = index;
                    return (
                      <div
                        key={task.id}
                        className={cn(
                          'flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors',
                          selectedIndex === globalIndex
                            ? 'bg-primary/10'
                            : 'hover:bg-white/[0.04]'
                        )}
                        onClick={() => navigateToResult({ type: 'task', data: task })}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                      >
                        <FileText className="h-4 w-4 text-white/60 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{task.title}</p>
                          <p className="text-xs text-white/60 truncate">
                            {task.project?.client?.name} / {task.project?.name}
                          </p>
                        </div>
                        <Badge className={cn('text-xs', statusColors[task.status])}>
                          {task.status.replace('_', ' ')}
                        </Badge>
                        <ArrowRight className="h-4 w-4 text-white/60 opacity-0 group-hover:opacity-100" />
                      </div>
                    );
                  })}
                </div>
              )}

              {results?.projects && results.projects.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-semibold text-white/60 uppercase tracking-wider border-t mt-2 pt-4">
                    Projects
                  </div>
                  {results.projects.map((project, index) => {
                    const globalIndex = (results?.tasks?.length || 0) + index;
                    return (
                      <div
                        key={project.id}
                        className={cn(
                          'flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors',
                          selectedIndex === globalIndex
                            ? 'bg-primary/10'
                            : 'hover:bg-white/[0.04]'
                        )}
                        onClick={() => navigateToResult({ type: 'project', data: project })}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                      >
                        <FolderKanban className="h-4 w-4 text-white/60 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{project.name}</p>
                          <p className="text-xs text-white/60 truncate">
                            {project.client?.name}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {project.subscriptionStatus}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}

              {results?.clients && results.clients.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-semibold text-white/60 uppercase tracking-wider border-t mt-2 pt-4">
                    Clients
                  </div>
                  {results.clients.map((client, index) => {
                    const globalIndex = (results?.tasks?.length || 0) + (results?.projects?.length || 0) + index;
                    return (
                      <div
                        key={client.id}
                        className={cn(
                          'flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors',
                          selectedIndex === globalIndex
                            ? 'bg-primary/10'
                            : 'hover:bg-white/[0.04]'
                        )}
                        onClick={() => navigateToResult({ type: 'client', data: client })}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                      >
                        <Building2 className="h-4 w-4 text-white/60 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{client.name}</p>
                          {client.email && (
                            <p className="text-xs text-white/60 truncate" data-sensitive>
                              {client.email}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t px-4 py-2 flex items-center justify-between text-xs text-white/60">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white/[0.04] font-mono">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-white/[0.04] font-mono">↓</kbd>
              to navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white/[0.04] font-mono">↵</kbd>
              to select
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
