import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard,
  Kanban,
  List,
  MessageCircle,
  MoreHorizontal,
  Clock,
  Settings,
  FileText,
  Inbox,
  LogOut,
  Search,
  HelpCircle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface MobileBottomNavProps {
  unreadMessageCount: number;
  onSearchClick: () => void;
}

const mainNavItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/kanban', icon: Kanban, label: 'Kanban' },
  { to: '/list', icon: List, label: 'List' },
  { to: '/chat', icon: MessageCircle, label: 'Messages' },
];

export function MobileBottomNav({ unreadMessageCount, onSearchClick }: MobileBottomNavProps) {
  const { isAdmin, isProjectManager, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Build "More" menu items based on permissions
  const moreItems = [
    { to: '/submissions', icon: Inbox, label: 'Task Requests', show: isProjectManager },
    { to: '/time', icon: Clock, label: 'Time Analytics', show: isProjectManager },
    { to: '/templates', icon: FileText, label: 'Templates', show: isProjectManager },
    { to: '/settings', icon: Settings, label: 'Settings', show: isAdmin },
    { to: '/my-settings', icon: Settings, label: 'My Settings', show: !isAdmin },
  ].filter(item => item.show);

  // Check if current path matches any "more" item (including /help)
  const isMoreActive = moreItems.some(item => location.pathname === item.to) || location.pathname === '/help';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--theme-sidebar)] border-t border-white/10 md:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        {mainNavItems.map((item) => {
          const isActive = location.pathname === item.to;
          // Show badge if there are unread messages OR always for testing
          const showBadge = item.to === '/chat' && unreadMessageCount > 0;
          // Debug: log the unread count
          if (item.to === '/chat') {
            console.log('MobileBottomNav unread count:', unreadMessageCount);
          }

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full py-2 relative transition-colors',
                isActive
                  ? 'text-white'
                  : 'text-white/40 hover:text-white/80'
              )}
            >
              <div className="relative">
                <item.icon className={cn('h-5 w-5', isActive && 'text-[var(--theme-accent)]')} />
                {showBadge && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[var(--theme-sidebar)]" />
                )}
              </div>
              <span className={cn('text-[10px] mt-1', isActive && 'font-medium')}>{item.label}</span>
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[var(--theme-accent)] rounded-full" />
              )}
            </NavLink>
          );
        })}

        {/* More Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full py-2 relative transition-colors',
                isMoreActive
                  ? 'text-white'
                  : 'text-white/40 hover:text-white/80'
              )}
            >
              <MoreHorizontal className={cn('h-5 w-5', isMoreActive && 'text-[var(--theme-accent)]')} />
              <span className={cn('text-[10px] mt-1', isMoreActive && 'font-medium')}>More</span>
              {isMoreActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[var(--theme-accent)] rounded-full" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-48 mb-2">
            {/* Search option */}
            <DropdownMenuItem onClick={onSearchClick}>
              <Search className="h-4 w-4 mr-2" />
              Search
            </DropdownMenuItem>
            <DropdownMenuSeparator />

            {/* Dynamic menu items */}
            {moreItems.map((item) => (
              <DropdownMenuItem
                key={item.to}
                onClick={() => navigate(item.to)}
                className={cn(
                  location.pathname === item.to && 'bg-white/[0.06]'
                )}
              >
                <item.icon className="h-4 w-4 mr-2" />
                {item.label}
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />

            {/* Help & Guides */}
            <DropdownMenuItem
              onClick={() => navigate('/help')}
              className={cn(
                location.pathname === '/help' && 'bg-white/[0.06]'
              )}
            >
              <HelpCircle className="h-4 w-4 mr-2" />
              Help & Guides
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-400">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
