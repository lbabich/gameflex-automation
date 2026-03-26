import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createGame } from '../api';
import { QUERY_KEY } from '../queryKeys';
import type { NewGame } from '../api';

export function useAddGame() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (game: NewGame) => createGame(game),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY.GAMES });
    },
  });
}
