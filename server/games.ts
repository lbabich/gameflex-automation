import * as fs from 'node:fs';
import * as path from 'node:path';

export type GameEntry = {
  gameId: string;
  name: string;
  url: string;
  mobileUrl?: string;
};

const GAMES_PATH = path.resolve('data', 'games.json');
const STEPS_PATH = path.resolve('data', 'game-steps.json');

export function readGames(): GameEntry[] {
  try {
    return JSON.parse(fs.readFileSync(GAMES_PATH, 'utf8')) as GameEntry[];
  } catch {
    return [];
  }
}

export function addGame(entry: GameEntry): void {
  const games = readGames();
  if (
    games.some((g) => {
      return g.gameId === entry.gameId;
    })
  ) {
    throw new Error(`Game with ID ${entry.gameId} already exists`);
  }
  games.push(entry);
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
