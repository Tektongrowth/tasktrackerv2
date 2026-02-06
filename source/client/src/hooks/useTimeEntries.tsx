import { createContext, useContext, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { timeEntries } from '@/lib/api';
import type { TimeEntry } from '@/lib/types';

export function useTimeEntries(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['timeEntries', params],
    queryFn: () => timeEntries.list(params),
  });
}

const RunningTimerContext = createContext<UseQueryResult<TimeEntry | null, Error> | null>(null);

export function RunningTimerProvider({ children }: { children: ReactNode }) {
  const query = useQuery({
    queryKey: ['timeEntries', 'running'],
    queryFn: timeEntries.getRunning,
    refetchInterval: 1000,
  });

  return <RunningTimerContext.Provider value={query}>{children}</RunningTimerContext.Provider>;
}

export function useRunningTimer() {
  const ctx = useContext(RunningTimerContext);
  if (ctx) return ctx;
  // Fallback for use outside provider (backwards-compatible)
  return useQuery({
    queryKey: ['timeEntries', 'running'],
    queryFn: timeEntries.getRunning,
    refetchInterval: 1000,
  });
}

export function useCreateTimeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: timeEntries.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'time-summary'] });
    },
  });
}

export function useStartTimer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: timeEntries.startTimer,
    onMutate: async (newTimer) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['timeEntries', 'running'] });

      // Snapshot previous value
      const previousRunning = queryClient.getQueryData(['timeEntries', 'running']);

      // Optimistically set the running timer
      queryClient.setQueryData(['timeEntries', 'running'], {
        id: `temp-${Date.now()}`,
        title: newTimer.title,
        taskId: newTimer.taskId,
        projectId: newTimer.projectId,
        startTime: new Date().toISOString(),
      });

      return { previousRunning };
    },
    onError: (_err, _newTimer, context) => {
      // Rollback on error
      if (context?.previousRunning !== undefined) {
        queryClient.setQueryData(['timeEntries', 'running'], context.previousRunning);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      queryClient.invalidateQueries({ queryKey: ['timeEntries', 'running'] });
    },
  });
}

export function useStopTimer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: { title?: string; taskId?: string; projectId?: string } }) =>
      timeEntries.stopTimer(id, data),
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['timeEntries', 'running'] });

      // Snapshot previous value
      const previousRunning = queryClient.getQueryData(['timeEntries', 'running']);

      // Optimistically clear the running timer
      queryClient.setQueryData(['timeEntries', 'running'], null);

      return { previousRunning };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousRunning !== undefined) {
        queryClient.setQueryData(['timeEntries', 'running'], context.previousRunning);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      queryClient.invalidateQueries({ queryKey: ['timeEntries', 'running'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'time-summary'] });
    },
  });
}

export function useDeleteTimeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: timeEntries.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'time-summary'] });
    },
  });
}
