import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { seo } from '@/lib/api';

export function useSeoJobHistory(limit = 20) {
  return useQuery({
    queryKey: ['seo', 'job-history', limit],
    queryFn: () => seo.getJobHistory(limit),
  });
}

export function useTestSeoSource() {
  return useMutation({
    mutationFn: (id: string) => seo.testSource(id),
  });
}

export function useSeoDigests(page = 1, limit = 10) {
  return useQuery({
    queryKey: ['seo', 'digests', page, limit],
    queryFn: () => seo.listDigests(page, limit),
    placeholderData: (prev) => prev,
  });
}

export function useSeoDigest(id: string | undefined) {
  return useQuery({
    queryKey: ['seo', 'digest', id],
    queryFn: () => seo.getDigest(id!),
    enabled: !!id,
  });
}

export function useRunSeoPipeline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => seo.runPipeline(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seo', 'digests'] });
    },
  });
}

export function useRetryDigest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => seo.retryDigest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seo', 'digests'] });
    },
  });
}

export function useSeoTaskDrafts(digestId: string | undefined) {
  return useQuery({
    queryKey: ['seo', 'task-drafts', digestId],
    queryFn: () => seo.getTaskDrafts(digestId!),
    enabled: !!digestId,
  });
}

export function useApproveTaskDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { projectId: string; assigneeIds?: string[]; dueDate?: string } }) =>
      seo.approveTaskDraft(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seo'] });
    },
  });
}

export function useRejectTaskDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => seo.rejectTaskDraft(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seo'] });
    },
  });
}

export function useBulkApproveTaskDrafts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, projectId }: { ids: string[]; projectId: string }) =>
      seo.bulkApproveTaskDrafts(ids, { projectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seo'] });
    },
  });
}

export function useSeoSopDrafts(digestId: string | undefined) {
  return useQuery({
    queryKey: ['seo', 'sop-drafts', digestId],
    queryFn: () => seo.getSopDrafts(digestId!),
    enabled: !!digestId,
  });
}

export function useApplySopDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => seo.applySopDraft(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seo'] });
    },
  });
}

export function useDismissSopDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => seo.dismissSopDraft(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seo'] });
    },
  });
}

export function useEditSopDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, afterContent }: { id: string; afterContent: string }) =>
      seo.editSopDraft(id, afterContent),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seo'] });
    },
  });
}

export function useSeoSettings() {
  return useQuery({
    queryKey: ['seo', 'settings'],
    queryFn: () => seo.getSettings(),
  });
}

export function useUpdateSeoSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof seo.updateSettings>[0]) =>
      seo.updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seo', 'settings'] });
    },
  });
}

export function useSeoSources() {
  return useQuery({
    queryKey: ['seo', 'sources'],
    queryFn: () => seo.listSources(),
  });
}

export function useCreateSeoSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof seo.createSource>[0]) =>
      seo.createSource(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seo', 'sources'] });
    },
  });
}

export function useUpdateSeoSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof seo.updateSource>[1] }) =>
      seo.updateSource(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seo', 'sources'] });
    },
  });
}

export function useSeedSeoSources() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => seo.seedSources(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seo', 'sources'] });
    },
  });
}

export function useDeleteSeoSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => seo.deleteSource(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seo', 'sources'] });
    },
  });
}
