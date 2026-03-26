import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateGame } from '../api';
import { QUERY_KEY } from '../queryKeys';
import type { GameUpdates } from '../api';

type MutationInput = { id: string } & GameUpdates;

export function useUpdateGame() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...updates }: MutationInput) => updateGame(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY.GAMES });
    },
  });
}
