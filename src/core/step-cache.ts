import * as fs from 'node:fs';
import * as path from 'node:path';
import type { DeviceType } from '../shared/types';
import type { GameSteps, Viewport } from './types';

export type StepCache = Record<string, DeviceMap>;

export type StepStore = {
  load(): StepCache;
  save(cache: StepCache): void;
};

export type StepCacheKey = {
  id: string;
  deviceType: DeviceType;
  viewport: Viewport;
  stepName: string;
};

export type NodeStepCache = ReturnType<typeof createStepCache>;

type StepMap = Record<string, GameSteps>;
type ViewportMap = Record<string, StepMap>;
type DeviceMap = Record<string, ViewportMap>;

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

export function createStepCache(store: StepStore) {
  function getSteps(key: StepCacheKey) {
    const cache = store.load();

    return cache[key.id]?.[key.deviceType]?.[viewportKey(key.viewport)]?.[key.stepName];
  }

  function setSteps(key: StepCacheKey, steps: GameSteps) {
    const cache = store.load();
    const vpKey = viewportKey(key.viewport);

    cache[key.id] ??= {};
    cache[key.id][key.deviceType] ??= {};
    cache[key.id][key.deviceType][vpKey] ??= {};
    cache[key.id][key.deviceType][vpKey][key.stepName] = steps;

    store.save(cache);
  }

  function clearAllSteps(id: string) {
    const cache = store.load();

    if (cache[id]) {
      delete cache[id];
      store.save(cache);
    }
  }

  function clearChannelSteps(id: string, deviceType: DeviceType) {
    const cache = store.load();

    if (cache[id]?.[deviceType]) {
      delete cache[id][deviceType];

      if (Object.keys(cache[id]).length === 0) {
        delete cache[id];
      }

      store.save(cache);
    }
  }

  function loadAll() {
    return store.load();
  }

  return { getSteps, setSteps, clearAllSteps, clearChannelSteps, loadAll };
}

function viewportKey(viewport: Viewport) {
  return `${viewport.width}x${viewport.height}`;
}
