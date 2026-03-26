import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
    fileParallelism: false,
    env: {
      GAMES_JSON_PATH: 'src/server/data/games.test.json',
    },
  },
});
