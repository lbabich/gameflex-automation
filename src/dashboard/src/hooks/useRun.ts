import { useQuery } from '@tanstack/react-query';
import { QUERY_KEY } from '../queryKeys';
import type { RunRecord } from '../types';

export function useRun(runID: string | null) {
  return useQuery<RunRecord>({
    queryKey: QUERY_KEY.run(runID),
    queryFn: async () => {
      const res = await fetch(`/api/runs/${runID}`);
      if (!res.ok) throw new Error('Failed to fetch run');
      return res.json() as Promise<RunRecord>;
    },
    enabled: runID !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'running' ? 1500 : false;
    },
  });
}
