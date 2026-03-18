import { useQuery } from '@tanstack/react-query';
import { QUERY_KEY } from '../queryKeys';
import type { GameEntry } from '../types';

export function useGames() {
  return useQuery<GameEntry[]>({
    queryKey: QUERY_KEY.GAMES,
    queryFn: async () => {
      const res = await fetch('/api/games');
      if (!res.ok) throw new Error('Failed to fetch games');
      return res.json() as Promise<GameEntry[]>;
    },
    staleTime: Infinity,
  });
}
