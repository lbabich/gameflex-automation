import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Effect, ManagedRuntime } from 'effect';
import { beforeEach, describe, expect, it } from 'vitest';
import { DuplicateGameIDError, GameNotFoundError } from '../errors';
import * as stepCache from '../lib/step-cache';
import { GamesService, NodeGamesService } from '../services/games.service';

const GAMES_PATH = path.resolve(process.env.GAMES_JSON_PATH ?? 'src/data/games.json');
const runtime = ManagedRuntime.make(NodeGamesService);

beforeEach(() => {
  fs.writeFileSync(GAMES_PATH, '[]');
});

describe('GamesService', () => {
  it('list returns games that have been added', async () => {
    const entry = makeEntry();

    const result = await runtime.runPromise(
      Effect.gen(function* () {
        const SUT = yield* GamesService;

        yield* SUT.add(entry);

        return yield* SUT.list();
      }),
    );

    expect(
      result.some((game) => {
        return game.desktopGameID === entry.desktopGameID;
      }),
    ).toBe(true);
  });

  it('add fails with DuplicateGameIDError for a duplicate desktopGameID', async () => {
    const entry = makeEntry();

    const result = await runtime.runPromise(
      Effect.gen(function* () {
        const SUT = yield* GamesService;

        yield* SUT.add(entry);

        return yield* Effect.flip(SUT.add(entry));
      }),
    );

    expect(result).toBeInstanceOf(DuplicateGameIDError);
  });

  it('update fails with GameNotFoundError for an unknown id', async () => {
    const result = await runtime.runPromise(
      Effect.gen(function* () {
        const SUT = yield* GamesService;

        return yield* Effect.flip(SUT.update('nonexistent', { name: 'New Name' }));
      }),
    );

    expect(result).toBeInstanceOf(GameNotFoundError);
  });

  it('getCachedDeviceMap returns desktop: true for a game with desktop steps', async () => {
    const entry = makeEntry();
    const VP = { width: 1280, height: 720 };
    const cacheEntry = { discoveredAt: new Date().toISOString(), steps: [] };

    const [gameID, deviceMap] = await runtime.runPromise(
      Effect.gen(function* () {
        const SUT = yield* GamesService;

        yield* SUT.add(entry);

        const list = yield* SUT.list();

        const game = list.find((item) => {
          return item.desktopGameID === entry.desktopGameID;
        });

        if (!game) {
          throw new Error('game not found after add');
        }

        stepCache.setSteps(
          { id: game.id, deviceType: 'desktop', viewport: VP, stepName: 'spin-cycle' },
          cacheEntry,
        );

        const result = yield* SUT.getCachedDeviceMap();

        stepCache.clearAllSteps(game.id);

        return [game.id, result] as const;
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
        const SUT = yield* GamesService;

        yield* SUT.add(entry);

        const list = yield* SUT.list();

        const game = list.find((item) => {
          return item.desktopGameID === entry.desktopGameID;
        });

        if (!game) {
          throw new Error('game not found after add');
        }

        return game.id;
      }),
    );

    stepCache.setSteps(
      { id: gameID, deviceType: 'desktop', viewport: desktopVP, stepName: 'spin-cycle' },
      cacheEntry,
    );
    stepCache.setSteps(
      { id: gameID, deviceType: 'mobile', viewport: mobileVP, stepName: 'spin-cycle' },
      cacheEntry,
    );

    await runtime.runPromise(
      Effect.gen(function* () {
        const SUT = yield* GamesService;

        yield* SUT.clearAllSteps(gameID);
      }),
    );

    expect(
      stepCache.getSteps({
        id: gameID,
        deviceType: 'desktop',
        viewport: desktopVP,
        stepName: 'spin-cycle',
      }),
    ).toBeUndefined();
    expect(
      stepCache.getSteps({
        id: gameID,
        deviceType: 'mobile',
        viewport: mobileVP,
        stepName: 'spin-cycle',
      }),
    ).toBeUndefined();
  });

  it('clearSteps removes only the specified device steps', async () => {
    const entry = makeEntry();
    const desktopVP = { width: 1280, height: 720 };
    const mobileVP = { width: 390, height: 844 };
    const cacheEntry = { discoveredAt: new Date().toISOString(), steps: [] };

    const gameID = await runtime.runPromise(
      Effect.gen(function* () {
        const SUT = yield* GamesService;

        yield* SUT.add(entry);

        const list = yield* SUT.list();

        const game = list.find((item) => {
          return item.desktopGameID === entry.desktopGameID;
        });

        if (!game) {
          throw new Error('game not found after add');
        }

        return game.id;
      }),
    );

    stepCache.setSteps(
      { id: gameID, deviceType: 'desktop', viewport: desktopVP, stepName: 'spin-cycle' },
      cacheEntry,
    );
    stepCache.setSteps(
      { id: gameID, deviceType: 'mobile', viewport: mobileVP, stepName: 'spin-cycle' },
      cacheEntry,
    );

    await runtime.runPromise(
      Effect.gen(function* () {
        const SUT = yield* GamesService;

        yield* SUT.clearSteps(gameID, 'desktop');
      }),
    );

    expect(
      stepCache.getSteps({
        id: gameID,
        deviceType: 'desktop',
        viewport: desktopVP,
        stepName: 'spin-cycle',
      }),
    ).toBeUndefined();
    expect(
      stepCache.getSteps({
        id: gameID,
        deviceType: 'mobile',
        viewport: mobileVP,
        stepName: 'spin-cycle',
      }),
    ).toBeDefined();

    stepCache.clearAllSteps(gameID);
  });
});

function makeEntry() {
  return {
    desktopGameID: `test-${crypto.randomUUID()}`,
    name: 'Test Game',
    gameProviderID: '51',
  };
}
