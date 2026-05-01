import * as fs from 'node:fs';
import * as path from 'node:path';
import type { DeviceType } from '../shared/types';
import type { GameSteps, Viewport } from './types';

type StepMap = Record<string, GameSteps>;
type ViewportMap = Record<string, StepMap>;
type DeviceMap = Record<string, ViewportMap>;
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

const CACHE_PATH = path.resolve('src', 'core', 'data', 'game-steps.json');

function createDiskStore(): StepStore {
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

export function createStepCache(store: StepStore) {
  const pending = new Map<string, GameSteps>();

  function getSteps(key: StepCacheKey) {
    const cache = store.load();

    return cache[key.id]?.[key.deviceType]?.[viewportKey(key.viewport)]?.[key.stepName];
  }

  /**
   * Writes directly to the store. Use for partial/failure saves where you want
   * the result preserved even if the overall run fails.
   */
  function setSteps(key: StepCacheKey, steps: GameSteps) {
    const cache = store.load();
    const vpKey = viewportKey(key.viewport);

    cache[key.id] ??= {};
    cache[key.id][key.deviceType] ??= {};
    cache[key.id][key.deviceType][vpKey] ??= {};
    cache[key.id][key.deviceType][vpKey][key.stepName] = steps;

    store.save(cache);
  }

  /**
   * Stores steps in memory only. Call saveToCache() once all discovery
   * steps have succeeded to write everything atomically.
   */
  function setPendingSteps(key: StepCacheKey, steps: GameSteps) {
    pending.set(pendingKey(key), steps);
  }

  /**
   * Writes all pending in-memory steps to the store and clears the pending map.
   * Call this after all discovery steps have completed successfully.
   */
  function saveToCache() {
    if (pending.size === 0) {
      return;
    }

    const cache = store.load();

    for (const [key, steps] of pending.entries()) {
      const [id, deviceType, vpKey, stepName] = key.split('/');

      cache[id] ??= {};
      cache[id][deviceType] ??= {};
      cache[id][deviceType][vpKey] ??= {};
      cache[id][deviceType][vpKey][stepName] = steps;
    }

    store.save(cache);
    pending.clear();
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

  return {
    getSteps,
    setSteps,
    setPendingSteps,
    saveToCache,
    clearAllSteps,
    clearChannelSteps,
    loadAll,
  };
}

function pendingKey(key: StepCacheKey) {
  return `${key.id}/${key.deviceType}/${viewportKey(key.viewport)}/${key.stepName}`;
}

function viewportKey(viewport: Viewport) {
  return `${viewport.width}x${viewport.height}`;
}

const diskStore = createDiskStore();
export const stepCache = createStepCache(diskStore);
