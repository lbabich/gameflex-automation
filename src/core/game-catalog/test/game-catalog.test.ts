import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { beforeEach, describe, expect, it } from 'vitest';
import { DuplicateGameIDError, GameNotFoundError } from '../../errors';
import { StepCacheService } from '../../step-cache/service';
import { makeTestStepCacheService } from '../../step-cache/test/step-cache-test.helper';
import { GamesService, NodeGamesService } from '../game-catalog.module';

const GAMES_PATH = path.resolve(process.env.GAMES_JSON_PATH ?? 'src/core/data/games.json');

const testStepCacheLayer = makeTestStepCacheService();
const runtime = ManagedRuntime.make(
  Layer.mergeAll(testStepCacheLayer, Layer.provide(NodeGamesService, testStepCacheLayer)),
);

beforeEach(() => {
  fs.writeFileSync(GAMES_PATH, '[]');
});

describe('GamesService', () => {
  describe('add', () => {
    it('assigns a UUID to new entries', async () => {
      const entry = makeEntry();

      const result = await runtime.runPromise(
        Effect.gen(function* () {
          const svc = yield* GamesService;

          yield* svc.add(entry);

          return yield* svc.list();
        }),
      );

      const added = result.find((game) => {
        return game.desktopGameID === entry.desktopGameID;
      });

      expect(added, 'added game should appear in list').toBeTruthy();
      expect(added?.id ?? '').toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it('rejects a duplicate desktopGameID with DuplicateGameIDError', async () => {
      const entry = makeEntry();

      const result = await runtime.runPromise(
        Effect.gen(function* () {
          const svc = yield* GamesService;

          yield* svc.add(entry);

          return yield* Effect.flip(svc.add(entry));
        }),
      );

      expect(result).toBeInstanceOf(DuplicateGameIDError);
    });
  });

  describe('list', () => {
    it('returns games that have been added', async () => {
      const entry = makeEntry();

      const result = await runtime.runPromise(
        Effect.gen(function* () {
          const svc = yield* GamesService;

          yield* svc.add(entry);

          return yield* svc.list();
        }),
      );

      expect(
        result.some((game) => {
          return game.desktopGameID === entry.desktopGameID;
        }),
      ).toBe(true);
    });

    it('migrates legacy entries (no id field) and persists back to disk', async () => {
      const desktopGameID = makeGameID();
      const legacy = JSON.stringify([{ desktopGameID, name: 'No ID Game', gameProviderID: '51' }]);

      fs.writeFileSync(GAMES_PATH, legacy);

      const result = await runtime.runPromise(
        Effect.gen(function* () {
          const svc = yield* GamesService;

          return yield* svc.list();
        }),
      );

      expect(result.length).toBe(1);
      expect(result[0].id, 'migrated entry should have an id').toBeTruthy();

      const onDisk = JSON.parse(fs.readFileSync(GAMES_PATH, 'utf8')) as typeof result;

      expect(onDisk[0].id, 'id should be persisted to disk').toBe(result[0].id);
    });
  });

  describe('update', () => {
    it('writes updated fields to disk', async () => {
      const entry = makeEntry();

      const result = await runtime.runPromise(
        Effect.gen(function* () {
          const svc = yield* GamesService;

          yield* svc.add(entry);

          const list = yield* svc.list();
          const game = list.find((g) => {
            return g.desktopGameID === entry.desktopGameID;
          });

          if (!game) {
            throw new Error('game not found after add');
          }

          yield* svc.update(game.id, { name: 'Updated Name' });

          return yield* svc.list();
        }),
      );

      const updated = result.find((g) => {
        return g.desktopGameID === entry.desktopGameID;
      });

      expect(updated?.name).toBe('Updated Name');
    });

    it('rejects unknown id with GameNotFoundError', async () => {
      const result = await runtime.runPromise(
        Effect.gen(function* () {
          const svc = yield* GamesService;

          return yield* Effect.flip(svc.update('nonexistent', { name: 'New Name' }));
        }),
      );

      expect(result).toBeInstanceOf(GameNotFoundError);
    });

    it('clears step cache when desktopGameID changes', async () => {
      const game = await addTestGame();
      const VP = { width: 1280, height: 720 };
      const steps = { discoveredAt: new Date().toISOString(), steps: [] };

      const cached = await runtime.runPromise(
        Effect.gen(function* () {
          const svc = yield* GamesService;
          const stepCacheSvc = yield* StepCacheService;

          yield* stepCacheSvc.setSteps(
            { id: game.id, deviceType: 'desktop', viewport: VP, stepName: 'spin-cycle' },
            steps,
          );

          yield* svc.update(game.id, { desktopGameID: makeGameID() });

          return yield* stepCacheSvc.getSteps({
            id: game.id,
            deviceType: 'desktop',
            viewport: VP,
            stepName: 'spin-cycle',
          });
        }),
      );

      expect(cached, 'cache should be cleared after ID change').toBeUndefined();
    });

    it('clears step cache when mobileGameID changes', async () => {
      const game = await addTestGame();
      const VP = { width: 390, height: 844 };
      const steps = { discoveredAt: new Date().toISOString(), steps: [] };

      const cached = await runtime.runPromise(
        Effect.gen(function* () {
          const svc = yield* GamesService;
          const stepCacheSvc = yield* StepCacheService;

          yield* stepCacheSvc.setSteps(
            { id: game.id, deviceType: 'mobile', viewport: VP, stepName: 'spin-cycle' },
            steps,
          );

          yield* svc.update(game.id, { mobileGameID: makeGameID() });

          return yield* stepCacheSvc.getSteps({
            id: game.id,
            deviceType: 'mobile',
            viewport: VP,
            stepName: 'spin-cycle',
          });
        }),
      );

      expect(cached, 'cache should be cleared after mobile ID change').toBeUndefined();
    });

    it('does not clear step cache when only name changes', async () => {
      const game = await addTestGame();
      const VP = { width: 1280, height: 720 };
      const steps = {
        discoveredAt: new Date().toISOString(),
        steps: [{ waitMs: 100, x: 10, y: 20, label: 'spin' }],
      };

      const cached = await runtime.runPromise(
        Effect.gen(function* () {
          const svc = yield* GamesService;
          const stepCacheSvc = yield* StepCacheService;

          yield* stepCacheSvc.setSteps(
            { id: game.id, deviceType: 'desktop', viewport: VP, stepName: 'spin-cycle' },
            steps,
          );

          yield* svc.update(game.id, { name: 'New Name' });

          return yield* stepCacheSvc.getSteps({
            id: game.id,
            deviceType: 'desktop',
            viewport: VP,
            stepName: 'spin-cycle',
          });
        }),
      );

      expect(cached, 'cache should survive a name-only update').toEqual(steps);
    });
  });

  describe('delete', () => {
    it('clears step cache entries for the deleted game', async () => {
      const game = await addTestGame();
      const VP = { width: 1280, height: 720 };
      const steps = { discoveredAt: new Date().toISOString(), steps: [] };

      const cached = await runtime.runPromise(
        Effect.gen(function* () {
          const svc = yield* GamesService;
          const stepCacheSvc = yield* StepCacheService;

          yield* stepCacheSvc.setSteps(
            { id: game.id, deviceType: 'desktop', viewport: VP, stepName: 'spin-cycle' },
            steps,
          );

          yield* svc.delete(game.id);

          return yield* stepCacheSvc.getSteps({
            id: game.id,
            deviceType: 'desktop',
            viewport: VP,
            stepName: 'spin-cycle',
          });
        }),
      );

      expect(cached, 'cache should be cleared after deletion').toBeUndefined();
    });
  });

  describe('getCachedDeviceMap', () => {
    it('maps cached step presence to {desktop, mobile} booleans', async () => {
      const entry = makeEntry();
      const VP = { width: 1280, height: 720 };
      const cacheEntry = { discoveredAt: new Date().toISOString(), steps: [] };

      const [gameID, deviceMap] = await runtime.runPromise(
        Effect.gen(function* () {
          const svc = yield* GamesService;
          const stepCacheSvc = yield* StepCacheService;

          yield* svc.add(entry);

          const list = yield* svc.list();
          const game = list.find((item) => {
            return item.desktopGameID === entry.desktopGameID;
          });

          if (!game) {
            throw new Error('game not found after add');
          }

          yield* stepCacheSvc.setSteps(
            { id: game.id, deviceType: 'desktop', viewport: VP, stepName: 'spin-cycle' },
            cacheEntry,
          );

          const result = yield* svc.getCachedDeviceMap();

          return [game.id, result] as const;
        }),
      );

      expect(deviceMap.get(gameID)?.desktop).toBe(true);
    });
  });
});

function makeGameID() {
  return `test-${crypto.randomUUID()}`;
}

function makeEntry() {
  return {
    desktopGameID: makeGameID(),
    name: 'Test Game',
    gameProviderID: '51',
  };
}

async function addTestGame() {
  const desktopGameID = makeGameID();

  return runtime.runPromise(
    Effect.gen(function* () {
      const svc = yield* GamesService;

      yield* svc.add({ desktopGameID, name: 'Update Test', gameProviderID: '51' });

      const list = yield* svc.list();
      const found = list.find((g) => {
        return g.desktopGameID === desktopGameID;
      });

      if (!found) {
        throw new Error(`addTestGame: ${desktopGameID} not found after add`);
      }

      return found;
    }),
  );
}
