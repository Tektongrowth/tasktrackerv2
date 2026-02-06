import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tasks as tasksApi, subtasks as subtasksApi, comments as commentsApi } from '@/lib/api';
import { toast } from '@/components/ui/toaster';
import type { EmojiKey } from '@/lib/types';

export function useSubtaskMutations(taskId: string, callbacks?: { onSubtaskCreated?: () => void }) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['tasks', taskId] });
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  };

  const createSubtask = useMutation({
    mutationFn: (title: string) => subtasksApi.create(taskId, { title }),
    onSuccess: () => {
      invalidate();
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create subtask', description: error.message, variant: 'destructive' });
    },
    onSettled: () => {
      callbacks?.onSubtaskCreated?.();
    },
  });

  const updateSubtask = useMutation({
    mutationFn: ({ subtaskId, data }: { subtaskId: string; data: { title?: string; completed?: boolean } }) =>
      subtasksApi.update(taskId, subtaskId, data),
    onSuccess: invalidate,
    onError: (error: Error) => {
      toast({ title: 'Failed to update subtask', description: error.message, variant: 'destructive' });
    },
  });

  const deleteSubtask = useMutation({
    mutationFn: (subtaskId: string) => subtasksApi.delete(taskId, subtaskId),
    onSuccess: invalidate,
    onError: (error: Error) => {
      toast({ title: 'Failed to delete subtask', description: error.message, variant: 'destructive' });
    },
  });

  return { createSubtask, updateSubtask, deleteSubtask };
}

export function useCommentMutations(taskId: string, callbacks?: { onCommentCreated?: () => void }) {
  const queryClient = useQueryClient();

  const createComment = useMutation({
    mutationFn: ({ content, file }: { content: string; file: File | null }) => {
      if (file) {
        return commentsApi.createWithAttachment(taskId, content, file);
      }
      return commentsApi.create(taskId, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      callbacks?.onCommentCreated?.();
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to post comment', description: error.message, variant: 'destructive' });
    },
  });

  const deleteComment = useMutation({
    mutationFn: (commentId: string) => commentsApi.delete(taskId, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', taskId] });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete comment', description: error.message, variant: 'destructive' });
    },
  });

  const toggleReaction = useMutation({
    mutationFn: ({ commentId, emoji }: { commentId: string; emoji: EmojiKey }) =>
      commentsApi.toggleReaction(taskId, commentId, emoji),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', taskId] });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to react', description: error.message, variant: 'destructive' });
    },
  });

  return { createComment, deleteComment, toggleReaction };
}

export function useArchiveTask(taskId: string, onSuccess?: () => void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => tasksApi.archive(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({ title: 'Task archived' });
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to archive task', description: error.message, variant: 'destructive' });
    },
  });
}
