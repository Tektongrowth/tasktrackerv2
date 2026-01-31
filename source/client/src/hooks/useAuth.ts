import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { auth } from '@/lib/api';
import type { User, AccessLevel } from '@/lib/types';

export function useAuth() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: auth.me,
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes - auth doesn't change often
    gcTime: 1000 * 60 * 30, // Keep in cache for 30 minutes
  });

  const logoutMutation = useMutation({
    mutationFn: auth.logout,
    onSuccess: () => {
      queryClient.setQueryData(['auth', 'me'], null);
      window.location.href = '/login';
    },
  });

  const user = data?.user as User | undefined;
  const accessLevel: AccessLevel = user?.accessLevel || 'viewer';

  // Access level checks
  const isAdmin = user?.role === 'admin' || accessLevel === 'admin';
  const isProjectManager = isAdmin || accessLevel === 'project_manager';
  const canEdit = isProjectManager || accessLevel === 'editor';
  const canCreate = isProjectManager; // Only project_manager+ can create
  const canDelete = isAdmin; // Only admin can delete

  return {
    user,
    isLoading,
    error,
    accessLevel,
    isAdmin,
    isProjectManager,
    canEdit,
    canCreate,
    canDelete,
    logout: logoutMutation.mutate,
  };
}
