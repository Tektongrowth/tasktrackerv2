import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasks } from '@/lib/api';
import { toast } from '@/components/ui/toaster';
import type { Task, TaskStatus, TaskInput } from '@/lib/types';

export function useTasks(params?: Record<string, string>, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['tasks', params],
    queryFn: () => tasks.list(params),
    staleTime: 1000 * 10, // 10 seconds - tasks should be fresh
    refetchOnMount: 'always', // Always refetch when component mounts
    enabled: options?.enabled !== false, // Allow disabling the query
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

      // Optimistically update all task queries
      cache.forEach(([queryKey, data]) => {
        if (data) {
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
    onSuccess: () => {
      // Only invalidate dashboard - tasks already updated optimistically
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    // Note: No onSettled refetch - rely on optimistic update for snappy UI
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
