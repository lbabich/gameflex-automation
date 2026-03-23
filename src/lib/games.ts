import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as stepCache from './step-cache';
import type { PlayMode } from './types';
import { PLAY_MODE } from './types';

export type GameEntry = {
  id: string;
  desktopGameID: string;
  mobileGameID?: string;
  name: string;
  gameProviderID: string;
  desktopEnabled: boolean;
  desktopPlaymode: PlayMode;
  mobileEnabled: boolean;
  mobilePlaymode: PlayMode;
};

export type GameUpdates = {
  name?: string;
  desktopGameID?: string;
  mobileGameID?: string;
  gameProviderID?: string;
  desktopEnabled?: boolean;
  desktopPlaymode?: PlayMode;
  mobileEnabled?: boolean;
  mobilePlaymode?: PlayMode;
};

function gamesPath() {
  return process.env.GAMES_JSON_PATH
    ? path.resolve(process.env.GAMES_JSON_PATH)
    : path.resolve('src', 'data', 'games.json');
}

export function readGames() {
  let entries: unknown[];

  try {
    entries = JSON.parse(fs.readFileSync(gamesPath(), 'utf8')) as unknown[];
  } catch {
    return [];
  }

  let dirty = false;

  const games = entries.map((entry) => {
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

    const hasLegacyFields = 'channel' in game || 'playmode' in game;

    if (hasLegacyFields) {
      const channel = game.channel as string | undefined;
      const playmode = (game.playmode as PlayMode | undefined) ?? PLAY_MODE.DEMO;

      game.desktopEnabled = channel !== 'mobile';
      game.mobileEnabled = channel === 'mobile' || channel === 'both';
      game.desktopPlaymode = playmode;
      game.mobilePlaymode = playmode;

      delete game.channel;
      delete game.playmode;
      dirty = true;
    }

    if (game.desktopEnabled === undefined) {
      game.desktopEnabled = true;
      dirty = true;
    }

    if (!game.desktopPlaymode) {
      game.desktopPlaymode = PLAY_MODE.DEMO;
      dirty = true;
    }

    if (game.mobileEnabled === undefined) {
      game.mobileEnabled = false;
      dirty = true;
    }

    if (!game.mobilePlaymode) {
      game.mobilePlaymode = PLAY_MODE.DEMO;
      dirty = true;
    }

    if (game.gameProviderID === undefined) {
      game.gameProviderID = '';
      dirty = true;
    }

    return game as unknown as GameEntry;
  });

  if (dirty) {
    fs.mkdirSync(path.dirname(gamesPath()), { recursive: true });
    fs.writeFileSync(gamesPath(), JSON.stringify(games, null, 2));
  }

  return games;
}

export function addGame(entry: Omit<GameEntry, 'id'> & { id?: string }) {
  const games = readGames();

  if (
    games.some((game) => {
      return game.desktopGameID === entry.desktopGameID;
    })
  ) {
    throw new Error(`Game with ID ${entry.desktopGameID} already exists`);
  }

  const full = { ...entry, id: entry.id ?? crypto.randomUUID() };

  games.push(full);
  fs.mkdirSync(path.dirname(gamesPath()), { recursive: true });
  fs.writeFileSync(gamesPath(), JSON.stringify(games, null, 2));
}

export function updateGame(id: string, updates: GameUpdates) {
  const games = readGames();
  const index = games.findIndex((game) => {
    return game.id === id;
  });

  if (index === -1) {
    throw new Error(`Game ${id} not found`);
  }

  const game = games[index];

  const idChanged =
    (updates.desktopGameID !== undefined && updates.desktopGameID !== game.desktopGameID) ||
    (updates.mobileGameID !== undefined && updates.mobileGameID !== game.mobileGameID);

  if (idChanged) {
    stepCache.clearAllSteps(id);
  }

  games[index] = {
    ...game,
    name: updates.name ?? game.name,
    desktopGameID: updates.desktopGameID ?? game.desktopGameID,
    mobileGameID: updates.mobileGameID !== undefined ? updates.mobileGameID : game.mobileGameID,
    gameProviderID: updates.gameProviderID ?? game.gameProviderID,
    desktopEnabled:
      updates.desktopEnabled !== undefined ? updates.desktopEnabled : game.desktopEnabled,
    desktopPlaymode: updates.desktopPlaymode ?? game.desktopPlaymode,
    mobileEnabled: updates.mobileEnabled !== undefined ? updates.mobileEnabled : game.mobileEnabled,
    mobilePlaymode: updates.mobilePlaymode ?? game.mobilePlaymode,
  };

  fs.mkdirSync(path.dirname(gamesPath()), { recursive: true });
  fs.writeFileSync(gamesPath(), JSON.stringify(games, null, 2));
}
