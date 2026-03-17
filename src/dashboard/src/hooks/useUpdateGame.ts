import { useMutation, useQueryClient } from '@tanstack/react-query';

export type GameUpdates = {
  id: string;
  name?: string;
  desktopGameId?: string;
  mobileGameId?: string;
  playmode?: 'demo' | 'real';
  channel?: 'desktop' | 'mobile' | 'both';
};

export function useUpdateGame() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: GameUpdates) => {
      const res = await fetch(`/api/games/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? 'Failed to update game');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['games'] });
    },
  });
}
