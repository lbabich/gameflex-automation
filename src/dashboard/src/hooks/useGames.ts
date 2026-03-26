import { useQuery } from '@tanstack/react-query';
import { getGames } from '../api';
import { QUERY_KEY } from '../queryKeys';

export function useGames() {
  return useQuery({
    queryKey: QUERY_KEY.GAMES,
    queryFn: getGames,
    staleTime: Infinity,
  });
}
