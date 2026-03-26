import { useMutation, useQueryClient } from '@tanstack/react-query';
import { clearGameRuns } from '../api';
import { QUERY_KEY } from '../queryKeys';

export function useClearGameRuns() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (gameID: string) => clearGameRuns(gameID),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY.RUNS });
    },
  });
}
