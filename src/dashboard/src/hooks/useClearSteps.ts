import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useClearSteps() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (gameId: string) => {
      const res = await fetch(`/api/games/${gameId}/steps`, {
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
