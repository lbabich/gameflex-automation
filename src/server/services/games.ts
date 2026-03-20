import { Effect, Layer } from 'effect';
import * as games from '../../lib/games';
import * as stepCache from '../../lib/step-cache';
import type * as libTypes from '../../lib/types';
import { DuplicateGameIdError, GameNotFoundError } from '../errors';

export class GamesService extends Effect.Tag('GamesService')<
  GamesService,
  {
    list: () => Effect.Effect<games.GameEntry[]>;
    getCachedDeviceMap: () => Effect.Effect<Map<string, { desktop: boolean; mobile: boolean }>>;
    add: (entry: Omit<games.GameEntry, 'id'>) => Effect.Effect<void, DuplicateGameIdError>;
    update: (id: string, updates: games.GameUpdates) => Effect.Effect<void, GameNotFoundError>;
    clearAllSteps: (id: string) => Effect.Effect<void>;
    clearSteps: (id: string, deviceType: libTypes.DeviceType) => Effect.Effect<void>;
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

  add: (entry) => {
    return Effect.try({
      try: () => {
        return games.addGame(entry);
      },
      catch: (_err) => {
        return new DuplicateGameIdError({ desktopGameID: entry.desktopGameID });
      },
    });
  },

  update: (id, updates) => {
    return Effect.try({
      try: () => {
        return games.updateGame(id, updates);
      },
      catch: (_err) => {
        return new GameNotFoundError({ id });
      },
    });
  },

  clearAllSteps: (id) => {
    return Effect.sync(() => {
      return stepCache.clearAllSteps(id);
    });
  },

  clearSteps: (id, deviceType) => {
    return Effect.sync(() => {
      return stepCache.clearChannelSteps(id, deviceType);
    });
  },
});
