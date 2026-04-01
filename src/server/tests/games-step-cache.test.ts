import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { addGame, readGames, updateGame } from '../lib/games';
import * as stepCache from '../lib/step-cache';

beforeEach(() => {
  fs.writeFileSync(path.resolve(process.env.GAMES_JSON_PATH ?? 'src/server/data/games.json'), '[]');
});

describe('updateGame + stepCache integration', () => {
  it('clears the cache when desktopGameID changes', () => {
    const SUT = updateGame;
    const game = addTestGame();
    const VP = { width: 1280, height: 720 };
    const steps = { discoveredAt: new Date().toISOString(), steps: [] };

    stepCache.setSteps(
      { id: game.id, deviceType: 'desktop', viewport: VP, stepName: 'spin-cycle' },
      steps,
    );

    const resultBefore = stepCache.getSteps({
      id: game.id,
      deviceType: 'desktop',
      viewport: VP,
      stepName: 'spin-cycle',
    });

    expect(resultBefore, 'cache should exist before update').toBeTruthy();

    SUT(game.id, { desktopGameID: makeDesktopGameID() });

    const result = stepCache.getSteps({
      id: game.id,
      deviceType: 'desktop',
      viewport: VP,
      stepName: 'spin-cycle',
    });

    expect(result, 'cache should be cleared after ID change').toBeUndefined();
  });

  it('clears the cache when mobileGameID changes', () => {
    const SUT = updateGame;
    const game = addTestGame();
    const VP = { width: 390, height: 844 };
    const steps = { discoveredAt: new Date().toISOString(), steps: [] };

    stepCache.setSteps(
      { id: game.id, deviceType: 'mobile', viewport: VP, stepName: 'spin-cycle' },
      steps,
    );

    const resultBefore = stepCache.getSteps({
      id: game.id,
      deviceType: 'mobile',
      viewport: VP,
      stepName: 'spin-cycle',
    });

    expect(resultBefore, 'cache should exist before update').toBeTruthy();

    SUT(game.id, { mobileGameID: makeDesktopGameID() });

    const result = stepCache.getSteps({
      id: game.id,
      deviceType: 'mobile',
      viewport: VP,
      stepName: 'spin-cycle',
    });

    expect(result, 'cache should be cleared after mobile ID change').toBeUndefined();
  });

  it('does not clear the cache when only name changes', () => {
    const SUT = updateGame;
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

    SUT(game.id, { name: 'New Name' });

    const result = stepCache.getSteps({
      id: game.id,
      deviceType: 'desktop',
      viewport: VP,
      stepName: 'spin-cycle',
    });

    expect(result, 'cache should survive a name-only update').toEqual(steps);

    // Cleanup
    stepCache.clearAllSteps(game.id);
  });
});

function addTestGame() {
  const desktopGameID = makeDesktopGameID();

  addGame({
    desktopGameID,
    name: 'Update Test',
    gameProviderID: '51',
  });

  const found = readGames().find((game) => {
    return game.desktopGameID === desktopGameID;
  });

  if (!found) {
    throw new Error(`addTestGame: ${desktopGameID} not found after addGame`);
  }

  return found;
}

function makeDesktopGameID() {
  return `test-${crypto.randomUUID()}`;
}
