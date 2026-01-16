import { createContext, useState, useEffect, useMemo, useCallback, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { guide as guideApi } from '@/lib/api';
import { spotlightTours } from './guideContent';
import type { GuideId, GuideContextValue, TourDefinition } from './types';

export const GuideContext = createContext<GuideContextValue | null>(null);

interface GuideProviderProps {
  children: ReactNode;
}

export function GuideProvider({ children }: GuideProviderProps) {
  const queryClient = useQueryClient();
  const [showWelcome, setShowWelcome] = useState(false);
  const [activeTour, setActiveTour] = useState<GuideId | null>(null);
  const [currentTourStep, setCurrentTourStep] = useState(0);

  // Fetch guide state from API
  const { data, isLoading } = useQuery({
    queryKey: ['guide', 'state'],
    queryFn: guideApi.getState,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const role = data?.role ?? 'contractor';
  const completedGuides = data?.completedGuides ?? [];

  // Show welcome wizard for new users
  useEffect(() => {
    if (!isLoading && data && !data.hasSeenWelcome) {
      setShowWelcome(true);
    }
  }, [isLoading, data]);

  // Mutations
  const markWelcomeSeenMutation = useMutation({
    mutationFn: guideApi.markWelcomeSeen,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guide', 'state'] });
    },
  });

  const markCompleteMutation = useMutation({
    mutationFn: (guideId: string) => guideApi.markComplete(guideId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guide', 'state'] });
    },
  });

  const resetAllMutation = useMutation({
    mutationFn: guideApi.reset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guide', 'state'] });
    },
  });

  // Filter tours based on role
  const availableTours: TourDefinition[] = useMemo(() => {
    return spotlightTours.filter(t => !t.adminOnly || role === 'admin');
  }, [role]);

  // Actions
  const startTour = useCallback((tourId: GuideId) => {
    setActiveTour(tourId);
    setCurrentTourStep(0);
  }, []);

  const nextStep = useCallback(() => {
    if (!activeTour) return;

    const tour = spotlightTours.find(t => t.id === activeTour);
    if (!tour) return;

    if (currentTourStep < tour.steps.length - 1) {
      setCurrentTourStep(prev => prev + 1);
    } else {
      // Tour complete
      markCompleteMutation.mutate(activeTour);
      setActiveTour(null);
      setCurrentTourStep(0);
    }
  }, [activeTour, currentTourStep, markCompleteMutation]);

  const prevStep = useCallback(() => {
    if (currentTourStep > 0) {
      setCurrentTourStep(prev => prev - 1);
    }
  }, [currentTourStep]);

  const endTour = useCallback(() => {
    setActiveTour(null);
    setCurrentTourStep(0);
  }, []);

  const markWelcomeSeen = useCallback(() => {
    markWelcomeSeenMutation.mutate();
    setShowWelcome(false);
  }, [markWelcomeSeenMutation]);

  const resetAllGuides = useCallback(() => {
    resetAllMutation.mutate();
  }, [resetAllMutation]);

  const isGuideComplete = useCallback((guideId: string) => {
    return completedGuides.includes(guideId);
  }, [completedGuides]);

  const value: GuideContextValue = {
    isLoading,
    role,
    completedGuides,
    showWelcome,
    setShowWelcome,
    markWelcomeSeen,
    activeTour,
    currentTourStep,
    availableTours,
    startTour,
    nextStep,
    prevStep,
    endTour,
    isGuideComplete,
    resetAllGuides,
  };

  return (
    <GuideContext.Provider value={value}>
      {children}
    </GuideContext.Provider>
  );
}
