import { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useFilters } from '@/hooks/useFilters';
import { useTheme } from '@/hooks/useTheme';
import { clients } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/UserAvatar';
import { BulkActionBar } from '@/components/BulkActionBar';
import { GlobalSearchModal } from '@/components/GlobalSearchModal';
import {
  LayoutDashboard,
  Kanban,
  List,
  Clock,
  Settings,
  FileText,
  LogOut,
  Search,
  FolderKanban,
  ChevronRight,
  ChevronDown,
  X,
  Inbox,
  MessageCircle,
} from 'lucide-react';
import { chats as chatsApi, notifications as notificationsApi } from '@/lib/api';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/kanban', icon: Kanban, label: 'Kanban Board' },
  { to: '/list', icon: List, label: 'Task List' },
  { to: '/chat', icon: MessageCircle, label: 'Messages' },
  { to: '/submissions', icon: Inbox, label: 'Task Requests', requiresProjectManager: true },
  { to: '/time', icon: Clock, label: 'Time Analytics', requiresProjectManager: true },
  { to: '/templates', icon: FileText, label: 'Templates', requiresProjectManager: true },
  { to: '/settings', icon: Settings, label: 'Settings', adminOnly: true },
  { to: '/my-settings', icon: Settings, label: 'My Settings', contractorOnly: true },
];

