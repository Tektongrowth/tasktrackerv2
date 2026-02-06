import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ThemeSettings, defaultTheme, applyTheme } from '@/lib/theme';
import { fetchApi } from '@/lib/api';
import { toast } from '@/components/ui/toaster';

async function fetchTheme(): Promise<ThemeSettings> {
  try {
    return await fetchApi<ThemeSettings>('/api/app-settings/theme');
  } catch {
    return defaultTheme;
  }
}

async function updateThemeApi(theme: ThemeSettings): Promise<ThemeSettings> {
  return fetchApi<ThemeSettings>('/api/app-settings/theme', {
    method: 'PATCH',
    body: JSON.stringify({ theme }),
  });
}

async function resetThemeApi(): Promise<ThemeSettings> {
  return fetchApi<ThemeSettings>('/api/app-settings/theme/reset', {
    method: 'POST',
  });
}

export function useTheme() {
  const queryClient = useQueryClient();

  const { data: theme, isLoading } = useQuery({
    queryKey: ['theme'],
    queryFn: fetchTheme,
    staleTime: 1000 * 60 * 5, // 5 minutes - allow refetch on page reload
    retry: false,
  });

  const updateMutation = useMutation({
    mutationFn: updateThemeApi,
    onSuccess: (newTheme) => {
      queryClient.setQueryData(['theme'], newTheme);
      applyTheme(newTheme);
      toast({ title: 'Theme saved' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to save theme', description: error.message, variant: 'destructive' });
    },
  });

  const resetMutation = useMutation({
    mutationFn: resetThemeApi,
    onSuccess: (newTheme) => {
      queryClient.invalidateQueries({ queryKey: ['theme'] });
      queryClient.setQueryData(['theme'], newTheme);
      applyTheme(newTheme);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to reset theme', description: error.message, variant: 'destructive' });
    },
  });

  // Apply theme on load and when it changes
  useEffect(() => {
    if (theme) {
      applyTheme(theme);
    }
  }, [theme]);

  return {
    theme: theme || defaultTheme,
    isLoading,
    updateTheme: updateMutation.mutate,
    resetTheme: resetMutation.mutate,
    isUpdating: updateMutation.isPending,
    isResetting: resetMutation.isPending,
  };
}
