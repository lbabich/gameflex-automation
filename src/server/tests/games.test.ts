import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { addGame, readGames, updateGame } from '../lib/games';

const GAMES_PATH = path.resolve(process.env.GAMES_JSON_PATH ?? 'src/data/games.json');

beforeEach(() => {
  fs.writeFileSync(GAMES_PATH, '[]');
});

describe('addGame', () => {
  it('assigns a GUID when adding a game', () => {
    const SUT = addGame;
    const desktopGameID = makeDesktopGameID();

    SUT({
      desktopGameID,
      name: 'Test Game',
      gameProviderID: '51',
    });

    const result = readGames();
    const added = result.find((game) => {
      return game.desktopGameID === desktopGameID;
    });

    expect(added, 'added game should be in games.json').toBeTruthy();
    expect(added?.id ?? '').toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('throws when adding a duplicate desktopGameID', () => {
    const SUT = addGame;
    const desktopGameID = makeDesktopGameID();

    SUT({
      desktopGameID,
      name: 'Original',
      gameProviderID: '51',
    });

    expect(() => {
      return SUT({
        desktopGameID,
        name: 'Duplicate',
        gameProviderID: '51',
      });
    }).toThrow(/already exists/);
  });
});

describe('readGames migration', () => {
  it('assigns GUIDs to entries missing id and writes back', () => {
    const SUT = readGames;

    // Write a games.json with entries that have no id
    const raw = JSON.stringify([
      {
        desktopGameID: makeDesktopGameID(),
        name: 'No ID Game',
      },
    ]);

    fs.writeFileSync(GAMES_PATH, raw);

    const result = SUT();

    expect(result.length).toBe(1);

    // Verify the file was written back with the id
    const onDisk = JSON.parse(fs.readFileSync(GAMES_PATH, 'utf8')) as typeof result;

    expect(onDisk[0].id, 'id should be persisted to disk').toBeTruthy();
    expect(onDisk[0].id).toBe(result[0].id);
  });
});

describe('updateGame', () => {
  it('updates game fields in games.json', () => {
    const SUT = updateGame;
    const desktopGameID = makeDesktopGameID();

    addGame({
      desktopGameID,
      name: 'Original Name',
      gameProviderID: '51',
    });

    const existing = readGames().find((game) => {
      return game.desktopGameID === desktopGameID;
    });

    if (!existing) {
      throw new Error('game not found after addGame');
    }

    SUT(existing.id, { name: 'Updated Name' });

    const result = readGames().find((game) => {
      return game.id === existing.id;
    });

    expect(result?.name).toBe('Updated Name');
  });
});

function makeDesktopGameID() {
  // Use a unique numeric-style ID unlikely to collide with real games
  return `test-${crypto.randomUUID()}`;
}
