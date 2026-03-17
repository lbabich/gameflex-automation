import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { PlayMode } from '../lib/games';
import { readGames } from '../lib/games';
import * as stepCache from '../lib/step-cache';

export type { GameEntry } from '../lib/games';

export { readGames };

const GAMES_PATH = path.resolve('src', 'data', 'games.json');
const STEPS_PATH = path.resolve('src', 'data', 'game-steps.json');

export function addGame(
  entry: Omit<import('../lib/games').GameEntry, 'id'> & { id?: string },
): void {
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

export type GameUpdates = {
  name?: string;
  desktopGameId?: string;
  mobileGameId?: string;
  playmode?: PlayMode;
};

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
    playmode: updates.playmode ?? game.playmode,
  };

  fs.mkdirSync(path.dirname(GAMES_PATH), { recursive: true });
  fs.writeFileSync(GAMES_PATH, JSON.stringify(games, null, 2));
}

export function getCachedGameIds(): Set<string> {
  try {
    const cache = JSON.parse(fs.readFileSync(STEPS_PATH, 'utf8')) as Record<string, unknown>;
    return new Set(Object.keys(cache));
  } catch {
    return new Set();
  }
}

export function clearGameSteps(id: string) {
  stepCache.clearAllSteps(id);
}
