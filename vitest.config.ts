import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/core/**/*.test.ts'],
    fileParallelism: false,
    env: {
      GAMES_JSON_PATH: 'src/core/data/games.test.json',
    },
  },
});
