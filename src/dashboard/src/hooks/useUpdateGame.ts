import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEY } from '../queryKeys';
import type { PlayMode } from '../types';

export type GameUpdates = {
  id: string;
  name?: string;
  desktopGameId?: string;
  mobileGameId?: string;
  desktopEnabled?: boolean;
  desktopPlaymode?: PlayMode;
  mobileEnabled?: boolean;
  mobilePlaymode?: PlayMode;
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
      queryClient.invalidateQueries({ queryKey: QUERY_KEY.GAMES });
    },
  });
}
