import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { GameEntry, GameUpdates } from '../../shared/types';

export type { GameEntry, GameUpdates } from '../../shared/types';

export function addGame(entry: Omit<GameEntry, 'id'> & { id?: string }) {
  const games = readGames();

  if (
    games.some((game: GameEntry) => {
      return game.desktopGameID === entry.desktopGameID;
    })
  ) {
    throw new Error(`Game with ID ${entry.desktopGameID} already exists`);
  }

  const full = { ...entry, id: entry.id ?? crypto.randomUUID() };

  games.push(full);
  writeGamesToDisk(games);
}

export function updateGame(id: string, updates: GameUpdates): { idChanged: boolean } {
  const games = readGames();
  const index = games.findIndex((game: GameEntry) => {
    return game.id === id;
  });

  if (index === -1) {
    throw new Error(`Game ${id} not found`);
  }

  const game = games[index];

  const idChanged =
    (updates.desktopGameID !== undefined && updates.desktopGameID !== game.desktopGameID) ||
    (updates.mobileGameID !== undefined && updates.mobileGameID !== game.mobileGameID);

  games[index] = {
    ...game,
    name: updates.name ?? game.name,
    desktopGameID: updates.desktopGameID ?? game.desktopGameID,
    mobileGameID: updates.mobileGameID !== undefined ? updates.mobileGameID : game.mobileGameID,
    gameProviderID: updates.gameProviderID ?? game.gameProviderID,
  };

  writeGamesToDisk(games);

  return { idChanged };
}

export function reorderGames(ids: string[]) {
  const games = readGames();

  const sorted = ids.map((id: string) => {
    const game = games.find((g: GameEntry) => {
      return g.id === id;
    });

    if (!game) {
      throw new Error(`Game ${id} not found`);
    }

    return game;
  });

  writeGamesToDisk(sorted);
}

export function deleteGame(id: string) {
  const games = readGames();
  const index = games.findIndex((game: GameEntry) => {
    return game.id === id;
  });

  if (index === -1) {
    throw new Error(`Game ${id} not found`);
  }

  games.splice(index, 1);
  writeGamesToDisk(games);
}

export function readGames() {
  let entries: unknown[];

  try {
    entries = JSON.parse(fs.readFileSync(gamesPath(), 'utf8')) as unknown[];
  } catch {
    return [];
  }

  let dirty = false;

  const games = entries.map((entry: unknown) => {
    const game = entry as Record<string, unknown>;

    if (!game.id) {
      game.id = crypto.randomUUID();
      dirty = true;
    }

    if ('desktopGameId' in game && !('desktopGameID' in game)) {
      game.desktopGameID = game.desktopGameId;
      delete game.desktopGameId;
      dirty = true;
    }

    if ('mobileGameId' in game && !('mobileGameID' in game)) {
      game.mobileGameID = game.mobileGameId;
      delete game.mobileGameId;
      dirty = true;
    }

    if (game.gameProviderID === undefined) {
      game.gameProviderID = '';
      dirty = true;
    }

    return game as unknown as GameEntry;
  });

  if (dirty) {
    writeGamesToDisk(games);
  }

  return games;
}

function writeGamesToDisk(entries: GameEntry[]) {
  fs.mkdirSync(path.dirname(gamesPath()), { recursive: true });
  fs.writeFileSync(gamesPath(), JSON.stringify(entries, null, 2));
}

function gamesPath() {
  return process.env.GAMES_JSON_PATH
    ? path.resolve(process.env.GAMES_JSON_PATH)
    : path.resolve('src', 'server', 'data', 'games.json');
}
