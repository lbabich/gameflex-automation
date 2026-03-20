import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEY } from '../queryKeys';

export type NewGame = {
  desktopGameID: string;
  mobileGameId?: string;
  name: string;
};

export function useAddGame() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (game: NewGame) => {
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(game),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? 'Failed to add game');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY.GAMES });
    },
  });
}
