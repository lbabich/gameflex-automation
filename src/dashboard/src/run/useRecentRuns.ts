import { useQuery } from '@tanstack/react-query';
import { getRuns } from '../shared/api';
import { QUERY_KEY } from '../shared/queryKeys';

export function useRecentRuns() {
  return useQuery({
    queryKey: QUERY_KEY.RUNS,
    queryFn: getRuns,
    staleTime: 0,
    refetchInterval: (query) => {
      return query.state.data?.some((run) => run.status === 'running') ? 1500 : false;
    },
  });
}
