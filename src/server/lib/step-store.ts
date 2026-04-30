import * as fs from 'node:fs';
import * as path from 'node:path';
import type { GameSteps } from '../types';

type StepMap = Record<string, GameSteps>;
type ViewportMap = Record<string, StepMap>;
type DeviceMap = Record<string, ViewportMap>;
type StepCache = Record<string, DeviceMap>;

type StepStore = {
  load(): StepCache;
  save(cache: StepCache): void;
};

const CACHE_PATH = path.resolve('src', 'server', 'data', 'game-steps.json');

export function createDiskStore(): StepStore {
  return {
    load() {
      try {
        return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')) as StepCache;
      } catch (error) {
        console.warn('[step-cache] Failed to load cache, starting fresh:', error);

        return {};
      }
    },

    save(cache: StepCache) {
      fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
      fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
    },
  };
}

export type { StepCache, StepStore };
