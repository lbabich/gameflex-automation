import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addGame, readGames, updateGame } from '../../lib/games';
import * as stepCache from '../../lib/step-cache';

const GAMES_PATH = path.resolve('src', 'data', 'games.json');

let originalGames: string;

beforeAll(() => {
  originalGames = fs.existsSync(GAMES_PATH) ? fs.readFileSync(GAMES_PATH, 'utf8') : '[]';
});

afterAll(() => {
  fs.writeFileSync(GAMES_PATH, originalGames);
});

function makeDesktopGameID() {
  // Use a unique numeric-style ID unlikely to collide with real games
  return `test-${crypto.randomUUID()}`;
}

describe('addGame', () => {
  it('assigns a GUID when adding a game', () => {
    const desktopGameID = makeDesktopGameID();

    addGame({
      desktopGameID,
      name: 'Test Game',
      desktopEnabled: true,
      desktopPlaymode: 'demo',
      mobileEnabled: false,
      mobilePlaymode: 'demo',
    });

    const updated = readGames();
    const added = updated.find((g) => {
      return g.desktopGameID === desktopGameID;
    });

    expect(added, 'added game should be in games.json').toBeTruthy();
    expect(added?.id ?? '').toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('throws when adding a duplicate desktopGameID', () => {
    const desktopGameID = makeDesktopGameID();

    addGame({
      desktopGameID,
      name: 'Original',
      desktopEnabled: true,
      desktopPlaymode: 'demo',
      mobileEnabled: false,
      mobilePlaymode: 'demo',
    });

    expect(() => {
      return addGame({
        desktopGameID,
        name: 'Duplicate',
        desktopEnabled: true,
        desktopPlaymode: 'demo',
        mobileEnabled: false,
        mobilePlaymode: 'demo',
      });
    }).toThrow(/already exists/);
  });
});

describe('readGames migration', () => {
  it('assigns GUIDs to entries missing id and writes back', () => {
    // Write a games.json with entries that have no id or playmode field
    const raw = JSON.stringify([
      {
        desktopGameID: makeDesktopGameID(),
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
    expect(onDisk[0].desktopPlaymode).toBe('demo');
  });
});

describe('updateGame', () => {
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
