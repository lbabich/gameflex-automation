import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { DeviceType, GameEntry } from '@shared/types';
import {
  clearChannelSteps,
  clearSteps,
  createGame,
  deleteGame,
  reorderGames,
  updateGame,
} from '../shared/api';
import type { GameUpdates, NewGame } from '../shared/api';
import { QUERY_KEY } from '../shared/queryKeys';

export function useGameCatalog() {
  const queryClient = useQueryClient();

  function invalidateGames() {
    queryClient.invalidateQueries({ queryKey: QUERY_KEY.GAMES });
  }

  const add = useMutation({
    mutationFn: (game: NewGame) => createGame(game),
    onSuccess: invalidateGames,
  });

  const update = useMutation({
    mutationFn: ({ id, ...updates }: { id: string } & GameUpdates) => updateGame(id, updates),
    onSuccess: invalidateGames,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteGame(id),
    onSuccess: invalidateGames,
  });

  const clearAllSteps = useMutation({
    mutationFn: (id: string) => clearSteps(id),
    onSuccess: invalidateGames,
  });

  const clearDeviceSteps = useMutation({
    mutationFn: ({ id, deviceType }: { id: string; deviceType: DeviceType }) =>
      clearChannelSteps(id, deviceType),
    onSuccess: invalidateGames,
  });

  const reorder = useMutation({
    mutationFn: (ids: string[]) => reorderGames(ids),
    onMutate: async (ids) => {
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
    onSettled: invalidateGames,
  });

  return { add, update, remove, clearAllSteps, clearDeviceSteps, reorder };
}
