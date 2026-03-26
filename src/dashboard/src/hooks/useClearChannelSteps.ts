import { useMutation, useQueryClient } from '@tanstack/react-query';
import { clearChannelSteps } from '../api';
import { QUERY_KEY } from '../queryKeys';
import type { DeviceType } from '../types';

export function useClearChannelSteps() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, deviceType }: { id: string; deviceType: DeviceType }) =>
      clearChannelSteps(id, deviceType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY.GAMES });
    },
  });
}
