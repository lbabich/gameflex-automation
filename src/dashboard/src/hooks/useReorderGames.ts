import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { GameEntry } from '@shared/types';
import { reorderGames } from '../api';
import { QUERY_KEY } from '../queryKeys';

export function useReorderGames() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => reorderGames(ids),
    onMutate: async (ids: string[]) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY.GAMES });

      const previous = queryClient.getQueryData<GameEntry[]>(QUERY_KEY.GAMES);

      queryClient.setQueryData<GameEntry[]>(QUERY_KEY.GAMES, (old) =>
        ids.map((id) => old?.find((g) => g.id === id)).filter(Boolean) as GameEntry[],
      );

      return { previous };
    },
    onError: (_err, _ids, context) => {
      if (context?.previous) {
        queryClient.setQueryData(QUERY_KEY.GAMES, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY.GAMES });
    },
  });
}
