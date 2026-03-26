import { useQuery } from '@tanstack/react-query';
import { getRun } from '../api';
import { QUERY_KEY } from '../queryKeys';

export function useRun(runID: string | null) {
  return useQuery({
    queryKey: QUERY_KEY.run(runID),
    queryFn: () => getRun(runID!),
    enabled: runID !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'running' ? 1500 : false;
    },
  });
}
