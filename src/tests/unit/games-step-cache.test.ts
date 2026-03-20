import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { addGame, readGames, updateGame } from '../../lib/games';
import * as stepCache from '../../lib/step-cache';

beforeEach(() => {
  fs.writeFileSync(
    path.resolve(process.env.GAMES_JSON_PATH ?? 'src/data/games.json'),
    '[]',
  );
});

function makeDesktopGameID() {
  return `test-${crypto.randomUUID()}`;
}

function addTestGame() {
  const desktopGameID = makeDesktopGameID();

  addGame({
    desktopGameID,
    name: 'Update Test',
    desktopEnabled: true,
    desktopPlaymode: 'demo',
    mobileEnabled: false,
    mobilePlaymode: 'demo',
  });

  const found = readGames().find((g) => {
    return g.desktopGameID === desktopGameID;
  });

  if (!found) {
    throw new Error(`addTestGame: ${desktopGameID} not found after addGame`);
  }

  return found;
}

describe('updateGame + stepCache integration', () => {
  it('clears the cache when desktopGameID changes', () => {
    const game = addTestGame();
    const VP = { width: 1280, height: 720 };
    const steps = { discoveredAt: new Date().toISOString(), steps: [] };

    stepCache.setSteps(game.id, 'desktop', VP, steps);

    expect(
      stepCache.getSteps(game.id, 'desktop', VP),
      'cache should exist before update',
    ).toBeTruthy();

    updateGame(game.id, { desktopGameID: makeDesktopGameID() });

    expect(
      stepCache.getSteps(game.id, 'desktop', VP),
      'cache should be cleared after ID change',
    ).toBeUndefined();
  });

  it('clears the cache when mobileGameID changes', () => {
    const game = addTestGame();
    const VP = { width: 390, height: 844 };
    const steps = { discoveredAt: new Date().toISOString(), steps: [] };

    stepCache.setSteps(game.id, 'mobile', VP, steps);

    expect(
      stepCache.getSteps(game.id, 'mobile', VP),
      'cache should exist before update',
    ).toBeTruthy();

    updateGame(game.id, { mobileGameID: makeDesktopGameID() });

    expect(
      stepCache.getSteps(game.id, 'mobile', VP),
      'cache should be cleared after mobile ID change',
    ).toBeUndefined();
  });

  it('does not clear the cache when only name changes', () => {
    const game = addTestGame();
    const VP = { width: 1280, height: 720 };
    const steps = {
      discoveredAt: new Date().toISOString(),
      steps: [{ waitMs: 100, x: 10, y: 20, label: 'spin' }],
    };

    stepCache.setSteps(game.id, 'desktop', VP, steps);

    updateGame(game.id, { name: 'New Name' });

    expect(
      stepCache.getSteps(game.id, 'desktop', VP),
      'cache should survive a name-only update',
    ).toEqual(steps);

    // Cleanup
    stepCache.clearAllSteps(game.id);
  });
});
