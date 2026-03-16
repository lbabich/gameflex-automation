import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

type Settings = {
  headless: boolean;
};

export function useSettings() {
  const queryClient = useQueryClient();

  const query = useQuery<Settings>({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error('Failed to fetch settings');
      return res.json() as Promise<Settings>;
    },
  });

  const mutation = useMutation({
    mutationFn: async (headless: boolean) => {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headless }),
      });
      if (!res.ok) throw new Error('Failed to update settings');
      return res.json() as Promise<Settings>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['settings'], data);
    },
  });

  const headless = query.data?.headless ?? true;

  return {
    headless,
    isLoading: query.isLoading,
    toggle: () => mutation.mutate(!headless),
    isToggling: mutation.isPending,
  };
}
