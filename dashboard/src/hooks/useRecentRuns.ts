import { useQuery } from '@tanstack/react-query';
import type { RunRecord } from '../types';

export function useRecentRuns() {
  return useQuery<RunRecord[]>({
    queryKey: ['runs'],
    queryFn: async () => {
      const res = await fetch('/api/runs');

      if (!res.ok) throw new Error('Failed to fetch runs');

      return res.json() as Promise<RunRecord[]>;
    },
    staleTime: 0,
    refetchInterval: (query) => {
      return query.state.data?.some((r) => r.status === 'running') ? 1500 : false;
    },
  });
}
