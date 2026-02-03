import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasks } from '@/lib/api';
import { toast } from '@/components/ui/toaster';
import type { Task, TaskStatus, TaskInput } from '@/lib/types';

export function useTasks(params?: Record<string, string>, options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['tasks', params],
    queryFn: async () => {
      try {
        const data = await tasks.list(params);

        // Defensive: preserve cached data if API returns empty unexpectedly
        if (data.length === 0) {
          const cachedData = queryClient.getQueryData<Task[]>(['tasks', params]);
          if (cachedData && cachedData.length > 0) {
            console.warn('[useTasks] Empty response with existing cache - preserving cached data. Params:', params);
            // Force a refetch after a short delay to try getting fresh data
            setTimeout(() => {
              queryClient.invalidateQueries({ queryKey: ['tasks'] });
            }, 2000);
            return cachedData;
          }
          // Log when we get empty with no cache to help debug
          console.warn('[useTasks] Empty response with no cache. Params:', params);
        }

        return data;
      } catch (error) {
        // Check if this is an auth error
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage.includes('Unauthorized') || errorMessage.includes('Not authenticated')) {
          toast({
            title: 'Session expired',
            description: 'Please refresh the page to log in again.',
            variant: 'destructive',
          });
        }
        throw error;
      }
    },
    staleTime: 1000 * 10, // 10 seconds - tasks should be fresh
    refetchOnMount: 'always', // Always refetch when component mounts
    enabled: options?.enabled !== false, // Allow disabling the query
    // Keep previous data while fetching new data for different params
    // This prevents the flash of empty content when filters change
    placeholderData: (previousData) => {
      // If we have previous data for this exact query, use it
      if (previousData) return previousData;
      // Otherwise, try to get data from the base tasks query (no params)
      // This helps when switching between filtered and unfiltered views
      const baseTasksData = queryClient.getQueryData<Task[]>(['tasks', undefined]);
      if (baseTasksData) return baseTasksData;
      // Or try any tasks query that has data
      const allTasksQueries = queryClient.getQueriesData<Task[]>({ queryKey: ['tasks'] });
      for (const [, data] of allTasksQueries) {
        if (Array.isArray(data) && data.length > 0) {
          return data;
        }
      }
      return undefined;
    },
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: ['tasks', id],
    queryFn: () => tasks.get(id),
    enabled: !!id,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: tasks.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TaskInput }) =>
      tasks.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      tasks.updateStatus(id, status),
    onMutate: async ({ id, status }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['tasks'] });

      // Snapshot all task caches
      const cache = queryClient.getQueriesData<Task[]>({ queryKey: ['tasks'] });

      // Optimistically update all task queries (only arrays, not single task queries)
      cache.forEach(([queryKey, data]) => {
        if (Array.isArray(data)) {
          queryClient.setQueryData<Task[]>(
            queryKey,
            data.map((task) =>
              task.id === id
                ? { ...task, status, completedAt: status === 'completed' ? new Date().toISOString() : undefined }
                : task
            )
          );
        }
      });

      // Also update the single task query if it exists
      const singleTask = queryClient.getQueryData<Task>(['tasks', id]);
      if (singleTask) {
        queryClient.setQueryData<Task>(['tasks', id], {
          ...singleTask,
          status,
          completedAt: status === 'completed' ? new Date().toISOString() : undefined,
        });
      }

      return { cache };
    },
    onError: (error: Error, _, context) => {
      // Rollback all caches on error
      if (context?.cache) {
        context.cache.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      // Show error toast
      toast({
        title: 'Failed to update task status',
        description: error.message || 'You may not have permission to edit this task',
        variant: 'destructive',
      });
    },
    onSettled: () => {
      // Always refetch tasks after mutation settles to ensure cache consistency
      // This catches any edge cases where optimistic updates get out of sync
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: tasks.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
