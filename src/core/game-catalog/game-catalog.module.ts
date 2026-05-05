import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Effect, Layer } from 'effect';
import type { GameEntry, GameUpdates } from '../../shared/types';
import { DuplicateGameIDError, GameNotFoundError } from '../errors';
import { StepCacheService } from '../step-cache/service';

export class GamesService extends Effect.Tag('GamesService')<
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

export const NodeGamesService = Layer.effect(
  GamesService,
  Effect.gen(function* () {
    const stepCacheService = yield* StepCacheService;

    return {
      list: () => {
        return Effect.sync(() => {
          return readGames();
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
            return addGame(entry);
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
              return updateGame(id, updates);
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
              return deleteGame(id);
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
          return reorderGames(ids);
        });
      },
    };
  }),
);

function addGame(entry: Omit<GameEntry, 'id'> & { id?: string }) {
  const games = readGames();

  if (
    games.some((game: GameEntry) => {
      return game.desktopGameID === entry.desktopGameID;
    })
  ) {
    throw new Error(`Game with ID ${entry.desktopGameID} already exists`);
  }

  const full = { ...entry, id: entry.id ?? crypto.randomUUID() };

  games.push(full);
  writeGamesToDisk(games);
}

function updateGame(id: string, updates: GameUpdates) {
  const games = readGames();
  const index = games.findIndex((game: GameEntry) => {
    return game.id === id;
  });

  if (index === -1) {
    throw new Error(`Game ${id} not found`);
  }

  const game = games[index];

  const idChanged =
    (updates.desktopGameID !== undefined && updates.desktopGameID !== game.desktopGameID) ||
    (updates.mobileGameID !== undefined && updates.mobileGameID !== game.mobileGameID);

  games[index] = {
    ...game,
    name: updates.name ?? game.name,
    desktopGameID: updates.desktopGameID ?? game.desktopGameID,
    mobileGameID: updates.mobileGameID !== undefined ? updates.mobileGameID : game.mobileGameID,
    gameProviderID: updates.gameProviderID ?? game.gameProviderID,
  };

  writeGamesToDisk(games);

  return { idChanged };
}

function reorderGames(ids: string[]) {
  const games = readGames();

  const sorted = ids.map((id: string) => {
    const game = games.find((entry: GameEntry) => {
      return entry.id === id;
    });

    if (!game) {
      throw new Error(`Game ${id} not found`);
    }

    return game;
  });

  writeGamesToDisk(sorted);
}

function deleteGame(id: string) {
  const games = readGames();
  const index = games.findIndex((game: GameEntry) => {
    return game.id === id;
  });

  if (index === -1) {
    throw new Error(`Game ${id} not found`);
  }

  games.splice(index, 1);
  writeGamesToDisk(games);
}

function readGames() {
  let entries: unknown[];

  try {
    entries = JSON.parse(fs.readFileSync(gamesPath(), 'utf8')) as unknown[];
  } catch {
    return [];
  }

  let dirty = false;

  const games = entries.map((entry: unknown) => {
    const game = entry as Record<string, unknown>;

    if (!game.id) {
      game.id = crypto.randomUUID();
      dirty = true;
    }

    if ('desktopGameId' in game && !('desktopGameID' in game)) {
      game.desktopGameID = game.desktopGameId;
      delete game.desktopGameId;
      dirty = true;
    }

    if ('mobileGameId' in game && !('mobileGameID' in game)) {
      game.mobileGameID = game.mobileGameId;
      delete game.mobileGameId;
      dirty = true;
    }

    if (game.gameProviderID === undefined) {
      game.gameProviderID = '';
      dirty = true;
    }

    return game as unknown as GameEntry;
  });

  if (dirty) {
    writeGamesToDisk(games);
  }

  return games;
}

function writeGamesToDisk(entries: GameEntry[]) {
  fs.mkdirSync(path.dirname(gamesPath()), { recursive: true });
  fs.writeFileSync(gamesPath(), JSON.stringify(entries, null, 2));
}

function gamesPath() {
  return process.env.GAMES_JSON_PATH
    ? path.resolve(process.env.GAMES_JSON_PATH)
    : path.resolve('src', 'core', 'data', 'games.json');
}
