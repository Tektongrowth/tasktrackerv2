import { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useFilters } from '@/hooks/useFilters';
import { useTheme } from '@/hooks/useTheme';
import { useIsMobile } from '@/hooks/useIsMobile';
import { clients } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/UserAvatar';
import { BulkActionBar } from '@/components/BulkActionBar';
import { GlobalSearchModal } from '@/components/GlobalSearchModal';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { MobileProjectSelector } from '@/components/MobileProjectSelector';
import { PushNotificationPrompt } from '@/components/PushNotificationPrompt';
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
  Brain,
} from 'lucide-react';
import { chats as chatsApi, notifications as notificationsApi } from '@/lib/api';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  adminOnly?: boolean;
  contractorOnly?: boolean;
  requiresProjectManager?: boolean;
}

const navItems: NavItem[] = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/kanban', icon: Kanban, label: 'Kanban Board' },
  { to: '/list', icon: List, label: 'Task List' },
  { to: '/chat', icon: MessageCircle, label: 'Messages' },
  { to: '/submissions', icon: Inbox, label: 'Task Requests', requiresProjectManager: true },
  { to: '/time', icon: Clock, label: 'Time Analytics', requiresProjectManager: true },
  { to: '/templates', icon: FileText, label: 'Templates', requiresProjectManager: true },
  { to: '/seo-intelligence', icon: Brain, label: 'SEO Intel', adminOnly: true },
  { to: '/settings', icon: Settings, label: 'Settings', adminOnly: true },
  { to: '/my-settings', icon: Settings, label: 'My Settings', contractorOnly: true },
];

