import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  HelpCircle,
  Check,
  Sparkles,
  LayoutDashboard,
  Columns3,
  Clock,
  Settings,
  FileText,
  Inbox,
  Users,
  RotateCcw,
  Bell,
  Bug,
  Trophy,
} from 'lucide-react';
import { useGuide } from './useGuide';
import { GuideId } from './types';

const tourIcons: Record<GuideId, React.ElementType> = {
  welcome: Sparkles,
  dashboard: LayoutDashboard,
  kanban: Columns3,
  timeTracking: Clock,
  settings: Settings,
  mySettings: Bell,
  templates: FileText,
  submissions: Inbox,
  clientPortal: Users,
};

export function HelpButton() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    availableTours,
    isGuideComplete,
    startTour,
    setShowWelcome,
    resetAllGuides,
    isLoading,
    activeTour,
  } = useGuide();
  const [open, setOpen] = useState(false);

  // Don't show while loading or during active tour
  if (isLoading || activeTour) return null;

  // Count incomplete guides
  const incompleteCount = availableTours.filter((tour) => !isGuideComplete(tour.id)).length;
  const hasIncomplete = incompleteCount > 0;

  const handleTourSelect = (tourId: GuideId, path: string) => {
    setOpen(false);
    // Navigate to the page if not already there
    if (!location.pathname.startsWith(path)) {
      navigate(path);
      // Wait for navigation to complete before starting tour
      setTimeout(() => startTour(tourId), 100);
    } else {
      startTour(tourId);
    }
  };

  const handleWelcomeReplay = () => {
    setOpen(false);
    setShowWelcome(true);
  };

  const handleReset = () => {
    setOpen(false);
    resetAllGuides();
  };

  return (
    <div className="fixed bottom-6 left-24 z-50 group hidden md:block">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            className="w-14 h-14 bg-white/60 hover:bg-white/70 rounded-full flex items-center justify-center shadow-lg transition-colors relative"
            aria-label="Help and guides"
          >
            <span className="text-white text-2xl font-bold">?</span>
            {hasIncomplete && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {incompleteCount}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-[var(--theme-sidebar)] text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-[60] font-medium shadow-lg">
          Help & Guides
        </div>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Help & Guides</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* Welcome tour */}
          <DropdownMenuItem onClick={handleWelcomeReplay}>
            <Sparkles className="mr-2 h-4 w-4" />
            <span className="flex-1">Welcome Tour</span>
            {isGuideComplete('welcome') && (
              <Check className="ml-2 h-4 w-4 text-green-500" />
            )}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Spotlight tours */}
          {availableTours.map((tour) => {
            const Icon = tourIcons[tour.id] || HelpCircle;
            const isComplete = isGuideComplete(tour.id);
            const isCurrentPage = location.pathname.startsWith(tour.path);

            return (
              <DropdownMenuItem
                key={tour.id}
                onClick={() => handleTourSelect(tour.id, tour.path)}
              >
                <Icon className="mr-2 h-4 w-4" />
                <span className="flex-1">{tour.name}</span>
                {isComplete && (
                  <Check className="ml-2 h-4 w-4 text-green-500" />
                )}
                {!isComplete && isCurrentPage && (
                  <span className="ml-2 text-[10px] text-[var(--theme-primary)] font-medium">
                    NEW
                  </span>
                )}
              </DropdownMenuItem>
            );
          })}

          <DropdownMenuSeparator />

          {/* Telegram Guide */}
          <DropdownMenuItem onClick={() => { setOpen(false); navigate('/help?tab=guides'); }}>
            <HelpCircle className="mr-2 h-4 w-4" />
            <span className="flex-1">Telegram Guide</span>
          </DropdownMenuItem>

          {/* Leaderboard Guide */}
          <DropdownMenuItem onClick={() => { setOpen(false); navigate('/help?tab=guides#leaderboard'); }}>
            <Trophy className="mr-2 h-4 w-4 text-yellow-500" />
            <span className="flex-1">Leaderboard Guide</span>
          </DropdownMenuItem>

          {/* Bug Report */}
          <DropdownMenuItem onClick={() => { setOpen(false); navigate('/help?tab=bug'); }}>
            <Bug className="mr-2 h-4 w-4" />
            <span className="flex-1">Report a Bug</span>
          </DropdownMenuItem>

          {/* Feature Request */}
          <DropdownMenuItem onClick={() => { setOpen(false); navigate('/help?tab=feature'); }}>
            <Sparkles className="mr-2 h-4 w-4 text-purple-500" />
            <span className="flex-1">Request a Feature</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Reset option */}
          <DropdownMenuItem onClick={handleReset} className="text-white/50">
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset all guides
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
