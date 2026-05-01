import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Effect, ManagedRuntime } from 'effect';
import { beforeEach, describe, expect, it } from 'vitest';
import { stepCache } from '../step-cache';
import { addGame, GamesService, NodeGamesService, readGames } from './game-catalog.module';

const GAMES_PATH = path.resolve(process.env.GAMES_JSON_PATH ?? 'src/core/data/games.json');
const runtime = ManagedRuntime.make(NodeGamesService);

beforeEach(() => {
  fs.writeFileSync(GAMES_PATH, '[]');
});

describe('GamesService update + stepCache invalidation', () => {
  it('clears the cache when desktopGameID changes', async () => {
    const game = addTestGame();
    const VP = { width: 1280, height: 720 };
    const steps = { discoveredAt: new Date().toISOString(), steps: [] };

    stepCache.setSteps(
      { id: game.id, deviceType: 'desktop', viewport: VP, stepName: 'spin-cycle' },
      steps,
    );

    expect(
      stepCache.getSteps({
        id: game.id,
        deviceType: 'desktop',
        viewport: VP,
        stepName: 'spin-cycle',
      }),
      'cache should exist before update',
    ).toBeTruthy();

    await runtime.runPromise(
      Effect.gen(function* () {
        const SUT = yield* GamesService;

        yield* SUT.update(game.id, { desktopGameID: makeGameID() });
      }),
    );

    expect(
      stepCache.getSteps({
        id: game.id,
        deviceType: 'desktop',
        viewport: VP,
        stepName: 'spin-cycle',
      }),
      'cache should be cleared after ID change',
    ).toBeUndefined();
  });

  it('clears the cache when mobileGameID changes', async () => {
    const game = addTestGame();
    const VP = { width: 390, height: 844 };
    const steps = { discoveredAt: new Date().toISOString(), steps: [] };

    stepCache.setSteps(
      { id: game.id, deviceType: 'mobile', viewport: VP, stepName: 'spin-cycle' },
      steps,
    );

    await runtime.runPromise(
      Effect.gen(function* () {
        const SUT = yield* GamesService;

        yield* SUT.update(game.id, { mobileGameID: makeGameID() });
      }),
    );

    expect(
      stepCache.getSteps({
        id: game.id,
        deviceType: 'mobile',
        viewport: VP,
        stepName: 'spin-cycle',
      }),
      'cache should be cleared after mobile ID change',
    ).toBeUndefined();
  });

  it('does not clear the cache when only name changes', async () => {
    const game = addTestGame();
    const VP = { width: 1280, height: 720 };
    const steps = {
      discoveredAt: new Date().toISOString(),
      steps: [{ waitMs: 100, x: 10, y: 20, label: 'spin' }],
    };

    stepCache.setSteps(
      { id: game.id, deviceType: 'desktop', viewport: VP, stepName: 'spin-cycle' },
      steps,
    );

    await runtime.runPromise(
      Effect.gen(function* () {
        const SUT = yield* GamesService;

        yield* SUT.update(game.id, { name: 'New Name' });
      }),
    );

    expect(
      stepCache.getSteps({
        id: game.id,
        deviceType: 'desktop',
        viewport: VP,
        stepName: 'spin-cycle',
      }),
      'cache should survive a name-only update',
    ).toEqual(steps);

    stepCache.clearAllSteps(game.id);
  });

  it('clears the cache when game is deleted', async () => {
    const game = addTestGame();
    const VP = { width: 1280, height: 720 };
    const steps = { discoveredAt: new Date().toISOString(), steps: [] };

    stepCache.setSteps(
      { id: game.id, deviceType: 'desktop', viewport: VP, stepName: 'spin-cycle' },
      steps,
    );

    await runtime.runPromise(
      Effect.gen(function* () {
        const SUT = yield* GamesService;

        yield* SUT.delete(game.id);
      }),
    );

    expect(
      stepCache.getSteps({
        id: game.id,
        deviceType: 'desktop',
        viewport: VP,
        stepName: 'spin-cycle',
      }),
      'cache should be cleared after deletion',
    ).toBeUndefined();
  });
});

function addTestGame() {
  const desktopGameID = makeGameID();

  addGame({ desktopGameID, name: 'Update Test', gameProviderID: '51' });

  const found = readGames().find((game) => {
    return game.desktopGameID === desktopGameID;
  });

  if (!found) {
    throw new Error(`addTestGame: ${desktopGameID} not found after addGame`);
  }

  return found;
}

function makeGameID() {
  return `test-${crypto.randomUUID()}`;
}