function ProjectSidebar() {
  const { user } = useAuth();
  const { data: allClients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: clients.list,
    enabled: !!user, // Wait for auth before fetching
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
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/60" />
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      {hasActiveFilter && (
        <div className="px-3 py-2 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--theme-accent)]">Active Filter</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-[var(--theme-accent)] hover:bg-white/5"
              onClick={clearFilters}
            >
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2 pb-24">
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer text-sm font-medium mb-1',
            !selectedProjectId && !selectedClientId
              ? 'bg-primary text-primary-foreground'
              : 'text-white/60 hover:bg-white/[0.06]'
          )}
          onClick={clearFilters}
        >
          <FolderKanban className="h-4 w-4" />
          All Projects
        </div>

        <div className="mt-3">
          <div className="px-3 py-1.5 text-xs font-semibold text-white/60 uppercase tracking-wider">
            Clients
          </div>
          {filteredClients.map((client) => (
            <div key={client.id} className="mt-1">
              <div
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer text-sm',
                  selectedClientId === client.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-white/[0.06]'
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
                {(client as { incompleteTaskCount?: number }).incompleteTaskCount != null && (client as { incompleteTaskCount?: number }).incompleteTaskCount! > 0 && (
                  <Badge variant="secondary" className="text-xs h-5">
                    {(client as { incompleteTaskCount?: number }).incompleteTaskCount}
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
                          : 'text-white/60 hover:bg-white/[0.06]'
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
  const isMobile = useIsMobile();
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [demoMode, setDemoMode] = useState(false);

  // Fetch unread chat count
  const { data: unreadData } = useQuery({
    queryKey: ['chat-unread-count'],
    queryFn: chatsApi.getUnreadCount,
    refetchInterval: 5000, // Refetch every 5 seconds for timely notifications
    enabled: !!user, // Wait for auth before fetching
  });
  const unreadChatCount = unreadData?.unreadCount || 0;

  // Fetch unread mention count
  const { data: mentionData } = useQuery({
    queryKey: ['mention-unread-count'],
    queryFn: notificationsApi.getUnreadMentionCount,
    refetchInterval: 5000,
    enabled: !!user, // Wait for auth before fetching
  });
  const unreadMentionCount = mentionData?.unreadCount || 0;

  // Total unread for messages badge (chats + mentions)
  const totalUnreadMessages = unreadChatCount + unreadMentionCount;

  // Get branding from theme
  const logoUrl = theme?.branding?.logoUrl || '/logo.png';

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
  const canShowNavItem = (item: NavItem) => {
    if (item.adminOnly) return isAdmin;
    if (item.contractorOnly) return !isAdmin;
    if (item.requiresProjectManager) return isProjectManager;
    return true;
  };

  return (
    <div className={cn("h-screen flex relative overflow-hidden bg-honeycomb", demoMode && "demo-mode")}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:p-4 focus:text-primary focus:underline"
      >
        Skip to content
      </a>

      {/* Floating hexagons — parallax depth */}
      <div className="hex-float hex-float-1" />
      <div className="hex-float hex-float-2" />
      <div className="hex-float hex-float-3" />
      <div className="hex-float hex-float-4" />
      <div className="hex-float hex-float-5" />
      <div className="hex-float hex-float-6" />
      <div className="hex-float hex-float-7" />
      <div className="hex-float hex-float-8" />
      <div className="hex-float hex-float-9" />
      <div className="hex-float hex-float-10" />
      <div className="hex-float hex-float-11" />
      <div className="hex-float hex-float-12" />
      <div className="hex-float hex-float-13" />

      {/* Demo mode indicator - centered on header edge */}
      {demoMode && (
        <div className="fixed top-[68px] right-6 z-[100] bg-amber-500 text-white px-3 py-1.5 rounded-full text-xs font-medium shadow-lg flex items-center gap-2">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
          Demo Mode (⌘+Shift+D to exit)
        </div>
      )}

      {/* Main Navigation Sidebar - Hidden on mobile */}
      <aside className="w-16 sidebar-dark hidden md:flex flex-col items-center py-4 relative z-50">
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
                      : 'text-white/50 hover:bg-white/10 hover:text-white'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {showBadge && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                      {totalUnreadMessages > 99 ? '99+' : totalUnreadMessages}
                    </span>
                  )}
                  <div className="absolute left-full ml-2 px-2 py-1 bg-black/80 backdrop-blur-sm text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-[60] font-medium shadow-lg">
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
            <div className="absolute left-full ml-2 px-2 py-1 bg-black/80 backdrop-blur-sm text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-[60] font-medium shadow-lg">
              {isAdmin ? 'Settings' : 'My Settings'}
            </div>
          </div>
          <div className="relative group">
            <Button
              variant="ghost"
              size="icon"
              className="w-10 h-10 text-white/50 hover:text-white hover:bg-white/10"
              onClick={handleLogout}
              aria-label="Logout"
            >
              <LogOut className="h-5 w-5" />
            </Button>
            <div className="absolute left-full ml-2 px-2 py-1 bg-black/80 backdrop-blur-sm text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-[60] font-medium shadow-lg">
              Logout
            </div>
          </div>
        </div>
      </aside>

      {/* Project Sidebar - Hidden on mobile */}
      {showProjectSidebar && (
        <aside className="w-64 liquid-panel hidden md:flex flex-col relative z-10">
          <ProjectSidebar />
        </aside>
      )}

      {/* Main content - always show scrollbar to prevent layout shift */}
      <main id="main-content" className="flex-1 min-w-0 relative z-10 overflow-y-scroll flex flex-col pb-16 md:pb-0 bg-orbs">
        {/* Mobile Project Selector */}
        {showProjectSidebar && isMobile && <MobileProjectSelector />}
        <div className="flex-1 relative z-10">
          <Outlet />
        </div>
        {/* Footer Branding */}
        <div className="flex items-end justify-end gap-3 text-right px-6 py-4 mt-auto relative z-10">
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-xs text-gradient italic tracking-wide">Task Tracker Pro</span>
            <span className="text-[10px] text-white/30">&copy; {new Date().getFullYear()} Tekton Growth</span>
          </div>
          <img src={logoUrl} alt="Logo" className="w-8 h-8 object-contain opacity-30" />
        </div>
      </main>

      {/* Bulk Action Bar */}
      <BulkActionBar />

      {/* Floating Search Button - Bottom Left (hidden on mobile) */}
      <div className="fixed bottom-6 left-40 z-50 group hidden md:block">
        <button
          onClick={() => setSearchModalOpen(true)}
          className="w-14 h-14 bg-[var(--theme-accent)] hover:bg-[var(--theme-primary)] rounded-full flex items-center justify-center shadow-lg transition-colors animate-slow-pulse"
          aria-label="Search"
        >
          <Search className="h-6 w-6 text-white" />
        </button>
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 backdrop-blur-sm text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-[60] font-medium shadow-lg">
          Search (Option+Space)
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <MobileBottomNav
          unreadMessageCount={totalUnreadMessages}
          onSearchClick={() => setSearchModalOpen(true)}
        />
      )}

      {/* Global Search Modal */}
      <GlobalSearchModal open={searchModalOpen} onOpenChange={setSearchModalOpen} />

      {/* Push Notification Prompt */}
      <PushNotificationPrompt />
    </div>
  );
}
