import { useMutation, useQueryClient } from '@tanstack/react-query';
import { clearGameMemory } from '../shared/api';
import { QUERY_KEY } from '../shared/queryKeys';

export function useClearGameMemory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (gameID: string) => clearGameMemory(gameID),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY.GAMES });
      queryClient.invalidateQueries({ queryKey: QUERY_KEY.RUNS });
    },
  });
}
