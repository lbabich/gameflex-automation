import { useQuery } from '@tanstack/react-query';
import type { GameEntry } from '../types';

export function useGames() {
  return useQuery<GameEntry[]>({
    queryKey: ['games'],
    queryFn: async () => {
      const res = await fetch('/api/games');
      if (!res.ok) throw new Error('Failed to fetch games');
      return res.json() as Promise<GameEntry[]>;
    },
    staleTime: Infinity,
  });
}
