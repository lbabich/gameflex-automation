import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/server/tests/**/*.test.ts'],
    fileParallelism: false,
    env: {
      GAMES_JSON_PATH: 'src/server/data/games.test.json',
    },
  },
});
