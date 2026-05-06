import { Effect, Layer } from 'effect';
import type { DeviceType, GameEntry, GameUpdates } from '../../shared/types';
import { DuplicateGameIDError, GameNotFoundError } from '../errors';
import { StepCacheService } from '../step-cache/service';
import { disk } from './disk';

export type GameRepository = {
  readAll(): GameEntry[];
  add(entry: Omit<GameEntry, 'id'>): void;
  update(id: string, updates: GameUpdates): { idChanged: boolean };
  delete(id: string): void;
  reorder(ids: string[]): void;
};

export class GamesService extends Effect.Tag('GamesService')<
  GamesService,
  {
    list: () => Effect.Effect<GameEntry[]>;
    getCachedDeviceMap: () => Effect.Effect<Map<string, { desktop: boolean; mobile: boolean }>>;
    add: (entry: Omit<GameEntry, 'id'>) => Effect.Effect<void, DuplicateGameIDError>;
    update: (id: string, updates: GameUpdates) => Effect.Effect<void, GameNotFoundError>;
    delete: (id: string) => Effect.Effect<void, GameNotFoundError>;
    reorder: (ids: string[]) => Effect.Effect<void>;
    clearAllSteps: (id: string) => Effect.Effect<void>;
    clearSteps: (id: string, deviceType: DeviceType) => Effect.Effect<void>;
  }
>() {}

export const NodeGamesService = Layer.effect(
  GamesService,
  Effect.gen(function* () {
    const stepCacheService = yield* StepCacheService;
    const repo = disk.createDiskGameRepository();

    return {
      list: () => {
        return Effect.sync(() => {
          return repo.readAll();
        });
      },

      getCachedDeviceMap: () => {
        return Effect.gen(function* () {
          const cache = yield* stepCacheService.loadAll();
          const result = new Map<string, { desktop: boolean; mobile: boolean }>();

          for (const [gameID, devices] of Object.entries(cache)) {
            result.set(gameID, {
              desktop: 'desktop' in devices,
              mobile: 'mobile' in devices,
            });
          }

          return result;
        });
      },

      add: (entry: Omit<GameEntry, 'id'>) => {
        return Effect.try({
          try: () => {
            return repo.add(entry);
          },
          catch: (_error: unknown) => {
            return new DuplicateGameIDError({ desktopGameID: entry.desktopGameID });
          },
        });
      },

      update: (id: string, updates: GameUpdates) => {
        return Effect.gen(function* () {
          const result = yield* Effect.try({
            try: () => {
              return repo.update(id, updates);
            },
            catch: () => {
              return new GameNotFoundError({ id });
            },
          });

          if (result.idChanged) {
            yield* stepCacheService.clearAllSteps(id);
          }
        });
      },

      delete: (id: string) => {
        return Effect.gen(function* () {
          yield* Effect.try({
            try: () => {
              return repo.delete(id);
            },
            catch: () => {
              return new GameNotFoundError({ id });
            },
          });

          yield* stepCacheService.clearAllSteps(id);
        });
      },

      reorder: (ids: string[]) => {
        return Effect.sync(() => {
          return repo.reorder(ids);
        });
      },

      clearAllSteps: (id: string) => {
        return stepCacheService.clearAllSteps(id);
      },

      clearSteps: (id: string, deviceType: DeviceType) => {
        return stepCacheService.clearSteps(id, deviceType);
      },
    };
  }),
);
