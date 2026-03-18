import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { DeviceType } from '../types';

export function useClearChannelSteps() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, deviceType }: { id: string; deviceType: DeviceType }) => {
      const res = await fetch(`/api/games/${id}/steps/${deviceType}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to clear steps');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['games'] });
    },
  });
}
