export type GuideId =
  | 'welcome'
  | 'dashboard'
  | 'kanban'
  | 'timeTracking'
  | 'settings'
  | 'mySettings'
  | 'templates'
  | 'submissions'
  | 'clientPortal';

export interface WelcomeStep {
  id: string;
  title: string;
  description: string;
  icon?: string;
  adminOnly?: boolean;
}

export interface SpotlightStep {
  id: string;
  target: string; // data-guide attribute value
  title: string;
  description: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
}

export interface TourDefinition {
  id: GuideId;
  name: string;
  description: string;
  path: string; // Route path for this tour
  adminOnly?: boolean;
  steps: SpotlightStep[];
}

export interface GuideContextValue {
  // State
  isLoading: boolean;
  role: 'admin' | 'contractor';
  completedGuides: string[];

  // Welcome wizard
  showWelcome: boolean;
  setShowWelcome: (show: boolean) => void;
  markWelcomeSeen: () => void;

  // Spotlight tours
  activeTour: GuideId | null;
  currentTourStep: number;
  availableTours: TourDefinition[];
  startTour: (tourId: GuideId) => void;
  nextStep: () => void;
  prevStep: () => void;
  endTour: () => void;

  // Utilities
  isGuideComplete: (guideId: string) => boolean;
  resetAllGuides: () => void;
}
