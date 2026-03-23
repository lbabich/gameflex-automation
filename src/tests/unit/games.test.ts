import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { addGame, readGames, updateGame } from '../../lib/games';

const GAMES_PATH = path.resolve(process.env.GAMES_JSON_PATH ?? 'src/data/games.json');

beforeEach(() => {
  fs.writeFileSync(GAMES_PATH, '[]');
});

function makeDesktopGameID() {
  // Use a unique numeric-style ID unlikely to collide with real games
  return `test-${crypto.randomUUID()}`;
}

describe('addGame', () => {
  it('assigns a GUID when adding a game', () => {
    const SUT = addGame;
    const desktopGameID = makeDesktopGameID();

    SUT({
      desktopGameID,
      name: 'Test Game',
      desktopEnabled: true,
      desktopPlaymode: 'demo',
      mobileEnabled: false,
      mobilePlaymode: 'demo',
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
      desktopEnabled: true,
      desktopPlaymode: 'demo',
      mobileEnabled: false,
      mobilePlaymode: 'demo',
    });

    expect(() => {
      return SUT({
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
    const SUT = readGames;

    // Write a games.json with entries that have no id or playmode field
    const raw = JSON.stringify([
      {
        desktopGameID: makeDesktopGameID(),
        name: 'No ID Game',
      },
    ]);

    fs.writeFileSync(GAMES_PATH, raw);

    const result = SUT();

    expect(result.length).toBe(1);

    // Verify the file was written back with the id and playmode
    const onDisk = JSON.parse(fs.readFileSync(GAMES_PATH, 'utf8')) as typeof result;

    expect(onDisk[0].id, 'id should be persisted to disk').toBeTruthy();
    expect(onDisk[0].id).toBe(result[0].id);
    expect(onDisk[0].desktopPlaymode).toBe('demo');
  });
});

describe('updateGame', () => {
  it('updates game fields in games.json', () => {
    const SUT = updateGame;
    const desktopGameID = makeDesktopGameID();

    addGame({
      desktopGameID,
      name: 'Original Name',
      desktopEnabled: true,
      desktopPlaymode: 'demo',
      mobileEnabled: false,
      mobilePlaymode: 'demo',
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