function ProjectSidebar() {
  const { data: allClients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: clients.list,
  });

  const {
    selectedProjectId,
    selectedClientId,
    setSelectedProject,
    setSelectedClient,
    clearFilters,
  } = useFilters();

  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const toggleClient = (clientId: string) => {
    setExpandedClients((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      return next;
    });
  };

  const filteredClients = allClients.filter((client) =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.projects?.some((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const hasActiveFilter = selectedProjectId || selectedClientId;

  return (
    <div className="flex flex-col h-full">
      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      {hasActiveFilter && (
        <div className="px-3 py-2 border-b bg-red-50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--theme-accent)]">Active Filter</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-[var(--theme-accent)] hover:bg-red-100"
              onClick={clearFilters}
            >
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2">
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer text-sm font-medium mb-1',
            !selectedProjectId && !selectedClientId
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted'
          )}
          onClick={clearFilters}
        >
          <FolderKanban className="h-4 w-4" />
          All Projects
        </div>

        <div className="mt-3">
          <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Clients
          </div>
          {filteredClients.map((client) => (
            <div key={client.id} className="mt-1">
              <div
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer text-sm',
                  selectedClientId === client.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                )}
                onClick={() => {
                  if (client.projects && client.projects.length > 0) {
                    toggleClient(client.id);
                  }
                  setSelectedClient(client.id);
                }}
              >
                {client.projects && client.projects.length > 0 ? (
                  expandedClients.has(client.id) ? (
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  )
                ) : (
                  <div className="w-4" />
                )}
                <span className="truncate flex-1">{client.name}</span>
                {(client as any).incompleteTaskCount > 0 && (
                  <Badge variant="secondary" className="text-xs h-5">
                    {(client as any).incompleteTaskCount}
                  </Badge>
                )}
              </div>

              {expandedClients.has(client.id) && client.projects && (
                <div className="ml-6 mt-1 space-y-0.5">
                  {client.projects.map((project) => (
                    <div
                      key={project.id}
                      className={cn(
                        'flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer text-sm',
                        selectedProjectId === project.id
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-muted-foreground hover:bg-muted'
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProject(project.id);
                      }}
                    >
                      <span className="truncate">{project.name}</span>
                      <Badge
                        variant={project.subscriptionStatus === 'active' ? 'default' : 'secondary'}
                        className="text-xs h-4 ml-auto"
                      >
                        {project.subscriptionStatus}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Layout() {
  const { user, isAdmin, isProjectManager, logout } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [demoMode, setDemoMode] = useState(false);

  // Fetch unread chat count
  const { data: unreadData } = useQuery({
    queryKey: ['chat-unread-count'],
    queryFn: chatsApi.getUnreadCount,
    refetchInterval: 5000, // Refetch every 5 seconds for timely notifications
  });
  const unreadChatCount = unreadData?.unreadCount || 0;

  // Fetch unread mention count
  const { data: mentionData } = useQuery({
    queryKey: ['mention-unread-count'],
    queryFn: notificationsApi.getUnreadMentionCount,
    refetchInterval: 5000,
  });
  const unreadMentionCount = mentionData?.unreadCount || 0;

  // Total unread for messages badge (chats + mentions)
  const totalUnreadMessages = unreadChatCount + unreadMentionCount;

  // Get branding from theme
  const logoUrl = theme?.branding?.logoUrl || '/logo.png';
  const backgroundImage = theme?.branding?.backgroundImage || '/background.jpg';
  const backgroundColor = theme?.branding?.backgroundColor;

  // Global keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Option+Space to open search
    if (e.altKey && e.code === 'Space') {
      e.preventDefault();
      setSearchModalOpen(true);
    }
    // Cmd+Shift+D or Ctrl+Shift+D to toggle demo mode (blur sensitive data)
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.code === 'KeyD') {
      e.preventDefault();
      setDemoMode(prev => !prev);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const showProjectSidebar = ['/kanban', '/dashboard', '/list'].includes(location.pathname);

  // Filter nav items based on access level
  const canShowNavItem = (item: typeof navItems[0]) => {
    if (item.adminOnly) return isAdmin;
    if ((item as any).contractorOnly) return !isAdmin;
    if ((item as any).requiresProjectManager) return isProjectManager;
    return true;
  };

  // Build background style
  const backgroundStyle: React.CSSProperties = {};
  if (backgroundImage) {
    backgroundStyle.backgroundImage = `url('${backgroundImage}')`;
    backgroundStyle.backgroundSize = 'cover';
    backgroundStyle.backgroundPosition = 'center';
  } else if (backgroundColor) {
    backgroundStyle.backgroundColor = backgroundColor;
  }

  return (
    <div className={cn("h-screen bg-background flex relative overflow-hidden", demoMode && "demo-mode")}>
      {/* Custom background from theme */}
      {(backgroundImage || backgroundColor) && (
        <div
          className="fixed inset-0 pointer-events-none z-0"
          style={{
            ...backgroundStyle,
            opacity: 1,
          }}
        />
      )}
      {/* Subtle background pattern (only if no custom background) */}
      {!backgroundImage && !backgroundColor && (
        <div className="fixed inset-0 bg-pattern pointer-events-none" />
      )}

      {/* Demo mode indicator - centered on header edge */}
      {demoMode && (
        <div className="fixed top-[68px] right-6 z-[100] bg-amber-500 text-white px-3 py-1.5 rounded-full text-xs font-medium shadow-lg flex items-center gap-2">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
          Demo Mode (⌘+Shift+D to exit)
        </div>
      )}

      {/* Main Navigation Sidebar */}
      <aside className="w-16 sidebar-dark flex flex-col items-center py-4 relative z-50">
        <div className="mb-8">
          <img src={logoUrl} alt="Logo" className="w-10 h-10 object-contain" />
        </div>

        <nav className="flex-1 flex flex-col items-center gap-2">
          {navItems
            .filter(canShowNavItem)
            .map((item) => {
              const isActive = location.pathname === item.to;
              const showBadge = item.to === '/chat' && totalUnreadMessages > 0;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 group relative',
                    isActive
                      ? 'bg-brand-gradient text-white shadow-lg'
                      : 'text-gray-500 hover:bg-white/10 hover:text-white'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {showBadge && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                      {totalUnreadMessages > 99 ? '99+' : totalUnreadMessages}
                    </span>
                  )}
                  <div className="absolute left-full ml-2 px-2 py-1 bg-[var(--theme-sidebar)] text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-[60] font-medium shadow-lg">
                    {item.label}
                  </div>
                </NavLink>
              );
            })}
        </nav>

        <div className="mt-auto flex flex-col items-center gap-3">
          <div
            className="cursor-pointer ring-2 ring-white/10 hover:ring-white/20 transition-all rounded-full group relative"
            onClick={() => navigate(isAdmin ? '/settings' : '/my-settings')}
          >
            <UserAvatar name={user?.name || '?'} avatarUrl={user?.avatarUrl} size="md" />
            <div className="absolute left-full ml-2 px-2 py-1 bg-[var(--theme-sidebar)] text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-[60] font-medium shadow-lg">
              {isAdmin ? 'Settings' : 'My Settings'}
            </div>
          </div>
          <div className="relative group">
            <Button
              variant="ghost"
              size="icon"
              className="w-10 h-10 text-gray-500 hover:text-white hover:bg-white/10"
              onClick={handleLogout}
            >
              <LogOut className="h-5 w-5" />
            </Button>
            <div className="absolute left-full ml-2 px-2 py-1 bg-[var(--theme-sidebar)] text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-[60] font-medium shadow-lg">
              Logout
            </div>
          </div>
        </div>
      </aside>

      {/* Project Sidebar */}
      {showProjectSidebar && (
        <aside className="w-64 bg-white border-r flex flex-col relative z-10">
          <ProjectSidebar />
        </aside>
      )}

      {/* Main content - always show scrollbar to prevent layout shift */}
      <main className="flex-1 min-w-0 relative z-10 overflow-y-scroll flex flex-col">
        <div className="flex-1">
          <Outlet />
        </div>
        {/* Footer Branding */}
        <div className="flex items-end justify-end gap-3 text-right px-6 py-4 mt-auto">
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-xs text-slate-300 italic tracking-wide">Task Tracker Pro</span>
            <span className="text-[10px] text-slate-300">&copy; {new Date().getFullYear()} Tekton Growth</span>
          </div>
          <img src={logoUrl} alt="Logo" className="w-8 h-8 object-contain opacity-30" />
        </div>
      </main>

      {/* Bulk Action Bar */}
      <BulkActionBar />

      {/* Floating Search Button - Bottom Left */}
      <div className="fixed bottom-6 left-40 z-50 group">
        <button
          onClick={() => setSearchModalOpen(true)}
          className="w-14 h-14 bg-[var(--theme-accent)] hover:bg-[var(--theme-primary)] rounded-full flex items-center justify-center shadow-lg transition-colors animate-slow-pulse"
        >
          <Search className="h-6 w-6 text-white" />
        </button>
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-[var(--theme-sidebar)] text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-[60] font-medium shadow-lg">
          Search (Option+Space)
        </div>
      </div>

      {/* Global Search Modal */}
      <GlobalSearchModal open={searchModalOpen} onOpenChange={setSearchModalOpen} />
    </div>
  );
}
