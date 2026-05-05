import { Effect, Layer } from 'effect';
import type { DeviceType } from '../../shared/types';
import type { GameSteps } from '../types';
import { cache, type StepCache, type StepCacheKey } from './cache';
import { disk } from './disk';

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
    const stepCache = cache.createStepCache(disk.createDiskStore());

    return {
      getSteps: (key: StepCacheKey) => {
        return Effect.sync(() => {
          return stepCache.getSteps(key);
        });
      },
      setSteps: (key: StepCacheKey, steps: GameSteps) => {
        return Effect.sync(() => {
          return stepCache.setSteps(key, steps);
        });
      },
      clearAllSteps: (id: string) => {
        return Effect.sync(() => {
          return stepCache.clearAllSteps(id);
        });
      },
      clearSteps: (id: string, deviceType: DeviceType) => {
        return Effect.sync(() => {
          return stepCache.clearChannelSteps(id, deviceType);
        });
      },
      loadAll: () => {
        return Effect.sync(() => {
          return stepCache.loadAll();
        });
      },
    };
  })(),
);
