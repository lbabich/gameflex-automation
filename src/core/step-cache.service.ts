import { Effect, Layer } from 'effect';
import type { DeviceType } from '../shared/types';
import { createDiskStore, createStepCache, type StepCache, type StepCacheKey } from './step-cache';
import type { GameSteps, Viewport } from './types';

export class StepCacheService extends Effect.Tag('StepCacheService')<
  StepCacheService,
  {
    getSteps: (key: StepCacheKey) => Effect.Effect<GameSteps | undefined>;
    setSteps: (key: StepCacheKey, steps: GameSteps) => Effect.Effect<void>;
    clearAllSteps: (id: string) => Effect.Effect<void>;
    clearSteps: (id: string, deviceType: DeviceType) => Effect.Effect<void>;
    loadAll: () => Effect.Effect<StepCache>;
  }
>() {}

export const NodeStepCacheService = Layer.succeed(
  StepCacheService,
  (() => {
    const cache = createStepCache(createDiskStore());

    return {
      getSteps: (key: StepCacheKey) => {
        return Effect.sync(() => {
          return cache.getSteps(key);
        });
      },
      setSteps: (key: StepCacheKey, steps: GameSteps) => {
        return Effect.sync(() => {
          return cache.setSteps(key, steps);
        });
      },
      clearAllSteps: (id: string) => {
        return Effect.sync(() => {
          return cache.clearAllSteps(id);
        });
      },
      clearSteps: (id: string, deviceType: DeviceType) => {
        return Effect.sync(() => {
          return cache.clearChannelSteps(id, deviceType);
        });
      },
      loadAll: () => {
        return Effect.sync(() => {
          return cache.loadAll();
        });
      },
    };
  })(),
);

export function makeTestStepCacheService() {
  const store = new Map<string, GameSteps>();

  function cacheKey(key: StepCacheKey) {
    return `${key.id}/${key.deviceType}/${viewportKey(key.viewport)}/${key.stepName}`;
  }

  return Layer.succeed(StepCacheService, {
    getSteps: (key: StepCacheKey) => {
      return Effect.sync(() => {
        return store.get(cacheKey(key));
      });
    },

    setSteps: (key: StepCacheKey, steps: GameSteps) => {
      return Effect.sync(() => {
        store.set(cacheKey(key), steps);
      });
    },

    clearAllSteps: (id: string) => {
      return Effect.sync(() => {
        for (const k of store.keys()) {
          if (k.startsWith(`${id}/`)) {
            store.delete(k);
          }
        }
      });
    },

    clearSteps: (id: string, deviceType: DeviceType) => {
      return Effect.sync(() => {
        for (const k of store.keys()) {
          if (k.startsWith(`${id}/${deviceType}/`)) {
            store.delete(k);
          }
        }
      });
    },

    loadAll: () => {
      return Effect.sync(() => {
        const cache: StepCache = {};

        for (const [k, steps] of store.entries()) {
          const parts = k.split('/');
          const id = parts[0];
          const deviceType = parts[1];
          const vpKey = parts[2];
          const stepName = parts[3];

          cache[id] ??= {};
          cache[id][deviceType] ??= {};
          cache[id][deviceType][vpKey] ??= {};
          cache[id][deviceType][vpKey][stepName] = steps;
        }

        return cache;
      });
    },
  });
}

function viewportKey(viewport: Viewport) {
  return `${viewport.width}x${viewport.height}`;
}
