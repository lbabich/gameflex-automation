import { useMutation, useQueryClient } from '@tanstack/react-query';
import { clearSteps } from '../api';
import { QUERY_KEY } from '../queryKeys';

export function useClearSteps() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => clearSteps(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY.GAMES });
    },
  });
}
