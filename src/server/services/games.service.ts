import { Effect, Layer } from 'effect';
import type { GameEntry, GameUpdates } from '../../shared/types';
import { DuplicateGameIDError, GameNotFoundError } from '../errors';
import * as games from '../lib/games';
import { stepCache } from '../lib/step-cache';

class GamesService extends Effect.Tag('GamesService')<
  GamesService,
  {
    list: () => Effect.Effect<GameEntry[]>;
    getCachedDeviceMap: () => Effect.Effect<Map<string, { desktop: boolean; mobile: boolean }>>;
    add: (entry: Omit<GameEntry, 'id'>) => Effect.Effect<void, DuplicateGameIDError>;
    update: (id: string, updates: GameUpdates) => Effect.Effect<void, GameNotFoundError>;
    delete: (id: string) => Effect.Effect<void, GameNotFoundError>;
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
      const cache = stepCache.loadAll();
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
        return games.addGame(entry);
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
          return games.updateGame(id, updates);
        },
        catch: () => {
          return new GameNotFoundError({ id });
        },
      });

      if (result.idChanged) {
        stepCache.clearAllSteps(id);
      }
    });
  },

  delete: (id: string) => {
    return Effect.gen(function* () {
      yield* Effect.try({
        try: () => {
          return games.deleteGame(id);
        },
        catch: () => {
          return new GameNotFoundError({ id });
        },
      });

      stepCache.clearAllSteps(id);
    });
  },

  reorder: (ids: string[]) => {
    return Effect.sync(() => {
      return games.reorderGames(ids);
    });
  },
});

export { GamesService };
