import * as fs from 'node:fs';
import * as path from 'node:path';
import type { StepCache, StepStore } from './cache';

export const CACHE_PATH = path.resolve('src', 'core', 'data', 'game-steps.json');

export function createDiskStore(): StepStore {
  return {
    load() {
      try {
        return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')) as StepCache;
      } catch {
        return {};
      }
    },

    save(cache: StepCache) {
      fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
      fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
    },
  };
}
