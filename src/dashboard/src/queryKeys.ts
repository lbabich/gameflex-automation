export const QUERY_KEY = {
  GAMES: ['games'] as const,
  RUNS: ['runs'] as const,
  run: (runID: string | null) => ['run', runID] as const,
} as const;
