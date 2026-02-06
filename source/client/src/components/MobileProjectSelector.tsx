import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useFilters } from '@/hooks/useFilters';
import { clients } from '@/lib/api';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ChevronDown,
  ChevronRight,
  FolderKanban,
  Search,
  Check,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function MobileProjectSelector() {
  const { user } = useAuth();
  const { data: allClients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: clients.list,
    enabled: !!user,
  });

  const {
    selectedProjectId,
    selectedClientId,
    setSelectedProject,
    setSelectedClient,
    clearFilters,
  } = useFilters();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);

  // Get display text for current selection
  const displayText = useMemo(() => {
    if (!selectedClientId && !selectedProjectId) {
      return 'All Projects';
    }

    const client = allClients.find(c => c.id === selectedClientId);
    if (!client) return 'All Projects';

    if (selectedProjectId) {
      const project = client.projects?.find(p => p.id === selectedProjectId);
      if (project) {
        return `${client.name} → ${project.name}`;
      }
    }

    return client.name;
  }, [selectedClientId, selectedProjectId, allClients]);

  const hasActiveFilter = selectedProjectId || selectedClientId;

  // Filter clients based on search
  const filteredClients = useMemo(() => {
    if (!searchQuery) return allClients;
    const query = searchQuery.toLowerCase();
    return allClients.filter(
      client =>
        client.name.toLowerCase().includes(query) ||
        client.projects?.some(p => p.name.toLowerCase().includes(query))
    );
  }, [allClients, searchQuery]);

  const toggleClient = (clientId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedClients(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      return next;
    });
  };

  const handleSelectClient = (clientId: string) => {
    setSelectedClient(clientId);
    setOpen(false);
  };

  const handleSelectProject = (projectId: string) => {
    setSelectedProject(projectId);
    setOpen(false);
  };

  const handleClearFilters = () => {
    clearFilters();
    setOpen(false);
  };

  return (
    <div className="px-4 py-2 bg-white border-b md:hidden sticky top-0 z-40">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg border bg-background hover:bg-muted transition-colors">
            <div className="flex items-center gap-2 min-w-0">
              <FolderKanban className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium truncate">{displayText}</span>
              {hasActiveFilter && (
                <span className="shrink-0 w-2 h-2 rounded-full bg-[var(--theme-accent)]" />
              )}
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          className="w-[calc(100vw-2rem)] max-w-sm max-h-80 overflow-hidden flex flex-col"
        >
          {/* Search */}
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto py-1">
            {/* All Projects option */}
            <DropdownMenuItem
              onClick={handleClearFilters}
              className={cn(
                'flex items-center gap-2',
                !hasActiveFilter && 'bg-accent'
              )}
            >
              {!hasActiveFilter && <Check className="h-4 w-4" />}
              {hasActiveFilter && <div className="w-4" />}
              <FolderKanban className="h-4 w-4" />
              All Projects
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Clients list */}
            {filteredClients.map((client) => (
              <div key={client.id}>
                <DropdownMenuItem
                  className={cn(
                    'flex items-center gap-2',
                    selectedClientId === client.id && !selectedProjectId && 'bg-accent'
                  )}
                  onClick={() => handleSelectClient(client.id)}
                >
                  {selectedClientId === client.id && !selectedProjectId ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <div className="w-4" />
                  )}

                  {client.projects && client.projects.length > 0 ? (
                    <button
                      className="p-0.5 -ml-1 hover:bg-muted rounded"
                      onClick={(e) => toggleClient(client.id, e)}
                    >
                      {expandedClients.has(client.id) ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </button>
                  ) : (
                    <div className="w-4" />
                  )}

                  <span className="truncate">{client.name}</span>
                </DropdownMenuItem>

                {/* Projects (if expanded) */}
                {expandedClients.has(client.id) && client.projects && (
                  <div className="ml-6">
                    {client.projects.map((project) => (
                      <DropdownMenuItem
                        key={project.id}
                        className={cn(
                          'flex items-center gap-2 text-sm',
                          selectedProjectId === project.id && 'bg-accent'
                        )}
                        onClick={() => handleSelectProject(project.id)}
                      >
                        {selectedProjectId === project.id ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <div className="w-3.5" />
                        )}
                        <span className="truncate">{project.name}</span>
                      </DropdownMenuItem>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Clear filter button (when filter active) */}
          {hasActiveFilter && (
            <>
              <DropdownMenuSeparator />
              <div className="p-2">
                <button
                  onClick={handleClearFilters}
                  className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-sm text-[var(--theme-accent)] hover:bg-red-50 rounded transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear Filter
                </button>
              </div>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
