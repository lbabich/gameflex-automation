import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useClearSteps() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/games/${id}/steps`, {
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
