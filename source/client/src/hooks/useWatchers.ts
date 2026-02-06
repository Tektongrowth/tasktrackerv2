import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { watchers } from '@/lib/api';
import { toast } from '@/components/ui/toaster';
import type { TaskWatcher } from '@/lib/types';

export function useWatchers(taskId: string) {
  return useQuery({
    queryKey: ['watchers', taskId],
    queryFn: () => watchers.list(taskId),
    enabled: !!taskId,
  });
}

export function useAddWatcher(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId?: string) => watchers.add(taskId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchers', taskId] });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to add watcher', description: error.message, variant: 'destructive' });
    },
  });
}

export function useRemoveWatcher(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => watchers.remove(taskId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchers', taskId] });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to remove watcher', description: error.message, variant: 'destructive' });
    },
  });
}

export function useToggleMute(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (muted: boolean) => watchers.toggleMute(taskId, muted),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['watchers', taskId] });
      const previousWatchers = queryClient.getQueryData<TaskWatcher[]>(['watchers', taskId]);
      return { previousWatchers };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchers', taskId] });
    },
    onError: (error: Error, _, context) => {
      if (context?.previousWatchers) {
        queryClient.setQueryData(['watchers', taskId], context.previousWatchers);
      }
      toast({ title: 'Failed to update mute setting', description: error.message, variant: 'destructive' });
    },
  });
}
