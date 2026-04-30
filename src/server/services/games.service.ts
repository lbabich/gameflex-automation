import { Effect, Layer } from 'effect';
import type { DeviceType } from '../../shared/types';
import { DuplicateGameIDError, GameNotFoundError } from '../errors';
import * as games from '../lib/games';
import * as stepCache from '../lib/step-cache';

class GamesService extends Effect.Tag('GamesService')<
  GamesService,
  {
    list: () => Effect.Effect<games.GameEntry[]>;
    getCachedDeviceMap: () => Effect.Effect<Map<string, { desktop: boolean; mobile: boolean }>>;
    add: (entry: Omit<games.GameEntry, 'id'>) => Effect.Effect<void, DuplicateGameIDError>;
    update: (id: string, updates: games.GameUpdates) => Effect.Effect<void, GameNotFoundError>;
    delete: (id: string) => Effect.Effect<void, GameNotFoundError>;
    clearAllSteps: (id: string) => Effect.Effect<void>;
    clearSteps: (id: string, deviceType: DeviceType) => Effect.Effect<void>;
    reorder: (ids: string[]) => Effect.Effect<void>;
  }
>() {}

export const NodeGamesService = Layer.succeed(GamesService, {
  list: () => {
    return Effect.sync(() => {
      return games.readGames();
    });
  },

  getCachedDeviceMap: () => {
    return Effect.sync(() => {
      return stepCache.getCachedDeviceMap();
    });
  },

  add: (entry: Omit<games.GameEntry, 'id'>) => {
    return Effect.try({
      try: () => {
        return games.addGame(entry);
      },
      catch: (_error: unknown) => {
        return new DuplicateGameIDError({ desktopGameID: entry.desktopGameID });
      },
    });
  },

  update: (id: string, updates: games.GameUpdates) => {
    return Effect.try({
      try: () => {
        return games.updateGame(id, updates);
      },
      catch: (_error: unknown) => {
        return new GameNotFoundError({ id });
      },
    });
  },

  delete: (id: string) => {
    return Effect.try({
      try: () => {
        return games.deleteGame(id);
      },
      catch: (_error: unknown) => {
        return new GameNotFoundError({ id });
      },
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

  reorder: (ids: string[]) => {
    return Effect.sync(() => {
      return games.reorderGames(ids);
    });
  },
});

export { GamesService };
