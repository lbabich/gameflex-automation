import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as stepCache from './step-cache';
import type { PlayMode } from './types';
import { PLAY_MODE } from './types';

export type GameEntry = {
  id: string;
  desktopGameId: string;
  mobileGameId?: string;
  name: string;
  desktopEnabled: boolean;
  desktopPlaymode: PlayMode;
  mobileEnabled: boolean;
  mobilePlaymode: PlayMode;
};

export type GameUpdates = {
  name?: string;
  desktopGameId?: string;
  mobileGameId?: string;
  desktopEnabled?: boolean;
  desktopPlaymode?: PlayMode;
  mobileEnabled?: boolean;
  mobilePlaymode?: PlayMode;
};

const GAMES_PATH = path.resolve('src', 'data', 'games.json');

export function readGames(): GameEntry[] {
  let raw: unknown[];

  try {
    raw = JSON.parse(fs.readFileSync(GAMES_PATH, 'utf8')) as unknown[];
  } catch {
    return [];
  }

  let dirty = false;

  const games = raw.map((entry) => {
    const g = entry as Record<string, unknown>;

    if (!g.id) {
      g.id = crypto.randomUUID();
      dirty = true;
    }

    const hasLegacyFields = 'channel' in g || 'playmode' in g;

    if (hasLegacyFields) {
      const channel = g.channel as string | undefined;
      const playmode = (g.playmode as PlayMode | undefined) ?? PLAY_MODE.DEMO;

      g.desktopEnabled = channel !== 'mobile';
      g.mobileEnabled = channel === 'mobile' || channel === 'both';
      g.desktopPlaymode = playmode;
      g.mobilePlaymode = playmode;

      delete g.channel;
      delete g.playmode;
      dirty = true;
    }

    if (g.desktopEnabled === undefined) {
      g.desktopEnabled = true;
      dirty = true;
    }

    if (!g.desktopPlaymode) {
      g.desktopPlaymode = PLAY_MODE.DEMO;
      dirty = true;
    }

    if (g.mobileEnabled === undefined) {
      g.mobileEnabled = false;
      dirty = true;
    }

    if (!g.mobilePlaymode) {
      g.mobilePlaymode = PLAY_MODE.DEMO;
      dirty = true;
    }

    return g as unknown as GameEntry;
  });

  if (dirty) {
    fs.mkdirSync(path.dirname(GAMES_PATH), { recursive: true });
    fs.writeFileSync(GAMES_PATH, JSON.stringify(games, null, 2));
  }

  return games;
}

export function addGame(entry: Omit<GameEntry, 'id'> & { id?: string }): void {
  const games = readGames();

  if (
    games.some((g) => {
      return g.desktopGameId === entry.desktopGameId;
    })
  ) {
    throw new Error(`Game with ID ${entry.desktopGameId} already exists`);
  }

  const full = { ...entry, id: entry.id ?? crypto.randomUUID() };

  games.push(full);
  fs.mkdirSync(path.dirname(GAMES_PATH), { recursive: true });
  fs.writeFileSync(GAMES_PATH, JSON.stringify(games, null, 2));
}

export function updateGame(id: string, updates: GameUpdates): void {
  const games = readGames();
  const idx = games.findIndex((g) => {
    return g.id === id;
  });

  if (idx === -1) {
    throw new Error(`Game ${id} not found`);
  }

  const game = games[idx];

  const idChanged =
    (updates.desktopGameId !== undefined && updates.desktopGameId !== game.desktopGameId) ||
    (updates.mobileGameId !== undefined && updates.mobileGameId !== game.mobileGameId);

  if (idChanged) {
    stepCache.clearAllSteps(id);
  }

  games[idx] = {
    ...game,
    name: updates.name ?? game.name,
    desktopGameId: updates.desktopGameId ?? game.desktopGameId,
    mobileGameId: updates.mobileGameId !== undefined ? updates.mobileGameId : game.mobileGameId,
    desktopEnabled:
      updates.desktopEnabled !== undefined ? updates.desktopEnabled : game.desktopEnabled,
    desktopPlaymode: updates.desktopPlaymode ?? game.desktopPlaymode,
    mobileEnabled: updates.mobileEnabled !== undefined ? updates.mobileEnabled : game.mobileEnabled,
    mobilePlaymode: updates.mobilePlaymode ?? game.mobilePlaymode,
  };

  fs.mkdirSync(path.dirname(GAMES_PATH), { recursive: true });
  fs.writeFileSync(GAMES_PATH, JSON.stringify(games, null, 2));
}
