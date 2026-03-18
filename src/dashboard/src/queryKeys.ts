export const QUERY_KEY = {
  GAMES: ['games'] as const,
  RUNS: ['runs'] as const,
  run: (runId: string | null) => ['run', runId] as const,
} as const;
