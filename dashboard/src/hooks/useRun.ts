import { useQuery } from '@tanstack/react-query';
import type { RunRecord } from '../types';

export function useRun(runId: string | null) {
  return useQuery<RunRecord>({
    queryKey: ['run', runId],
    queryFn: async () => {
      const res = await fetch(`/api/runs/${runId}`);
      if (!res.ok) throw new Error('Failed to fetch run');
      return res.json() as Promise<RunRecord>;
    },
    enabled: runId !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'running' ? 1500 : false;
    },
  });
}
