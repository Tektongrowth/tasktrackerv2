import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ThemeSettings, defaultTheme, applyTheme } from '@/lib/theme';
import { toast } from '@/components/ui/toaster';

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.tektongrowth.com';

async function fetchTheme(): Promise<ThemeSettings> {
  const res = await fetch(`${API_BASE}/api/app-settings/theme`, {
    credentials: 'include',
    cache: 'no-store',
  });
  if (!res.ok) {
    return defaultTheme;
  }
  return res.json();
}

async function updateTheme(theme: ThemeSettings): Promise<ThemeSettings> {
  const res = await fetch(`${API_BASE}/api/app-settings/theme`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ theme }),
  });
  if (!res.ok) {
    throw new Error('Failed to update theme');
  }
  return res.json();
}

async function resetTheme(): Promise<ThemeSettings> {
  const res = await fetch(`${API_BASE}/api/app-settings/theme/reset`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error('Failed to reset theme');
  }
  return res.json();
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
    mutationFn: updateTheme,
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
    mutationFn: resetTheme,
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
