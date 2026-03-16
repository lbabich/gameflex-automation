import * as fs from 'node:fs';
import * as path from 'node:path';
import { readGames } from '../lib/games';

export type { GameEntry } from '../lib/games';

export { readGames };

const GAMES_PATH = path.resolve('data', 'games.json');
const STEPS_PATH = path.resolve('data', 'game-steps.json');

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
