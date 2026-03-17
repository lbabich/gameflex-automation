import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as stepCache from '../../lib/step-cache.ts';
import { addGame, readGames, updateGame } from '../../server/games.ts';

const GAMES_PATH = path.resolve('src', 'data', 'games.json');

let originalGames: string;

beforeAll(() => {
  originalGames = fs.existsSync(GAMES_PATH) ? fs.readFileSync(GAMES_PATH, 'utf8') : '[]';
});

afterAll(() => {
  fs.writeFileSync(GAMES_PATH, originalGames);
});

function makeDesktopGameId() {
  // Use a unique numeric-style ID unlikely to collide with real games
  return `test-${crypto.randomUUID()}`;
}

describe('addGame', () => {
  it('assigns a GUID when adding a game', () => {
    const desktopGameId = makeDesktopGameId();

    addGame({ desktopGameId, name: 'Test Game', playmode: 'demo' });

    const updated = readGames();
    const added = updated.find((g) => {
      return g.desktopGameId === desktopGameId;
    });

    expect(added, 'added game should be in games.json').toBeTruthy();
    expect(added?.id ?? '').toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('throws when adding a duplicate desktopGameId', () => {
    const desktopGameId = makeDesktopGameId();

    addGame({ desktopGameId, name: 'Original', playmode: 'demo' });

    expect(() => {
      return addGame({ desktopGameId, name: 'Duplicate', playmode: 'demo' });
    }).toThrow(/already exists/);
  });
});

describe('readGames migration', () => {
  it('assigns GUIDs to entries missing id and writes back', () => {
    // Write a games.json with entries that have no id or playmode field
    const raw = JSON.stringify([
      {
        desktopGameId: makeDesktopGameId(),
        name: 'No ID Game',
      },
    ]);

    fs.writeFileSync(GAMES_PATH, raw);

    const games = readGames();

    expect(games.length).toBe(1);

    // Verify the file was written back with the id and playmode
    const onDisk = JSON.parse(fs.readFileSync(GAMES_PATH, 'utf8')) as typeof games;

    expect(onDisk[0].id, 'id should be persisted to disk').toBeTruthy();
    expect(onDisk[0].id).toBe(games[0].id);
    expect(onDisk[0].playmode).toBe('demo');
  });
});

describe('updateGame', () => {
  function addTestGame() {
    const desktopGameId = makeDesktopGameId();

    addGame({ desktopGameId, name: 'Update Test', playmode: 'demo' });

    const found = readGames().find((g) => {
      return g.desktopGameId === desktopGameId;
    });

    if (!found) {
      throw new Error(`addTestGame: ${desktopGameId} not found after addGame`);
    }

    return found;
  }

  it('clears the cache when desktopGameId changes', () => {
    const game = addTestGame();
    const VP = { width: 1280, height: 720 };
    const steps = { discoveredAt: new Date().toISOString(), steps: [] };

    stepCache.setSteps(game.id, 'desktop', VP, steps);

    expect(
      stepCache.getSteps(game.id, 'desktop', VP),
      'cache should exist before update',
    ).toBeTruthy();

    updateGame(game.id, { desktopGameId: makeDesktopGameId() });

    expect(
      stepCache.getSteps(game.id, 'desktop', VP),
      'cache should be cleared after ID change',
    ).toBeUndefined();
  });

  it('clears the cache when mobileGameId changes', () => {
    const game = addTestGame();
    const VP = { width: 390, height: 844 };
    const steps = { discoveredAt: new Date().toISOString(), steps: [] };

    stepCache.setSteps(game.id, 'mobile', VP, steps);

    expect(
      stepCache.getSteps(game.id, 'mobile', VP),
      'cache should exist before update',
    ).toBeTruthy();

    updateGame(game.id, { mobileGameId: makeDesktopGameId() });

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
