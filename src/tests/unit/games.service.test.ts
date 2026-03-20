import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Effect, ManagedRuntime } from 'effect';
import { beforeEach, describe, expect, it } from 'vitest';
import * as stepCache from '../../lib/step-cache';
import { DuplicateGameIDError, GameNotFoundError } from '../../server/errors';
import { GamesService, NodeGamesService } from '../../server/services/games.service';

const GAMES_PATH = path.resolve(process.env.GAMES_JSON_PATH ?? 'src/data/games.json');
const runtime = ManagedRuntime.make(NodeGamesService);

beforeEach(() => {
  fs.writeFileSync(GAMES_PATH, '[]');
});

function makeEntry() {
  return {
    desktopGameID: `test-${crypto.randomUUID()}`,
    name: 'Test Game',
    desktopEnabled: true as const,
    desktopPlaymode: 'demo' as const,
    mobileEnabled: false as const,
    mobilePlaymode: 'demo' as const,
  };
}

describe('GamesService', () => {
  it('list returns games that have been added', async () => {
    const entry = makeEntry();

    const games = await runtime.runPromise(
      Effect.gen(function* () {
        const service = yield* GamesService;

        yield* service.add(entry);

        return yield* service.list();
      }),
    );

    expect(
      games.some((game) => {
        return game.desktopGameID === entry.desktopGameID;
      }),
    ).toBe(true);
  });

  it('add fails with DuplicateGameIDError for a duplicate desktopGameID', async () => {
    const entry = makeEntry();

    const error = await runtime.runPromise(
      Effect.gen(function* () {
        const service = yield* GamesService;

        yield* service.add(entry);

        return yield* Effect.flip(service.add(entry));
      }),
    );

    expect(error).toBeInstanceOf(DuplicateGameIDError);
  });

  it('update fails with GameNotFoundError for an unknown id', async () => {
    const error = await runtime.runPromise(
      Effect.gen(function* () {
        const service = yield* GamesService;

        return yield* Effect.flip(service.update('nonexistent', { name: 'New Name' }));
      }),
    );

    expect(error).toBeInstanceOf(GameNotFoundError);
  });

  it('getCachedDeviceMap returns desktop: true for a game with desktop steps', async () => {
    const entry = makeEntry();
    const VP = { width: 1280, height: 720 };
    const cacheEntry = { discoveredAt: new Date().toISOString(), steps: [] };

    const [gameID, deviceMap] = await runtime.runPromise(
      Effect.gen(function* () {
        const service = yield* GamesService;

        yield* service.add(entry);

        const list = yield* service.list();

        const game = list.find((g) => {
          return g.desktopGameID === entry.desktopGameID;
        });

        if (!game) {
          throw new Error('game not found after add');
        }

        stepCache.setSteps(game.id, 'desktop', VP, cacheEntry);

        const map = yield* service.getCachedDeviceMap();

        stepCache.clearAllSteps(game.id);

        return [game.id, map] as const;
      }),
    );

    expect(deviceMap.get(gameID)?.desktop).toBe(true);
  });

  it('clearAllSteps removes all device steps for a game', async () => {
    const entry = makeEntry();
    const desktopVP = { width: 1280, height: 720 };
    const mobileVP = { width: 390, height: 844 };
    const cacheEntry = { discoveredAt: new Date().toISOString(), steps: [] };

    const gameID = await runtime.runPromise(
      Effect.gen(function* () {
        const service = yield* GamesService;

        yield* service.add(entry);

        const list = yield* service.list();

        const game = list.find((g) => {
          return g.desktopGameID === entry.desktopGameID;
        });

        if (!game) {
          throw new Error('game not found after add');
        }

        return game.id;
      }),
    );

    stepCache.setSteps(gameID, 'desktop', desktopVP, cacheEntry);
    stepCache.setSteps(gameID, 'mobile', mobileVP, cacheEntry);

    await runtime.runPromise(
      Effect.gen(function* () {
        const service = yield* GamesService;

        yield* service.clearAllSteps(gameID);
      }),
    );

    expect(stepCache.getSteps(gameID, 'desktop', desktopVP)).toBeUndefined();
    expect(stepCache.getSteps(gameID, 'mobile', mobileVP)).toBeUndefined();
  });

  it('clearSteps removes only the specified device steps', async () => {
    const entry = makeEntry();
    const desktopVP = { width: 1280, height: 720 };
    const mobileVP = { width: 390, height: 844 };
    const cacheEntry = { discoveredAt: new Date().toISOString(), steps: [] };

    const gameID = await runtime.runPromise(
      Effect.gen(function* () {
        const service = yield* GamesService;

        yield* service.add(entry);

        const list = yield* service.list();

        const game = list.find((g) => {
          return g.desktopGameID === entry.desktopGameID;
        });

        if (!game) {
          throw new Error('game not found after add');
        }

        return game.id;
      }),
    );

    stepCache.setSteps(gameID, 'desktop', desktopVP, cacheEntry);
    stepCache.setSteps(gameID, 'mobile', mobileVP, cacheEntry);

    await runtime.runPromise(
      Effect.gen(function* () {
        const service = yield* GamesService;

        yield* service.clearSteps(gameID, 'desktop');
      }),
    );

    expect(stepCache.getSteps(gameID, 'desktop', desktopVP)).toBeUndefined();
    expect(stepCache.getSteps(gameID, 'mobile', mobileVP)).toBeDefined();

    stepCache.clearAllSteps(gameID);
  });
});
