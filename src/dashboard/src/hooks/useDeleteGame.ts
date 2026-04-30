import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteGame } from '../api';
import { QUERY_KEY } from '../queryKeys';

export function useDeleteGame() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteGame(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY.GAMES });
    },
  });
}
