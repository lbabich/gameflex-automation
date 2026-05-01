import { useQuery } from '@tanstack/react-query';
import { getGames } from '../shared/api';
import { QUERY_KEY } from '../shared/queryKeys';

export function useGames() {
  return useQuery({
    queryKey: QUERY_KEY.GAMES,
    queryFn: getGames,
    staleTime: Infinity,
  });
}
